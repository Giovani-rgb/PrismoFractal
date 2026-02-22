package com.prismo.modules.session.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "session")
public class Session {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false, unique = true, length = 500)
    private String token;

    @Column(nullable = false, length = 45)
    private String ipAddress;

    @Column(nullable = false, length = 500)
    private String userAgent;

    @Column(length = 100)
    private String country;

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    @Column(nullable = false)
    private boolean revoked = false;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column
    private LocalDateTime lastAccessAt;

    // getters e setters
}