package com.prismo.modules.session.controller;

import com.prismo.modules.session.model.Session;
import com.prismo.modules.session.service.ServiceSession;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/sessions")
public class SessionController {

    private final ServiceSession service;

    public SessionController(ServiceSession service) {
        this.service = service;
    }

    /**
     * Cria ou reutiliza sessão anônima.
     *
     * O IP é extraído da request.
     * O User-Agent vem do header HTTP.
     */
    @PostMapping("/anonymous")
    public ResponseEntity<Session> createAnonymous(
            HttpServletRequest request,
            @RequestHeader(value = "User-Agent", required = false) String userAgent
    ) {

        // Obtém IP do cliente
        String ip = request.getRemoteAddr();

        // Fallback caso não venha user-agent
        if (userAgent == null) {
            userAgent = "UNKNOWN";
        }

        Session session = service.createAnonymous(ip, userAgent);

        return ResponseEntity.ok(session);
    }

    @GetMapping("/{token}")
    public ResponseEntity<Session> getByToken(@PathVariable String token) {
        return service.findValidByToken(token)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Revoga uma sessão pelo ID.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> revoke(@PathVariable UUID id) {

        service.revoke(id);

        return ResponseEntity.noContent().build();
    }
}