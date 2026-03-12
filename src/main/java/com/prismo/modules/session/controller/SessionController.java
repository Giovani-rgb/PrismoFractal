package com.prismo.modules.session.controller;

import com.prismo.modules.session.model.Session;
import com.prismo.modules.session.service.ServiceSession;
import com.prismo.modules.session.repository.ResponseQueries;

import jakarta.servlet.http.HttpServletRequest;
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
     * Endpoint para criar sessão anônima.
     * Alterado para retornar ResponseEntity<Map<String, String>> para garantir
     * que o Jackson converta o resultado em um objeto JSON estruturado.
     */
    @PostMapping("/anonymous")
    public ResponseEntity<Map<String, String>> createAnonymous(
            HttpServletRequest request,
            @RequestHeader(value = "User-Agent", defaultValue = "UNKNOWN") String userAgent
    ) {
        // Captura o IP real (tratando proxy)
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isBlank()) {
            ip = request.getRemoteAddr();
        }

        // 1. Cria a sessão no banco/memória
        Session session = service.createAnonymous(ip, userAgent);

        // 2. O ResponseQueries agora retorna um Map contendo 'iv' e 'ciphertext'
        // Isso resolve o erro de fluxo no Angular, que esperava um objeto e recebia String.
        Map<String, String> encryptedResponse = responseQueries.sanitizeAndEncrypt(session);

        // 3. Retorna o Map. O Spring enviará Content-Type: application/json
        return ResponseEntity.ok(encryptedResponse);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> revoke(@PathVariable UUID id) {
        service.revoke(id);
        return ResponseEntity.noContent().build();
    }
}