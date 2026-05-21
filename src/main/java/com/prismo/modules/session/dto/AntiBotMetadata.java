package com.prismo.modules.session.dto;

import com.prismo.modules.session.enums.AntiBotTokenType;
import java.time.Duration;
import java.time.Instant;
import java.util.random.RandomGenerator;

/**
 * Modelo de Contexto para validações de Timing Anti-Bot.
 */
public class AntiBotMetadata {
    private final String token;
    private final AntiBotTokenType type;
    private final Instant expiresAt;
    private final double minWaitSeconds;
    private final Instant createdAt;

    public AntiBotMetadata(String token, AntiBotTokenType type) {
        this.token = token;
        this.type = type;
        this.createdAt = Instant.now();
        this.expiresAt = this.createdAt.plusSeconds(type.getTtlSeconds());

        // Gera o tempo mínimo de espera dinâmico com base nas regras do Enum
        double randomNoise = RandomGenerator.getDefault().nextDouble() * type.getRandomFactor();
        this.minWaitSeconds = type.getBaseMinWaitSeconds() + randomNoise;
    }

    public boolean isExpired() {
        return Instant.now().isAfter(expiresAt);
    }

    public boolean isTooFast() {
        double elapsedSeconds = Duration.between(createdAt, Instant.now()).toMillis() / 1000.0;
        return elapsedSeconds < minWaitSeconds;
    }

    // Getters
    public String getToken() { return token; }
    public AntiBotTokenType getType() { return type; }
    public Instant getExpiresAt() { return expiresAt; }
    public double getMinWaitSeconds() { return minWaitSeconds; }
    public Instant getCreatedAt() { return createdAt; }
}
