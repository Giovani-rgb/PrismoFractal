package com.prismo.modules.session.controller;

import com.prismo.modules.session.model.Session;
import com.prismo.modules.session.service.ServiceSession;
import com.prismo.modules.session.repository.ResponseQueries;

import jakarta.servlet.http.HttpServletRequest;
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

    private final ServiceSession service;
    private final ResponseQueries responseQueries;

    public SessionController(ServiceSession service, ResponseQueries responseQueries) {
        this.service = service;
        this.responseQueries = responseQueries;
    }

    /**
     * ROTA PUBLIC: Handshake Diffie-Hellman em dois estágios.
     *
     * Stage 1 — corpo vazio → retorna {p, g, A, windowToken, minWait}
     * Stage 2 — corpo {B} + header X-Window-Token
     *          → valida janela comportamental (anti-bot)
     *          → emite anonymousToken de 15s (uso único para /anonymous)
     *          → retorna {status, anonymousToken}
     */
    @PostMapping("/public")
    public ResponseEntity<Map<String, Object>> establishPublicHandshake(
            @RequestBody(required = false) Map<String, String> clientPayload,
            @RequestHeader(value = "X-Window-Token", required = false) String windowToken
    ) {
        try {
            if (clientPayload == null || !clientPayload.containsKey("B")) {
                Map<String, Object> dhParams = service.generateServerHandshake();
                return ResponseEntity.ok(dhParams);
            }

            if (windowToken == null || windowToken.isBlank()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("error", "Token de janela ausente."));
            }

            service.finalizeSharedSecret(windowToken, clientPayload.get("B"));

            String anonymousToken = service.issueAnonymousPassToken();

            return ResponseEntity.ok(Map.of(
                    "status", "established",
                    "anonymousToken", anonymousToken
            ));

        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erro interno no handshake."));
        }
    }

    /**
     * ROTA REFRESH: Atualiza os claims do token através do Cookie.
     */
    @PostMapping("/refresh")
    public ResponseEntity<Map<String, String>> refresh(
            @CookieValue(name = "nameSessionKey") String sessionCipher
    ) {
        Session updatedSession = service.refreshSessionData(sessionCipher);
        Map<String, String> encryptedResponse = responseQueries.sanitizeAndEncrypt(updatedSession);
        ResponseCookie newCookie = service.generateSessionCookie(encryptedResponse.get("ciphertext"));

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, newCookie.toString())
                .body(encryptedResponse);
    }

    /**
     * ROTA ANONYMOUS: Criação de sessão após o túnel seguro estar pronto.
     * Exige X-Anonymous-Token emitido na saída de /public (TTL 15s, uso único).
     */
    @PostMapping("/anonymous")
    public ResponseEntity<?> createAnonymous(
            HttpServletRequest request,
            @RequestHeader(value = "User-Agent", defaultValue = "UNKNOWN") String userAgent,
            @RequestHeader(value = "X-Anonymous-Token", required = false) String anonymousToken
    ) {
        try {
            service.consumeAnonymousPassToken(anonymousToken);

            String ip = extractIp(request);
            Session session = service.createAnonymous(ip, userAgent);

            Map<String, String> encryptedResponse = responseQueries.sanitizeAndEncrypt(session);
            ResponseCookie sessionCookie = service.generateSessionCookie(encryptedResponse.get("ciphertext"));

            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, sessionCookie.toString())
                    .body(encryptedResponse);

        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> revoke(@PathVariable UUID id) {
        service.revoke(id);
        return ResponseEntity.noContent().build();
    }

    private String extractIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        return (ip == null || ip.isBlank()) ? request.getRemoteAddr() : ip;
    }
}
