package com.prismo.modules.session.controller;

import com.prismo.modules.session.model.Session;
import com.prismo.modules.session.service.ServiceSession;
import com.prismo.modules.session.repository.ResponseQueries;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
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
     * Endpoint para criar sessão anônima com Drop de Cookie.
     */
    @PostMapping("/anonymous")
    public ResponseEntity<Map<String, String>> createAnonymous(
            HttpServletRequest request,
            @RequestHeader(value = "User-Agent", defaultValue = "UNKNOWN") String userAgent
    ) {
        // 1. Captura o IP real
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isBlank()) {
            ip = request.getRemoteAddr();
        }

        // 2. Cria a sessão no banco e gera o JWT interno
        Session session = service.createAnonymous(ip, userAgent);

        // 3. Sanitiza e criptografa os dados para a resposta JSON
        Map<String, String> encryptedResponse = responseQueries.sanitizeAndEncrypt(session);

        // 4. Gera o Cookie usando o ciphertext (valor criptografado)
        // Isso garante que o que está no cookie é o mesmo que o Angular recebeu
        String cookieValue = encryptedResponse.get("ciphertext");
        ResponseCookie sessionCookie = service.generateSessionCookie(cookieValue);

        // 5. Retorna o JSON no corpo E o cookie no Header Set-Cookie
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, sessionCookie.toString())
                .body(encryptedResponse);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> revoke(@PathVariable UUID id) {
        service.revoke(id);
        return ResponseEntity.noContent().build();
    }
}