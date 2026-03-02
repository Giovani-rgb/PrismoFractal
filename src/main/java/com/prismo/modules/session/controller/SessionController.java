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
            @RequestHeader(value = "User-Agent", required = false) String userAgent
    ) {

        String ip = request.getRemoteAddr();

        if (userAgent == null) {
            userAgent = "UNKNOWN";
        }

        Session session = service.createAnonymous(ip, userAgent);

        // 🔥 Sanitiza antes de devolver
        Map<String, Object> response = ResponseQueries.sanitize(session);

        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> revoke(@PathVariable UUID id) {

        service.revoke(id);

        return ResponseEntity.noContent().build();
    }
}