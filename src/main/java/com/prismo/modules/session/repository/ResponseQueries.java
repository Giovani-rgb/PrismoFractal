package com.prismo.modules.session.repository;

import com.prismo.modules.session.model.Session;
import java.util.Map;

public final class ResponseQueries {

    private ResponseQueries() {}

    public static Map<String, Object> sanitize(Session session) {

        return Map.of(
            "id_prospect", session.getId(),   // UUID já é seguro
            "refs", session.getUserId(),     // userId tratado como refs
            "country", session.getCountry(),
            "revoked", session.isRevoked(),
            "keyUpdate", session.getKeyUpdate(),
            "createdAt", session.getCreatedAt(),
            "expiresAt", session.getExpiresAt(),
            "lastAccessAt", session.getLastAccessAt()
        );
    }
}