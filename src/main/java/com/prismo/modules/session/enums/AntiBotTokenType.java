package com.prismo.modules.session.enums;

/**
 * Define os tipos de tokens gerenciados pelo sistema Anti-Bot,
 * centralizando suas regras de TTL (Time to Live) e comportamento.
 */
public enum AntiBotTokenType {

    /**
     * Janela de reentrada gerada para controle de fluxo.
     * Expira em 20 segundos.
     */
    REENTRY_WINDOW(20, 1.50, 0.30),

    /**
     * Tokens de passagem de uso único emitido na saída de /public e consumido em /anonymous, /refresh.
     * Expira estritamente em 15 segundos.
     */
    ANONYMOUS_PASS(15, 2.60, 0.30),
    
    REFRESH_PASS(15, 2.55, 0.30),
    /**
     * Token de finalização da rota "/anonymous".
     * Congela (freeza) a rota por 20 minutos (1200 segundos).
     */
    ANONYMOUS_FREEZER(1200, 19.60, 0.30);
    
    private final int ttlSeconds;
    private final double baseMinWaitSeconds;
    private final double randomFactor;

    AntiBotTokenType(int ttlSeconds, double baseMinWaitSeconds, double randomFactor) {
        this.ttlSeconds = ttlSeconds;
        this.baseMinWaitSeconds = baseMinWaitSeconds;
        this.randomFactor = randomFactor;
    }

    public int getTtlSeconds() {
        return ttlSeconds;
    }

    public double getBaseMinWaitSeconds() {
        return baseMinWaitSeconds;
    }

    public double getRandomFactor() {
        return randomFactor;
    }
}
