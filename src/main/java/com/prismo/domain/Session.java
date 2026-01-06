package com.prismo.domain;

import java.time.Instant;

public class Session {

    private final SessionId id;
    private SessionStatus status;
    private final Instant createdAt;
    private Instant lastAccessAt;

    public Session(SessionId id,
                   SessionStatus status,
                   Instant createdAt,
                   Instant lastAccessAt) {
        this.id = id;
        this.status = status;
        this.createdAt = createdAt;
        this.lastAccessAt = lastAccessAt;
    }

    public void touch() {
        this.lastAccessAt = Instant.now();
    }

    public void close() {
        this.status = SessionStatus.CLOSED;
    }

    // -------- getters --------

    public SessionId getId() {
        return id;
    }

    public SessionStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getLastAccessAt() {
        return lastAccessAt;
    }
}
