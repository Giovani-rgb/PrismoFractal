package com.prismo.session;

import com.prismo.domain.Session;
import com.prismo.domain.SessionId;

import java.util.Optional;

public interface SessionRepository {

    Session save(Session session);

    Optional<Session> findById(SessionId id);

    void delete(SessionId id);
}
