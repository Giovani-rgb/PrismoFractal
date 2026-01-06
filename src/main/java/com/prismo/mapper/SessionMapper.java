package com.prismo.mapper;

import com.prismo.domain.Session;
import com.prismo.dto.SessionResponse;

public class SessionMapper {

    public static SessionResponse toResponse(Session session) {
        return new SessionResponse(
            session.getId().value().toString(),
            session.getStatus().name(),
            session.getCreatedAt(),
            session.getLastAccessAt()
        );
    }
}
