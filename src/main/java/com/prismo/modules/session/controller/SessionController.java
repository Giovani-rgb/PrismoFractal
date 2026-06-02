package com.prismo.modules.session.controller;

import com.prismo.config.JwtService;
import com.prismo.modules.session.model.Session;
import com.prismo.modules.session.service.ServiceSession;
import com.prismo.modules.session.repository.ResponseQueries;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/sessions")
public class SessionController {

    private static final Logger log = LoggerFactory.getLogger(SessionController.class);

    private final ServiceSession  service;
    private final ResponseQueries responseQueries;
    private final JwtService      jwtService;

    @Value("${app.session.secret}")
    private String appSessionSecret;

    public SessionController(ServiceSession service,
                             ResponseQueries responseQueries,
                             JwtService jwtService) {
        this.service         = service;
        this.responseQueries = responseQueries;
        this.jwtService      = jwtService;
    }

    // =========================================================================
    // POST /public  —  3 fluxos em um único endpoint
    // =========================================================================

    /**
     * POST /public — identifica o fluxo pelo corpo e headers da requisição:
     * <ul>
     *   <li><b>Fase 1 (novo handshake)</b>: corpo vazio ou sem chaves relevantes</li>
     *   <li><b>Fase 2 (callback DH)</b>: corpo contém "B" + header X-Window-Token</li>
     *   <li><b>Fluxo 3 (freeze refresh)</b>: header X-Freezer-Token + corpo { iv, ciphertext };
     *       delega internamente ao contrato de /refresh (atualiza lastAccessAt, keyUpdate);
     *       o freeze token é mantido em paralelo no dhContexts (não consumido)</li>
     * </ul>
     */
    @PostMapping("/public")
    public ResponseEntity<Map<String, Object>> establishPublicHandshake(
            @RequestBody(required = false) Map<String, String> clientPayload,
            @RequestHeader(value = "X-Window-Token",   required = false) String windowToken,
            @RequestHeader(value = "X-Freezer-Token",  required = false) String freezerTokenHeader
    ) {
        try {

            // ── FLUXO 3: REIDRATAÇÃO VIA FREEZE TOKEN ──────────────────────
            // freezeToken pode vir no body (legado) OU no header X-Freezer-Token (fluxo atual)
            final String resolvedFreezeToken = (clientPayload != null && clientPayload.containsKey("freezeToken"))
                    ? clientPayload.get("freezeToken")
                    : freezerTokenHeader;

            if (resolvedFreezeToken != null && !resolvedFreezeToken.isBlank()
                    && clientPayload != null
                    && clientPayload.containsKey("iv")
                    && clientPayload.containsKey("ciphertext")) {

                String freezeToken = resolvedFreezeToken;
                String iv          = clientPayload.get("iv");
                String ciphertext  = clientPayload.get("ciphertext");

                log.info("[CONTROLLER - FREEZE REFRESH] Delegando renovação via freeze token: {}...",
                        freezeToken.substring(0, Math.min(8, freezeToken.length())));

                Map<String, String> encryptedSession =
                        service.handleFreezeRefresh(freezeToken, iv, ciphertext);

                return ResponseEntity.ok(new HashMap<>(encryptedSession));
            }

            // ── FLUXO 2: FASE 2 DO HANDSHAKE DH ───────────────────────────
            if (clientPayload != null && clientPayload.containsKey("B")) {
                log.info("[CONTROLLER - PUBLIC FASE 2] Callback recebido. Validando cliente.");

                if (windowToken == null || windowToken.isBlank()) {
                    log.warn("[CONTROLLER - PUBLIC FASE 2] Bloqueado: X-Window-Token ausente.");
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                            .body(Map.of("error", "Token de janela ausente no Header X-Window-Token."));
                }

                Map<String, Object> anonymousData =
                        service.handlePublicFinalize(windowToken, clientPayload.get("B"));
                log.info("[CONTROLLER - PUBLIC FASE 2] Handshake finalizado. Passaporte emitido.");
                return ResponseEntity.ok(anonymousData);
            }

            // ── FLUXO 1: FASE 1 DO HANDSHAKE DH ───────────────────────────
            log.info("[CONTROLLER - PUBLIC FASE 1] Requisição inicial recebida.");
            Map<String, Object> dhParams = service.handlePublicInit();
            return ResponseEntity.ok(dhParams);

        } catch (RuntimeException e) {
            log.error("[CONTROLLER - PUBLIC] Falha no fluxo seguro: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("[CONTROLLER - PUBLIC] Erro crítico.", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erro interno: " + e.getMessage()));
        }
    }

    // =========================================================================
    // POST /anonymous  —  Criação de sessão
    // =========================================================================

    @PostMapping("/anonymous")
    public ResponseEntity<?> createAnonymous(
            HttpServletRequest request,
            @RequestHeader(value = "User-Agent",       defaultValue = "UNKNOWN") String userAgent,
            @RequestHeader(value = "X-Anonymous-Token", required = false)         String anonymousToken
    ) {
        try {
            log.info("[CONTROLLER - ANONYMOUS] Tentativa de criação de sessão anônima.");

            if (anonymousToken == null || anonymousToken.isBlank()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("error", "X-Anonymous-Token obrigatório nesta rota."));
            }

            String sharedSecret = service.getSecretByToken(anonymousToken);
            if (sharedSecret == null) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "Sessão criptográfica expirada ou inexistente."));
            }

            String ip = extractIp(request);
            Session session = service.createAnonymous(ip, userAgent);

            Map<String, Object> upgradeData = service.handleAnonymousUpgrade(anonymousToken);
            Map<String, String> encrypted   = responseQueries.sanitizeAndEncrypt(session, upgradeData, sharedSecret);

            ResponseCookie cookie = service.generateSessionCookie(encrypted.get("ciphertext"));

            log.info("[CONTROLLER - ANONYMOUS] Sessão criada: {}", session.getId());
            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, cookie.toString())
                    .body(encrypted);

        } catch (RuntimeException e) {
            log.error("[CONTROLLER - ANONYMOUS] Erro: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", e.getMessage()));
        } finally {
            if (anonymousToken != null) {
                service.cleanup(anonymousToken);
            }
        }
    }

    // =========================================================================
    // POST /refresh  —  Renovação (legado via appSessionSecret)
    // =========================================================================

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        log.info("[CONTROLLER - REFRESH] Solicitação de renovação.");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Token de autorização ausente ou inválido."));
        }

        try {
            String jwt          = authHeader.substring(7);
            String sessionIdStr = jwtService.extractSubject(jwt);
            UUID   sessionId    = UUID.fromString(sessionIdStr);

            Session activeSession = service.getActiveSession(sessionId);
            Map<String, String> encrypted = responseQueries.sanitizeAndEncrypt(activeSession, appSessionSecret);
            ResponseCookie cookie = service.generateSessionCookie(encrypted.get("ciphertext"));

            log.info("[CONTROLLER - REFRESH] Sessão {} renovada.", activeSession.getId());
            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, cookie.toString())
                    .body(encrypted);

        } catch (Exception e) {
            log.error("[CONTROLLER - REFRESH] Falha: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Sessão inválida ou expirada."));
        }
    }

    // =========================================================================
    // DELETE /{id}  —  Revogação
    // =========================================================================

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> revoke(@PathVariable UUID id) {
        log.info("[CONTROLLER - DELETE] Revogando sessão: {}", id);
        service.revoke(id);
        return ResponseEntity.noContent().build();
    }

    // =========================================================================
    // AUXILIARES
    // =========================================================================

    private String extractIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        String ip = (forwarded == null || forwarded.isBlank())
                ? request.getRemoteAddr()
                : forwarded.split(",")[0].trim();
        return ip.length() > 45 ? ip.substring(0, 45) : ip;
    }
}
