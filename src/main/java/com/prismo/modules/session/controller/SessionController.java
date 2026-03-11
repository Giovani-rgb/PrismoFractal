package com.prismo.modules.session.controller;

import com.prismo.modules.session.model.Session;
import com.prismo.modules.session.service.ServiceSession;
import com.prismo.modules.session.repository.ResponseQueries;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/sessions")
public class SessionController {

    private final ServiceSession service;
    // Agora injetamos o componente que gerencia a lógica de resposta/criptografia
    private final ResponseQueries responseQueries;

    // Injeção de dependência pelo construtor (o Spring cuida de tudo)
    public SessionController(ServiceSession service, ResponseQueries responseQueries) {
        this.service = service;
        this.responseQueries = responseQueries;
    }

    @PostMapping("/anonymous")
    public ResponseEntity<String> createAnonymous(
            HttpServletRequest request,
            @RequestHeader(value = "User-Agent", defaultValue = "UNKNOWN") String userAgent
    ) {
        // Captura o IP real
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isBlank()) {
            ip = request.getRemoteAddr();
        }

        // Cria a sessão
        Session session = service.createAnonymous(ip, userAgent);

        // O Controller não sabe mais que existe uma chave secreta envolvida.
        // O ResponseQueries gerencia isso internamente através da injeção do Spring.
        String encryptedResponse = responseQueries.sanitizeAndEncrypt(session);

        return ResponseEntity.ok(encryptedResponse);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> revoke(@PathVariable UUID id) {
        service.revoke(id);
        return ResponseEntity.noContent().build();
    }
}
