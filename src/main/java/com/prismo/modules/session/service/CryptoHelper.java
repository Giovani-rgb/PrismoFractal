package com.prismo.modules.session.service;

import com.prismo.modules.session.dto.DiffieHellmanModel;
import org.springframework.stereotype.Component;

import java.math.BigInteger;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Encapsula a lógica matemática e os estados temporários do handshake.
 */
@Component
public class CryptoHelper {

    private final SecureRandom secureRandom = new SecureRandom();

    // Estados efêmeros movidos para cá
    private final Map<String, DiffieHellmanModel> dhContexts = new ConcurrentHashMap<>();
    private final Map<String, WindowMetadata> reentryWindows = new ConcurrentHashMap<>();
    private final Map<String, String> activeSecrets = new ConcurrentHashMap<>();

    // Tokens de passagem: emitidos na saída de /public, consumidos na entrada de /anonymous
    private final Map<String, AnonymousMetadata> anonymousPassTokens = new ConcurrentHashMap<>();
    
    private static final BigInteger P_DH = new BigInteger(
            "FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1" +
            "29024E088A67CC74020BBEA63B139B22514A08798E3404DD" +
            "EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245" +
            "E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED" +
            "EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3D" +
            "C2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F" +
            "83655D23DCA3AD961C62F356208552BB9ED529077096966D" +
            "670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B" +
            "E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9" +
            "DE2BCBF6955817183995497CEA956AE515D2261898FA0510" +
            "15728E5A8AACAA68FFFFFFFFFFFFFFFF", 16);
    private static final BigInteger G_DH = BigInteger.valueOf(2);

    public record WindowMetadata(
            LocalDateTime expiresAt,
            double minWait,
            long internalDelay,
            long createdAtMillis) {}
    
    // Record específico para a janela de Anonymous
    public record AnonymousMetadata(LocalDateTime expiresAt, double minWait, long createdAtMillis) {}

    public WindowMetadata createNewWindow(String token) {
        double minWait = 2.80 + (0.30 * secureRandom.nextDouble()); // Entre 2.8 e 3.1s
        long internalDelay = 20 + secureRandom.nextInt(41);

        WindowMetadata meta = new WindowMetadata(
                LocalDateTime.now().plusSeconds(45),
                minWait,
                internalDelay,
                System.currentTimeMillis()
        );
        reentryWindows.put(token, meta);
        return meta;
    }

    public DiffieHellmanModel generateDH(String token) {
        BigInteger _a = new BigInteger(2048, secureRandom).mod(P_DH);
        BigInteger A = G_DH.modPow(_a, P_DH);
        DiffieHellmanModel ctx = new DiffieHellmanModel(P_DH, G_DH, _a, A);
        dhContexts.put(token, ctx);
        return ctx;
    }

    public String calculateSharedSecret(String token, String clientB) {
        DiffieHellmanModel ctx = dhContexts.remove(token);
        if (ctx == null) throw new RuntimeException("Handshake inválido.");

        BigInteger b = new BigInteger(clientB, 16);
        String secret = b.modPow(ctx.get_a(), P_DH).toString(16);
        activeSecrets.put(token, secret);
        return secret;
    }

    public String getSecretByToken(String token) {
        return activeSecrets.get(token);
    }

    public WindowMetadata consumeWindow(String token) {
        return reentryWindows.remove(token);
    }

    /**
     * Emite um token de passagem de uso único com TTL de 15 segundos.
     * Chamado na saída do Stage 2 de /public.
     */
    /**
     * Gera o token de passagem e registra no mapa dedicado.
     */
    public Map<String, Object> generateAnonymousToken() {
        String token = UUID.randomUUID().toString();
        double minWait = 2.80 + (0.30 * secureRandom.nextDouble());

        anonymousPassTokens.put(token, new AnonymousMetadata(
                LocalDateTime.now().plusSeconds(15), // Expiração de 15s conforme solicitado
                minWait,
                System.currentTimeMillis()
        ));

        return Map.of(
            "anonymousToken", token,
            "minWait", minWait,
            "status", "established"
        );
    }

    /**
     * Consome o token de passagem validando timing e expiração.
     */
    public void consumeAnonymousToken(String token) {
        AnonymousMetadata meta = anonymousPassTokens.remove(token);

        if (meta == null) throw new RuntimeException("Token de passagem inválido ou já utilizado.");
        if (LocalDateTime.now().isAfter(meta.expiresAt())) throw new RuntimeException("Token expirado (15s).");

        double elapsed = (System.currentTimeMillis() - meta.createdAtMillis()) / 1000.0;
        if (elapsed < meta.minWait()) throw new RuntimeException("Resposta para rota anonymous rápida demais.");

        try { Thread.sleep(20); } catch (InterruptedException ignored) {}
    }


    public void fullCleanup(String token) {
        dhContexts.remove(token);
        reentryWindows.remove(token);
        activeSecrets.remove(token);
    }
}
