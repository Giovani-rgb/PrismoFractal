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

    @PostMapping("/public")
public ResponseEntity<Map<String, Object>> establishPublicHandshake(
        @RequestBody(required = false) Map<String, String> clientPayload,
        @RequestHeader(value = "X-Window-Token", required = false) String windowToken
) {
    try {
        // ESTÁGIO 1: Drop inicial (p, g, A) + Window Token
        if (clientPayload == null || !clientPayload.containsKey("B")) {
            Map<String, Object> dhParams = service.generateServerHandshake();
            return ResponseEntity.ok(dhParams);
        }

        // ESTÁGIO 2: O Callback (Validação Matemática + Comportamental)
        String clientB = clientPayload.get("B");
        String debugSecretFromClient = clientPayload.get("debugSecret");

        if (windowToken == null || windowToken.isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Token de janela ausente."));
        }

        // O Service aqui fará 3 coisas:
        // 1. Validar se o token existe e não expirou (10s).
        // 2. Validar se o cliente esperou o tempo mínimo aleatório (Anti-Bot).
        
        service.finalizeSharedSecret(windowToken, clientB);

        // como o segredo nao esta no corpo da requisição vamos dar seguimento nesta parte com outro token que sera pra validar a entrada do usuário lá na rota anonymous, a parte de checar se o token que calculei dar match nao sera mais considerado. Em vurtude disso passaremos mais um token de reentrada na response. 
        String secretCalculated = service.getSecretByToken(windowToken); 

        boolean isMatch = secretCalculated != null && secretCalculated.equalsIgnoreCase(debugSecretFromClient);

        return ResponseEntity.ok(Map.of(
            "status", "established",
            "match", isMatch,
            "message", isMatch ? "Túnel seguro estabelecido." : "Falha na sincronia de chaves."
        ));

    } catch (RuntimeException e) {
        // Captura erros de "Resposta rápida demais", "Timeout" ou "Token inválido"
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", e.getMessage()));
    } catch (Exception e) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Erro interno no handshake."));
    }
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

