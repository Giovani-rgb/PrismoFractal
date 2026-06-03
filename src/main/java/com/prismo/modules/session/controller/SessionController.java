package com.prismo.modules.session.controller;

import com.prismo.config.JwtService;
import com.prismo.logger.AppLogger; // Importação correta do Wrapper Global
import com.prismo.modules.session.model.Session;
import com.prismo.modules.session.service.ServiceSession;
import com.prismo.modules.session.repository.ResponseQueries;

import jakarta.servlet.http.HttpServletRequest;
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

    private final ServiceSession  service;
    private final ResponseQueries responseQueries;
    private final JwtService      jwtService;
    private final AppLogger       log; // Injeção do nosso Logger customizado

    @Value("${app.session.secret}")
    private String appSessionSecret;

    public SessionController(ServiceSession service,
                             ResponseQueries responseQueries,
                             JwtService jwtService,
                             AppLogger log) {
        this.service         = service;
        this.responseQueries = responseQueries;
        this.jwtService      = jwtService;
        this.log             = log;
    }

    // =========================================================================
    // POST /public  —  3 fluxos em um único endpoint
    // =========================================================================

    /**
     * POST /public — identifica o fluxo pelo corpo e headers da requisição:
     * <ul>
     * <li><b>Fase 1 (novo handshake)</b>: corpo vazio ou sem chaves relevantes</li>
     * <li><b>Fase 2 (callback DH)</b>: corpo contém "B" + header X-Window-Token</li>
     * <li><b>Fluxo 3 (freeze refresh)</b>: header X-Freezer-Token + corpo { iv, ciphertext }</li>
     * </ul>
     */
    @PostMapping("/public")
    public ResponseEntity<Map<String, Object>> establishPublicHandshake(
            @RequestBody(required = false) Map<String, String> clientPayload,
            @RequestHeader(value = "X-Window-Token",   required = false) String windowToken,
            @RequestHeader(value = "X-Freezer-Token",  required = false) String freezerTokenHeader
    ) {
        try {
            // ── FLUXO 3: EMISSÃO DO PASSAPORTE PARA /refresh .// Nesta parte do fluxo 3 deveriamos recuperar o sharedSecret através do método "getSecretByToken" parecido com a rota "/anonymous", ele ja foi usado antes e tras a Shared Secret relacionado ao freezeToken. Ao decifra o payload deve-se identificar a intensao do fluxo operacional e se existe algum cookie com a id_prospect ou texto json válido. Pra então emitir o novo token passaporte e criptografar a resposta pro cliente ───────────────

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

                log.request("Emissão de passaporte para /refresh solicitada via Freeze Token (Prefixo: {}).",
                        freezeToken.substring(0, Math.min(8, freezeToken.length())));

                Map<String, Object> passportData =
                        service.handleFreezePassportIssue(freezeToken, iv, ciphertext);

                return ResponseEntity.ok(passportData);
            }

            // ── FLUXO 2: FASE 2 DO HANDSHAKE DH ───────────────────────────
            if (clientPayload != null && clientPayload.containsKey("B")) {
                log.controllers("Callback Diffie-Hellman (Fase 2) recebido. Validando integridade do cliente.");

                if (windowToken == null || windowToken.isBlank()) {
                    log.warning("Handshake DH abortado: Header 'X-Window-Token' ausente na requisição.");
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                            .body(Map.of("error", "Token de janela ausente no Header X-Window-Token."));
                }

                Map<String, Object> anonymousData =
                        service.handlePublicFinalize(windowToken, clientPayload.get("B"));
                
                log.controllers("Handshake Diffie-Hellman finalizado com sucesso. Passaporte de canal criptográfico emitido.");
                return ResponseEntity.ok(anonymousData);
            }

            // ── FLUXO 1: FASE 1 DO HANDSHAKE DH ───────────────────────────
            log.controllers("Iniciando Fase 1 do handshake seguro público (DH Init).");
            Map<String, Object> dhParams = service.handlePublicInit();
            return ResponseEntity.ok(dhParams);

        } catch (RuntimeException e) {
            log.warning("Falha controlada no fluxo seguro de negociação criptográfica: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Erro crítico inesperado no handshake público de sessões", e);
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
            log.controllers("Tentativa de inicialização de nova sessão anônima no ecossistema.");

            if (anonymousToken == null || anonymousToken.isBlank()) {
                log.warning("Criação de sessão rejeitada: Header 'X-Anonymous-Token' está ausente.");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("error", "X-Anonymous-Token obrigatório nesta rota."));
            }

            log.queries("Recuperando segredo compartilhado associado ao token anônimo.");
            String sharedSecret = service.getSecretByToken(anonymousToken);
            if (sharedSecret == null) {
                log.warning("Acesso negado: Sessão criptográfica do token fornecido expirou ou inexiste na esteira.");
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "Sessão criptográfica expirada ou inexistente."));
            }

            String ip = extractIp(request);
            Session session = service.createAnonymous(ip, userAgent);

            log.controllers("Promovendo contexto anônimo (Upgrade) e cifrando carga de resposta.");
            Map<String, Object> upgradeData = service.handleAnonymousUpgrade(anonymousToken);
            Map<String, String> encrypted   = responseQueries.sanitizeAndEncrypt(session, upgradeData, sharedSecret);

            ResponseCookie cookie = service.generateSessionCookie(encrypted.get("ciphertext"));

            log.controllers("Sessão persistida com sucesso e vinculada ao ID UUID: {}", session.getId());
            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, cookie.toString())
                    .body(encrypted);

        } catch (RuntimeException e) {
            log.error("Falha ao instanciar sessão anônima via pipeline seguro: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", e.getMessage()));
        } finally {
            if (anonymousToken != null) {
                service.cleanup(anonymousToken);
            }
        }
    }

    // =========================================================================
    // POST /refresh  —  Renovação via Passaporte (Fluxo 3) ou JWT (legado)
    // =========================================================================

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(
            @RequestHeader(value = "X-Refresh-Passport", required = false) String refreshPassport,
            @RequestHeader(value = "Authorization",       required = false) String authHeader
    ) {
        log.request("Solicitação de renovação (Refresh) interceptada.");

        // ── MODO 1: PASSAPORTE EMITIDO PELO FLUXO 3 ───────────────────────
        if (refreshPassport != null && !refreshPassport.isBlank()) {
            try {
                log.controllers("Modo de atualização por Passaporte ativo. Prefixo analisado: {}...",
                        refreshPassport.substring(0, Math.min(8, refreshPassport.length())));

                Map<String, String> encrypted = service.handleRefreshWithPassport(refreshPassport);

                log.controllers("Sessão renovada com sucesso via passaporte DH isolado.");
                return ResponseEntity.ok(encrypted);

            } catch (RuntimeException e) {
                log.warning("Tentativa de renovação inválida com passaporte corrompido/expirado: {}", e.getMessage());
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", e.getMessage()));
            }
        }

        // ── MODO 2: JWT LEGADO ─────────────────────────────────────────────
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            log.warning("Requisição de refresh abortada: Ausência de credenciais (Passaporte ou JWT inexistentes).");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "X-Refresh-Passport ou Authorization Bearer obrigatório."));
        }

        try {
            String jwt          = authHeader.substring(7);
            String sessionIdStr = jwtService.extractSubject(jwt);
            UUID   sessionId    = UUID.fromString(sessionIdStr);

            log.queries("Buscando sessão ativa para o UUID extraído do token legível.");
            Session activeSession = service.getActiveSession(sessionId);
            
            Map<String, String> encrypted = responseQueries.sanitizeAndEncrypt(activeSession, appSessionSecret);
            ResponseCookie cookie = service.generateSessionCookie(encrypted.get("ciphertext"));

            log.controllers("Sessão corporativa [{}] estendida e atualizada via assinatura JWT.", activeSession.getId());
            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, cookie.toString())
                    .body(encrypted);

        } catch (Exception e) {
            log.error("Falha no pipeline de validação do refresh via assinatura JWT: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Sessão inválida ou expirada."));
        }
    }

    // =========================================================================
    // DELETE /{id}  —  Revogação
    // =========================================================================

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> revoke(@PathVariable UUID id) {
        log.admin("Ação de Revogação de Sessão acionada para o ID: {}", id);
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
