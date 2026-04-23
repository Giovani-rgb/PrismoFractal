package com.prismo.modules.session.service;

import com.prismo.config.JwtService;
import com.prismo.modules.session.model.Session;
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
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Transactional
public class ServiceSession {

    private final SessionRepository repository;
    private final GeoLocationService geoLocationService;
    private final JwtService jwtService;

    // Estado temporário para o handshake matemático
    private final Map<String, BigInteger> pendingPrivates = new ConcurrentHashMap<>();
    private final Map<String, LocalDateTime> reentryWindows = new ConcurrentHashMap<>();
    private final Map<String, BigInteger> establishedSecrets = new ConcurrentHashMap<>();

    // Grupo 14 RFC 3526 (2048-bit)
    private final BigInteger p = new BigInteger("FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1" +
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
    private final BigInteger g = BigInteger.valueOf(2);

    public ServiceSession(SessionRepository repository,
                          GeoLocationService geoLocationService,
                          JwtService jwtService) {
        this.repository = repository;
        this.geoLocationService = geoLocationService;
        this.jwtService = jwtService;
    }

    /**
     * ESTÁGIO 1: Drop de chave (p, g, A) e Window Token.
     */
    public Map<String, Object> generateServerHandshake() {
        String windowToken = UUID.randomUUID().toString();
        BigInteger a = new BigInteger(2048, new SecureRandom()).mod(p);
        BigInteger A = g.modPow(a, p);

        pendingPrivates.put(windowToken, a);
        reentryWindows.put(windowToken, LocalDateTime.now().plusSeconds(45));

        Map<String, Object> drop = new HashMap<>();
        drop.put("p", p.toString(16));
        drop.put("g", g.toString(16));
        drop.put("A", A.toString(16)); // Produto da interação secreta
        drop.put("windowToken", windowToken);
        
        return drop;
    }

    /**
     * ESTÁGIO 2: Finaliza o cálculo matemático com o produto B do cliente.
     */
    public void finalizeSharedSecret(String windowToken, String clientPublicKeyB) {
        try {
            System.out.println("[DEBUG] Iniciando Finalize para Token: " + windowToken);

            BigInteger a = pendingPrivates.get(windowToken);
            if (a == null) {
                System.err.println("[ERRO] Token não encontrado no pendingPrivates!");
                throw new RuntimeException("Sessão de handshake inválida.");
            }

            if (clientPublicKeyB == null) throw new RuntimeException("Chave B ausente.");

            // Limpeza preventiva
            String cleanB = clientPublicKeyB.trim().replaceAll("[^0-9a-fA-F]", "");
            BigInteger B = new BigInteger(cleanB, 16);

            // O check crítico: p não pode ser null
            if (this.p == null) {
                System.err.println("[ERRO] O parâmetro primo 'p' está nulo!");
                throw new RuntimeException("Configuração DH incompleta no servidor.");
            }

            BigInteger sharedSecret = B.modPow(a, this.p);

            System.out.println("\n=================================================");
            System.out.println("DEBUG HANDSHAKE - STAGE 2 SUCCESS");
            System.out.println("Shared Secret (HEX): " + sharedSecret.toString(16));
            System.out.println("=================================================\n");

            establishedSecrets.put(windowToken, sharedSecret);
            reentryWindows.put(windowToken, LocalDateTime.now().plusSeconds(60));
            pendingPrivates.remove(windowToken); 

        } catch (Exception e) {
            System.err.println("[FATAL] Erro no Estágio 2: " + e.getMessage());
            e.printStackTrace(); // Isso vai te dar a linha exata no console do Replit
            throw e;
        }
    }


    /**
     * Gera um token de janela de reentrada (Anti-REST) com validade de 45 segundos.
     * Este token vincula o estágio de handshake à finalização da chave e criação da sessão.
     */
    public String generateReentryWindow() {
        String token = UUID.randomUUID().toString();
        // Define o tempo limite para a próxima interação matemática ou de negócio
        reentryWindows.put(token, LocalDateTime.now().plusSeconds(45));
        return token;
    }


    /**
     * Cria a sessão anônima preservando toda a lógica de fingerprint e localização.
     */
    public Session createAnonymous(String ipAddress, String userAgent) {
        UUID sessionId = UUID.randomUUID();
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expiresAt = now.plusDays(30);

        long thirtyDaysMillis = 30L * 24 * 60 * 60 * 1000;
        String jwt = jwtService.generateToken(sessionId.toString(), thirtyDaysMillis);

        Session session = new Session();
        session.setId(sessionId);
        session.setIpAddress(ipAddress);
        session.setUserAgent(userAgent);
        session.setCountry(resolveCountrySafely(ipAddress));
        session.setFingerprint(generateFingerprint(ipAddress, userAgent));
        session.setToken(jwt);
        session.setCreatedAt(now);
        session.setLastAccessAt(now);
        session.setExpiresAt(expiresAt);
        session.setRevoked(false);

        return repository.save(session);
    }

    public ResponseCookie generateSessionCookie(String encryptedValue) {
        return ResponseCookie.from("nameSessionKey", encryptedValue)
                .httpOnly(true)
                .secure(true)
                .path("/")
                .maxAge(Duration.ofDays(30))
                .sameSite("Lax")
                .build();
    }

    public Session refreshSessionData(String sessionCipher) {
        // Implementar lógica de busca por token descriptografado
        return repository.findAll().stream().filter(s -> !s.isRevoked()).findFirst()
                .orElseThrow(() -> new EntityNotFoundException("Sessão inválida"));
    }

    public void validateReentryWindow(String token) {
        if (token == null || token.isBlank() || !reentryWindows.containsKey(token)) {
            throw new RuntimeException("Acesso negado: Janela inválida.");
        }
        if (LocalDateTime.now().isAfter(reentryWindows.get(token))) {
            cleanup(token);
            throw new RuntimeException("Acesso negado: Janela expirada.");
        }
    }

    public String consumeReentryWindow(String token) {
        validateReentryWindow(token);
        return token;
    }

    public void revoke(UUID sessionId) {
        Session session = repository.findById(sessionId)
                .orElseThrow(() -> new EntityNotFoundException("Session não encontrada"));
        session.setRevoked(true);
    }

    private String generateFingerprint(String ip, String userAgent) {
        try {
            String raw = ip + "|" + userAgent;
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("Erro ao gerar fingerprint", e);
        }
    }

    private String resolveCountrySafely(String ipAddress) {
        try {
            return geoLocationService.getCountryByIp(ipAddress);
        } catch (Exception e) {
            return "UNKNOWN";
        }
    }

    private void cleanup(String token) {
        reentryWindows.remove(token);
        pendingPrivates.remove(token);
        establishedSecrets.remove(token);
    }
}
