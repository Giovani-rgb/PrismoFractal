package com.prismo.session;

import com.prismo.domain.Session;
import com.prismo.domain.SessionId;

import org.springframework.stereotype.Repository;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Repository
public class InMemorySessionRepository implements SessionRepository {

    private final Map<SessionId, Session> store = new ConcurrentHashMap<>();

    @Override
    public Session save(Session session) {
        store.put(session.getId(), session);
        return session;
    }

    @Override
    public Optional<Session> findById(SessionId id) {
        return Optional.ofNullable(store.get(id));
    }

    @Override
    public void delete(SessionId id) {
        store.remove(id);
    }
}
