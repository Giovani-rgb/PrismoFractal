package com.prismo.dto;

import java.time.Instant;

public record SessionResponse(
    String id,
    String status,
    Instant createdAt,
    Instant lastAccessAt
) {}
