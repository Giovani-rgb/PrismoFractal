package com.prismo.modules.session.service;

import com.prismo.modules.session.model.Session;
import com.prismo.modules.session.repository.SessionRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class ServiceSession {

    private final SessionRepository repository;

    public ServiceSession(SessionRepository repository) {
        this.repository = repository;
    }

    public Session create(Session session) {
        session.setRevoked(false);
        return repository.save(session);
    }

    public Optional<Session> findValidByToken(String token) {
        return repository.findByToken(token)
                .filter(s -> !s.isRevoked())
                .filter(s -> s.getExpiresAt().isAfter(LocalDateTime.now()));
    }

    public List<Session> findActiveByUser(UUID userId) {
        return repository.findByUserIdAndRevokedFalse(userId);
    }

    public void revoke(UUID sessionId) {
        Session session = repository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Session não encontrada"));

        session.setRevoked(true);
        repository.save(session);
    }

    public void updateLastAccess(UUID sessionId) {
        Session session = repository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Session não encontrada"));

        session.setLastAccessAt(LocalDateTime.now());
        repository.save(session);
    }
}