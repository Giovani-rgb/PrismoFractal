package com.prismo.domain;

import java.util.UUID;

public record SessionId(UUID value) {

    public static SessionId from(String raw) {
        return new SessionId(UUID.fromString(raw));
    }
}
