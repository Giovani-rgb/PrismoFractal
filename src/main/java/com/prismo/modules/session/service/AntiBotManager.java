package com.prismo.modules.session.service;

import com.prismo.modules.session.dto.AntiBotMetadata;
import com.prismo.modules.session.enums.AntiBotTokenType;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.random.RandomGenerator;

@Component
public class AntiBotManager {

    // Centralizamos todos os tokens no mesmo mapa, diferenciados pelo Enum interno
    private final Map<String, AntiBotMetadata> antiBotTokens = new ConcurrentHashMap<>();

    /**
     * Registra uma nova janela de reentrada de fluxo.
     */
    public Map<String, Object> createNewWindow(String token) {
        AntiBotMetadata meta = new AntiBotMetadata(token, AntiBotTokenType.REENTRY_WINDOW);
        antiBotTokens.put(token, meta);

        return Map.of(
            "reentryToken", token,
            "minWait", meta.getMinWaitSeconds(),
            "status", "window_established"
        );
    }

    /**
     * Emite um token de passagem de uso único para a rota anônima.
     */
    public Map<String, Object> generateAnonymousToken() {
        String token = UUID.randomUUID().toString();

        AntiBotMetadata meta = new AntiBotMetadata(token, AntiBotTokenType.ANONYMOUS_PASS);
        antiBotTokens.put(token, meta);

        return Map.of(
            "anonymousToken", token,
            "minWait", meta.getMinWaitSeconds(),
            "status", "established"
        );
    }
    

    public Map<String, Object> generateRefreshToken() {
        String token = UUID.randomUUID().toString();

        AntiBotMetadata meta = new AntiBotMetadata(token, AntiBotTokenType.REFRESH_PASS);
        antiBotTokens.put(token, meta);

        return Map.of(
            "refresh_Pass", token,
            "minWait", meta.getMinWaitSeconds(),
            "status", "Passporte_Autorizado"
        );
    }


    /**
     * Emite um token de congelamento (freezer) de longa duração para finalizar o fluxo.
     * Mantém a rota protegida sob as regras de 20 minutos definidas no Enum.
     */
    public Map<String, Object> generateFreezerToken() {
        String token = UUID.randomUUID().toString();

        AntiBotMetadata meta = new AntiBotMetadata(token, AntiBotTokenType.ANONYMOUS_FREEZER);
        antiBotTokens.put(token, meta);

        return Map.of(
            "freezerToken", token,
            "minWait", meta.getMinWaitSeconds(),
            "status", "frozen"
        );
    }
    

    /**
     * Consome e valida qualquer token genérico passando as validações anti-bot.
     */
    public void consumeAndValidateToken(String token, AntiBotTokenType expectedType) {
        AntiBotMetadata meta = antiBotTokens.remove(token);

        if (meta == null || meta.getType() != expectedType) {
            throw new RuntimeException("Token inválido, já utilizado ou com propósito incorreto.");
        }
        if (meta.isExpired()) {
            throw new RuntimeException("O limite de tempo do token (" + expectedType.getTtlSeconds() + "s) foi excedido.");
        }
        if (meta.isTooFast()) {
            throw new RuntimeException("Comportamento automatizado suspeito: resposta rápida demais para o fluxo de " + expectedType.name());
        }

        // Delay artificial dinâmico anti-paralelismo
        try { 
            long internalDelay = 20 + RandomGenerator.getDefault().nextInt(41); 
            Thread.sleep(internalDelay); 
        } catch (InterruptedException ignored) {}
    }

        /**
     * Valida um token de Freezer ativo sem removê-lo do mapa central (mantém vivo).
     * Garante conformidade de tipo e checa se o tempo limite já expirou.
     */
    public AntiBotMetadata peekActiveFreezerToken(String token) {
        AntiBotMetadata meta = antiBotTokens.get(token); // .get() mantém o token no ConcurrentHashMap

        if (meta == null || meta.getType() != AntiBotTokenType.ANONYMOUS_FREEZER) {
            throw new RuntimeException("Freeze token inválido, já utilizado ou inexistente.");
        }
        if (meta.isExpired()) {
            throw new RuntimeException("O limite de tempo do freeze token (" + AntiBotTokenType.ANONYMOUS_FREEZER.getTtlSeconds() + "s) foi excedido.");
        }
        
        return meta;
    }


    public void removeToken(String token) {
        antiBotTokens.remove(token);
    }
}
