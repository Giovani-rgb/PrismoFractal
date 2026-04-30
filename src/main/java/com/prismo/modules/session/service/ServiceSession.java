package com.prismo.modules.session.service;

import com.prismo.config.JwtService;
import com.prismo.modules.session.model.Session;
import com.prismo.modules.session.dto.DiffieHellmanModel;
import com.prismo.modules.session.repository.SessionRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Record para armazenar metadados da janela de reentrada com regras anti-bot.
 */
record WindowMetadata(
        LocalDateTime expiresAt,
        double minResponseTime,
        long internalProcessDelay,
        long createdAtMillis) {
}

@Service
@Transactional
public class ServiceSession {

    private final SessionRepository repository;
    private final GeoLocationService geoLocationService;
    private final JwtService jwtService;
    private final SecureRandom secureRandom = new SecureRandom();

    private final Map<String, DiffieHellmanModel> dhContexts = new ConcurrentHashMap<>();
    private final Map<String, String> activeSharedSecrets = new ConcurrentHashMap<>();
    private final Map<String, WindowMetadata> reentryWindows = new ConcurrentHashMap<>();

    private static final BigInteger P_DH = new BigInteger("FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1" +
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

    public ServiceSession(SessionRepository repository, GeoLocationService geoLocationService, JwtService jwtService) {
        this.repository = repository;
        this.geoLocationService = geoLocationService;
        this.jwtService = jwtService;
    }

    /**
     * ESTÁGIO 1: Gera Handshake DH e Janela de Reentrada com metadados
     * comportamentais.
     */
    public Map<String, Object> generateServerHandshake() {
        String token = UUID.randomUUID().toString();

        // Regras aleatórias de tempo
        double minResponse = 2.90 + (0.30 * secureRandom.nextDouble()); // 2.90 a 3.20s
        long internalDelay = 20 + secureRandom.nextInt(41); // 20ms a 60ms

        reentryWindows.put(token, new WindowMetadata(
                LocalDateTime.now().plusSeconds(45),
                minResponse,
                internalDelay,
                System.currentTimeMillis()));

        BigInteger _a = new BigInteger(2048, secureRandom).mod(P_DH);
        BigInteger A = G_DH.modPow(_a, P_DH);

        dhContexts.put(token, new DiffieHellmanModel(P_DH, G_DH, _a, A));

        return Map.of(
                "p", P_DH.toString(16),
                "g", G_DH.toString(16),
                "A", A.toString(16),
                "windowToken", token,
                "minWait", minResponse);
    }

    /**
     * ESTÁGIO 2: Finaliza o segredo compartilhado validando comportamento temporal.
     */
    public void finalizeSharedSecret(String token, String clientB) {
        validateAndConsumeWindow(token);

        DiffieHellmanModel ctx = dhContexts.remove(token);
        if (ctx == null)
            throw new RuntimeException("Handshake inválido ou expirado.");

        try {
            BigInteger b = new BigInteger(clientB, 16);
            BigInteger sharedSecret = b.modPow(ctx.get_a(), P_DH);
            activeSharedSecrets.put(token, sharedSecret.toString(16));
        } catch (Exception e) {
            throw new RuntimeException("Erro ao processar chave criptográfica.");
        }
    }
    
    /**
     * ROTA REFRESH: Apenas para passar no build. 
     * Busca a primeira sessão não revogada (temporário para desenvolvimento).
     */
    public Session refreshSessionData(String sessionCipher) {
        // TODO: Implementar extração de ID do sessionCipher via JWT no futuro
        return repository.findAll().stream()
                .filter(s -> !s.isRevoked())
                .findFirst()
                .orElseThrow(() -> new EntityNotFoundException("Nenhuma sessão ativa encontrada."));
    }

    private void validateAndConsumeWindow(String token) {
        WindowMetadata meta = reentryWindows.remove(token); // Consome para evitar reuso

        if (meta == null)
            throw new RuntimeException("Acesso negado: Janela inexistente.");

        // 1. Timeout Exception
        if (LocalDateTime.now().isAfter(meta.expiresAt())) {
            throw new RuntimeException("Timeout: A janela de reentrada expirou (45s).");
        }

        // 2. Validação de tempo mínimo (Anti-Bot)
        double elapsedSeconds = (System.currentTimeMillis() - meta.createdAtMillis()) / 1000.0;
        if (elapsedSeconds < meta.minResponseTime()) {
            throw new RuntimeException("Violação de integridade: Resposta rápida demais.");
        }

        // 3. Delay artificial/**

    public Session createAnonymous(String ipAddress, String userAgent) {
        UUID sessionId = UUID.randomUUID();
        String jwt = jwtService.generateToken(sessionId.toString(), 30L * 24 * 60 * 60 * 1000);

        Session session = new Session();
        session.setId(sessionId);
        session.setIpAddress(ipAddress);
        session.setUserAgent(userAgent);
        session.setCountry(resolveCountrySafely(ipAddress));
        session.setFingerprint(generateFingerprint(ipAddress, userAgent));
        session.setToken(jwt);
        session.setCreatedAt(LocalDateTime.now());
        session.setExpiresAt(LocalDateTime.now().plusDays(30));
        session.setRevoked(false);

        return repository.save(session);
    }

    public ResponseCookie generateSessionCookie(String encryptedValue) {
        return ResponseCookie.from("nameSessionKey", encryptedValue)
                .httpOnly(true).secure(true).path("/").maxAge(Duration.ofDays(30)).sameSite("Lax").build();
    }

    public void revoke(UUID sessionId) {
        Session session = repository.findById(sessionId)
                .orElseThrow(() -> new EntityNotFoundException("Session não encontrada"));
        session.setRevoked(true);
    }

    private String generateFingerprint(String ip, String userAgent) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest((ip + "|" + userAgent).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("Erro interno de hash");
        }
    }

    private String resolveCountrySafely(String ipAddress) {
        try {
            return geoLocationService.getCountryByIp(ipAddress);
        } catch (Exception e) {
            return "UNKNOWN";
        }
    }

    public String getSecretByToken(String token) {
        return activeSharedSecrets.get(token);
    }

    public void cleanup(String token) {
        reentryWindows.remove(token);
        dhContexts.remove(token);
        activeSharedSecrets.remove(token);
    }
}
