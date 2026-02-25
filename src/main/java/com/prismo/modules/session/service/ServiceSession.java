package com.prismo.modules.session.service;

import com.prismo.modules.session.model.Session;
import com.prismo.modules.session.repository.SessionRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@Transactional
public class ServiceSession {

    private final SessionRepository repository;

    public ServiceSession(SessionRepository repository) {
        this.repository = repository;
    }

    /**
     * Cria uma nova sessão preenchendo todos os campos obrigatórios.
     */
    public Session create(
            UUID userId,
            String token,
            String ipAddress,
            String userAgent,
            String country,
            LocalDateTime expiresAt
    ) {

        if (token == null || token.isBlank()) {
            throw new IllegalArgumentException("Token JWT não pode ser nulo ou vazio");
        }

        Session session = new Session();
        session.setUserId(userId);
        session.setToken(token);
        session.setIpAddress(ipAddress);
        session.setUserAgent(userAgent);
        session.setCountry(country);
        session.setExpiresAt(expiresAt);
        session.setRevoked(false);
        session.setCreatedAt(LocalDateTime.now());
        session.setLastAccessAt(LocalDateTime.now());

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
                .orElseThrow(() -> new EntityNotFoundException("Session não encontrada"));

        session.setRevoked(true);
    }

    public void updateLastAccess(UUID sessionId) {
        Session session = repository.findById(sessionId)
                .orElseThrow(() -> new EntityNotFoundException("Session não encontrada"));

        session.setLastAccessAt(LocalDateTime.now());
    }
}