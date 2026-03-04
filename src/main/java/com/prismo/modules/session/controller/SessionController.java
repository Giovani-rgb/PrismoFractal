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

    public SessionController(ServiceSession service) {
        this.service = service;
    }

    @PostMapping("/anonymous")
    public ResponseEntity<Map<String, Object>> createAnonymous(
            HttpServletRequest request,
            @RequestHeader(value = "User-Agent", defaultValue = "UNKNOWN") String userAgent
    ) {
        // Captura o IP real mesmo se estiver atrás de um Proxy (Nginx, Cloudflare, etc)
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isBlank()) {
            ip = request.getRemoteAddr();
        }

        // O Service gera o UUID e o JWT internamente e salva uma única vez
        Session session = service.createAnonymous(ip, userAgent);

        // Sanitiza e retorna o mapa (agora seguro contra NullPointerException)
        return ResponseEntity.ok(ResponseQueries.sanitize(session));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> revoke(@PathVariable UUID id) {

        service.revoke(id);

        return ResponseEntity.noContent().build();
    }
}