package com.prismo.modules.session.controller;

import com.prismo.modules.session.model.Session;
import com.prismo.modules.session.service.ServiceSession;
import com.prismo.modules.session.repository.ResponseQueries;
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

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(@RequestBody Session session) {
        Session created = service.create(
            session.getUserId(),
            session.getToken(),
            session.getIpAddress(),
            session.getUserAgent(),
            session.getCountry(),
            session.getExpiresAt()
        );
        return ResponseEntity.ok(ResponseQueries.sanitize(created));
    }

    @GetMapping("/{token}")
    public ResponseEntity<Map<String, Object>> getByToken(@PathVariable String token) {
        return service.findValidByToken(token)
                .map(session -> ResponseEntity.ok(ResponseQueries.sanitize(session)))
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> revoke(@PathVariable UUID id) {
        service.revoke(id);
        return ResponseEntity.noContent().build();
    }
}
