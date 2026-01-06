package com.prismo.session;

import com.prismo.domain.*;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Service
public class SessionServiceImpl implements SessionService {

    private final SessionRepository repository;

    public SessionServiceImpl(SessionRepository repository) {
        this.repository = repository;
    }

    @Override
    public Session create(HttpServletRequest request) {

        Session session = new Session(
            new SessionId(UUID.randomUUID()),
            SessionStatus.ACTIVE,
            Instant.now(),
            Instant.now()
        );

        return repository.save(session);
    }

    @Override
    public Session get(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            throw new IllegalArgumentException("Session ID is required");
        }
        return repository.findById(new SessionId(UUID.fromString(sessionId)))
            .orElseThrow(() -> new RuntimeException("Session não encontrada"));
    }

    @Override
    public void close(String sessionId) {
        repository.delete(new SessionId(UUID.fromString(sessionId)));
    }
}
