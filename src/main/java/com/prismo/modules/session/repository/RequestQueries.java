package com.prismo.modules.session.repository;

import com.prismo.modules.session.model.Session;
import java.util.Set;

public final class RequestQueries {

    private RequestQueries() {}

    private static final Set<String> FILTERABLE_FIELDS = Set.of(
        "id",
        "ip",
        "country"
    );

    private static final Set<String> UPDATABLE_FIELDS = Set.of(
        "country",
        "userAgent"
    );

    public static void validateFilter(String field) {
        if (!FILTERABLE_FIELDS.contains(field)) {
            throw new IllegalArgumentException(
                "Campo não permitido para filtro em Session: " + field
            );
        }
    }

    public static void validateUpdate(String field) {
        if (!UPDATABLE_FIELDS.contains(field)) {
            throw new IllegalArgumentException(
                "Campo não permitido para update em Session: " + field
            );
        }
    }
}