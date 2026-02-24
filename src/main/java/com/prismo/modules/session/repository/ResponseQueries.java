package com.prismo.modules.session.repository;

import com.prismo.modules.session.model.Session;
import java.util.Set;
import java.util.Map;
import java.util.stream.Collectors;

public final class ResponseQueries {

    private ResponseQueries() {}

    private static final Set<String> EXPOSED_FIELDS = Set.of(
        "id",
        "ip",
        "country"
    );

    public static Map<String, Object> sanitize(Session session) {
        Map<String, Object> raw = Map.of(
            "id", session.getId(),
            "ip", session.getIp(),
            "userAgent", session.getUserAgent(),
            "country", session.getCountry()
        );

        return raw.entrySet()
                .stream()
                .filter(e -> EXPOSED_FIELDS.contains(e.getKey()))
                .collect(Collectors.toMap(
                    Map.Entry::getKey,
                    Map.Entry::getValue
                ));
    }
}