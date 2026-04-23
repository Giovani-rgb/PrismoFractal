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

/**
 * Controller Prismo: Gestão de Sessões e Handshake Criptográfico.
 */
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
     * ROTA PUBLIC: Estabelece a conexão segura via Diffie-Hellman.
     * * Estágio 1: Cliente envia corpo vazio -> Recebe p, g, A (produto do servidor) e windowToken.
     * Estágio 2: Cliente envia B (seu produto) + windowToken -> Finaliza a Shared Secret no servidor.
     */
    @PostMapping("/public")
    public ResponseEntity<Map<String, Object>> establishPublicHandshake(
            @RequestBody(required = false) Map<String, String> clientPayload,
            @RequestHeader(value = "X-Window-Token", required = false) String windowToken
    ) {
        // Se não há Payload ou Chave do Cliente, estamos no ESTÁGIO 1 (O Drop inicial)
        if (clientPayload == null || !clientPayload.containsKey("B")) {
            // Gera p, g e o produto A (g^a mod p)
            Map<String, Object> dhParams = service.generateServerHandshake();
            
            // Cria a janela de reentrada para identificar esta negociação
            String newToken = service.generateReentryWindow();
            dhParams.put("windowToken", newToken);
            
            return ResponseEntity.ok(dhParams);
        }

        // Se há chave B, estamos no ESTÁGIO 2 (O Callback)
        if (windowToken == null || windowToken.isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "X-Window-Token ausente."));
        }
        service.consumeReentryWindow(windowToken);
        
        // Finaliza o cálculo matemático: S = B^a mod p
        service.finalizeSharedSecret(windowToken, clientPayload.get("B"));

        return ResponseEntity.ok(Map.of("status", "established"));
    }

    /**
     * ROTA REFRESH: Atualiza os claims do token através do Cookie.
     * O valor vem do 'nameSessionKey' definido no environment do Frontend.
     */
    @PostMapping("/refresh")
    public ResponseEntity<Map<String, String>> refresh(
            @CookieValue(name = "nameSessionKey") String sessionCipher
    ) {
        // 1. Revalida a sessão através do ciphertext do cookie
        Session updatedSession = service.refreshSessionData(sessionCipher);

        // 2. Cifra os novos dados para a resposta
        Map<String, String> encryptedResponse = responseQueries.sanitizeAndEncrypt(updatedSession);

        // 3. Rotaciona o cookie de sessão no browser
        ResponseCookie newCookie = service.generateSessionCookie(encryptedResponse.get("ciphertext"));

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, newCookie.toString())
                .body(encryptedResponse);
    }

    /**
     * ROTA ANONYMOUS: Criação de sessão após o túnel seguro estar pronto.
     */
    @PostMapping("/anonymous")
    public ResponseEntity<Map<String, String>> createAnonymous(
            HttpServletRequest request,
            @RequestHeader(value = "User-Agent", defaultValue = "UNKNOWN") String userAgent
    ) {
        String ip = extractIp(request);
        Session session = service.createAnonymous(ip, userAgent);
        
        Map<String, String> encryptedResponse = responseQueries.sanitizeAndEncrypt(session);
        ResponseCookie sessionCookie = service.generateSessionCookie(encryptedResponse.get("ciphertext"));

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, sessionCookie.toString())
                .body(encryptedResponse);
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

