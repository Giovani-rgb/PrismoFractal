package com.prismo.modules.session.dto;

import com.prismo.modules.session.enums.AntiBotTokenType;
import java.time.LocalDateTime;
import java.util.random.RandomGenerator;

/**
 * Modelo de Contexto para validações de Timing Anti-Bot.
 */
public class AntiBotMetadata {
    private final String token;
    private final AntiBotTokenType type;
    private final LocalDateTime expiresAt;
    private final double minWaitSeconds;
    private final long createdAtMillis;

    public AntiBotMetadata(String token, AntiBotTokenType type) {
        this.token = token;
        this.type = type;
        this.expiresAt = LocalDateTime.now().plusSeconds(type.getTtlSeconds());
        this.createdAtMillis = System.currentTimeMillis();
        
        // Gera o tempo mínimo de espera dinâmico com base nas regras do Enum
        double randomNoise = RandomGenerator.getDefault().nextDouble() * type.getRandomFactor();
        this.minWaitSeconds = type.getBaseMinWaitSeconds() + randomNoise;
    }

    public boolean isExpired() {
        return LocalDateTime.now().isAfter(expiresAt);
    }

    public boolean isTooFast() {
        double elapsedSeconds = (System.currentTimeMillis() - this.createdAtMillis) / 1000.0;
        return elapsedSeconds < minWaitSeconds;
    }

    // Getters
    public String getToken() { return token; }
    public AntiBotTokenType getType() { return type; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public double getMinWaitSeconds() { return minWaitSeconds; }
    public long getCreatedAtMillis() { return createdAtMillis; }
}
