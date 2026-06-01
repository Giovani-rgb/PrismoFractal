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

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/sessions")
public class SessionController {

    private static final Logger log = LoggerFactory.getLogger(SessionController.class);

    private final ServiceSession service;
    private final ResponseQueries responseQueries;
    private final JwtService jwtService;

    @Value("${app.session.secret}")
    private String appSessionSecret;

    public SessionController(ServiceSession service,
                             ResponseQueries responseQueries,
                             JwtService jwtService) {
        this.service        = service;
        this.responseQueries = responseQueries;
        this.jwtService     = jwtService;
    }

    // =========================================================================
    // HANDSHAKE PÚBLICO
    // =========================================================================

    /**
     * POST /public
     * Stage 1 — corpo vazio → retorna {p, g, A, windowToken, minWait}
     * Stage 2 — corpo {B} + header X-Window-Token → emite anonymousToken (TTL 15s, uso único)
     */
    @PostMapping("/public")
    public ResponseEntity<Map<String, Object>> establishPublicHandshake(
            @RequestBody(required = false) Map<String, String> clientPayload,
            @RequestHeader(value = "X-Window-Token", required = false) String windowToken
    ) {
        try {
            if (clientPayload == null || !clientPayload.containsKey("B")) {
                log.info("[CONTROLLER - PUBLIC FASE 1] Requisição inicial recebida.");
                Map<String, Object> dhParams = service.handlePublicInit();
                return ResponseEntity.ok(dhParams);
            }

            log.info("[CONTROLLER - PUBLIC FASE 2] Callback recebido. Validando cliente.");

            if (windowToken == null || windowToken.isBlank()) {
                log.warn("[CONTROLLER - PUBLIC FASE 2] Bloqueado: X-Window-Token ausente.");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("error", "Token de janela ausente no Header X-Window-Token."));
            }

            Map<String, Object> anonymousData = service.handlePublicFinalize(windowToken, clientPayload.get("B"));
            log.info("[CONTROLLER - PUBLIC FASE 2] Handshake finalizado. Passaporte /anonymous emitido.");
            return ResponseEntity.ok(anonymousData);

        } catch (RuntimeException e) {
            log.error("[CONTROLLER - PUBLIC] Falha no fluxo seguro: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("[CONTROLLER - PUBLIC] Erro crítico.", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erro interno no handshake: " + e.getMessage()));
        }
    }

    // =========================================================================
    // CRIAÇÃO ANÔNIMA
    // =========================================================================

    /**
     * POST /anonymous
     * Consome o anonymousToken do handshake, cria a sessão e encripta a resposta.
     */
    @PostMapping("/anonymous")
    public ResponseEntity<?> createAnonymous(
            HttpServletRequest request,
            @RequestHeader(value = "User-Agent", defaultValue = "UNKNOWN") String userAgent,
            @RequestHeader(value = "X-Anonymous-Token", required = false) String anonymousToken
    ) {
        try {
            log.info("[CONTROLLER - ANONYMOUS] Tentativa de criação de sessão anônima.");

            if (anonymousToken == null || anonymousToken.isBlank()) {
                log.warn("[CONTROLLER - ANONYMOUS] Rejeitado: X-Anonymous-Token ausente.");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("error", "X-Anonymous-Token obrigatório nesta rota."));
            }

            String sharedSecret = service.getSecretByToken(anonymousToken);
            if (sharedSecret == null) {
                log.warn("[CONTROLLER - ANONYMOUS] Acesso negado: token inválido ou expirado.");
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "Sessão criptográfica expirada ou inexistente."));
            }

            String ip = extractIp(request);
            Session session = service.createAnonymous(ip, userAgent);

            Map<String, Object> upgradeData = service.handleAnonymousUpgrade(anonymousToken);

            log.debug("[CONTROLLER - ANONYMOUS] Encriptando dados com chave DH temporária.");
            Map<String, String> encryptedResponse = responseQueries.sanitizeAndEncrypt(session, upgradeData, sharedSecret);

            ResponseCookie sessionCookie = service.generateSessionCookie(encryptedResponse.get("ciphertext"));

            log.info("[CONTROLLER - ANONYMOUS] Sessão criada. ID: {}", session.getId());
            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, sessionCookie.toString())
                    .body(encryptedResponse);

        } catch (RuntimeException e) {
            log.error("[CONTROLLER - ANONYMOUS] Erro: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", e.getMessage()));
        } finally {
            if (anonymousToken != null) {
                service.cleanup(anonymousToken);
                log.debug("[CONTROLLER - ANONYMOUS] Memória RAM limpa para o token processado.");
            }
        }
    }

    // =========================================================================
    // REFRESH — suporta passaporte DH para encriptação com sharedSecret fresco
    // =========================================================================

    /**
     * POST /refresh
     * <p>
     * Com X-Passport-Token: usa o sharedSecret DH efêmero do passaporte para encriptar
     *   a resposta (fluxo Rehydrate seguro — comunicação AES-256 com o frontend).
     * Sem X-Passport-Token: encripta com appSessionSecret estático (legado).
     */
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(
            @RequestHeader(value = "Authorization",   required = false) String authHeader,
            @RequestHeader(value = "X-Passport-Token", required = false) String passportToken
    ) {
        log.info("[CONTROLLER - REFRESH] Solicitação de renovação. Passaporte: {}",
                passportToken != null ? passportToken.substring(0, 8) + "..." : "ausente");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            log.warn("[CONTROLLER - REFRESH] Rejeitado: Authorization ausente ou inválido.");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Token de autorização ausente ou inválido."));
        }

        try {
            String jwt = authHeader.substring(7);
            String sessionIdStr = jwtService.extractSubject(jwt);
            UUID sessionId = UUID.fromString(sessionIdStr);

            Session activeSession = service.getActiveSession(sessionId);

            // Determina a chave de encriptação: DH passport (preferido) ou estático (legado)
            String encryptionSecret;
            if (passportToken != null && !passportToken.isBlank()) {
                String dhSecret = service.getSecretByToken(passportToken);
                if (dhSecret == null) {
                    log.warn("[CONTROLLER - REFRESH] Passaporte inválido ou expirado: {}", passportToken.substring(0, 8));
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(Map.of("error", "Passaporte de renovação inválido ou expirado."));
                }
                encryptionSecret = dhSecret;
                log.info("[CONTROLLER - REFRESH] 🔑 Usando sharedSecret DH do passaporte para encriptação.");
            } else {
                encryptionSecret = appSessionSecret;
                log.info("[CONTROLLER - REFRESH] Usando appSessionSecret estático (legado).");
            }

            Map<String, String> encryptedResponse = responseQueries.sanitizeAndEncrypt(activeSession, encryptionSecret);
            ResponseCookie newCookie = service.generateSessionCookie(encryptedResponse.get("ciphertext"));

            log.info("[CONTROLLER - REFRESH] Sessão ID: {} renovada.", activeSession.getId());
            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, newCookie.toString())
                    .body(encryptedResponse);

        } catch (Exception e) {
            log.error("[CONTROLLER - REFRESH] Falha na renovação: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Sessão inválida ou expirada."));
        } finally {
            // Consumir passaporte após uso (token de uso único)
            if (passportToken != null && !passportToken.isBlank()) {
                service.cleanup(passportToken);
                log.debug("[CONTROLLER - REFRESH] Passaporte consumido e memória limpa.");
            }
        }
    }

    // =========================================================================
    // REVOGAÇÃO
    // =========================================================================

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> revoke(@PathVariable UUID id) {
        log.info("[CONTROLLER - DELETE] Revogando sessão ID: {}", id);
        service.revoke(id);
        log.info("[CONTROLLER - DELETE] Sessão {} revogada.", id);
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
