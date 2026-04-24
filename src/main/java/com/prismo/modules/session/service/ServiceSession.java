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

/**
 * HandshakeContext: Classe auxiliar para manter o estado matemático entre
 * estágios.
 */
class HandshakeContext {
    public final BigInteger privateA;
    public final BigInteger p;
    public final BigInteger g;
    public String sharedSecret; // Adicione este campo (não final)

    public HandshakeContext(BigInteger privateA, BigInteger p, BigInteger g) {
        this.privateA = privateA;
        this.p = p;
        this.g = g;
    }
}

@Service
@Transactional
public class ServiceSession {

    private final SessionRepository repository;
    private final GeoLocationService geoLocationService;
    private final JwtService jwtService;
    // Armazena: Key = WindowToken, Value = SharedSecret em Hex
    private final Map<String, String> activeSessions = new ConcurrentHashMap<>();
    // Memória temporária para vincular Estágio 1 ao Estágio 2
    private final Map<String, HandshakeContext> pendingHandshakes = new ConcurrentHashMap<>();
    private final Map<String, LocalDateTime> reentryWindows = new ConcurrentHashMap<>();

    // Grupo 14 RFC 3526 (2048-bit) - Definido como constante para performance
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

    public ServiceSession(SessionRepository repository,
            GeoLocationService geoLocationService,
            JwtService jwtService) {
        this.repository = repository;
        this.geoLocationService = geoLocationService;
        this.jwtService = jwtService;
    }

/**
 * ESTÁGIO 1: Drop de chave (p, g, A) e Window Token. 
 * "p" é o módulo primo (P_DH), "g" é o gerador (G_DH)
 * "A" é a chave pública do servidor (g^a mod p)
 * "a" é o segredo privado do servidor (iterador privado)
 */
public Map<String, Object> generateServerHandshake() {
    String windowToken = UUID.randomUUID().toString();

    System.out.println("\n\n");
    System.out.println("================================================================================");
    System.out.println(">>> [HANDSHAKE STAGE 1]: GERANDO MATERIAL CRIPTOGRÁFICO");
    System.out.println("--------------------------------------------------------------------------------");
    System.out.println(">>> Window Token: " + windowToken);

    // Gera segredo 'a' aleatório (Privado)
    BigInteger a = new BigInteger(2048, new SecureRandom()).mod(P_DH);
    
    // Calcula A = g^a mod p (Público)
    // Respondendo sua dúvida: Mantivemos "A" para não confundir com o primo "p".
    BigInteger A = G_DH.modPow(a, P_DH);

    System.out.println(">>> Private Key 'a' (Internal): " + a.toString(16).substring(0, 10) + "...");
    System.out.println(">>> Public Key 'A' (To Client): " + A.toString(16).substring(0, 10) + "...");

    // Armazena o contexto necessário para finalizar o cálculo no Stage 2
    pendingHandshakes.put(windowToken, new HandshakeContext(a, P_DH, G_DH));
    reentryWindows.put(windowToken, LocalDateTime.now().plusSeconds(45));

    Map<String, Object> drop = new HashMap<>();
    drop.put("p", P_DH.toString(16)); // Enviando em Hex para o Angular
    drop.put("g", G_DH.toString(16));
    drop.put("A", A.toString(16));
    drop.put("windowToken", windowToken);

    System.out.println("--------------------------------------------------------------------------------");
    System.out.println(">>> [STATUS]: Contexto salvo. Aguardando Stage 2 do cliente...");
    System.out.println("================================================================================");
    System.out.println("\n\n");

    return drop;
}


    /**
     * Gera um token de janela de reentrada (Anti-REST) com validade de 45 segundos.
     * Utilizado para validar o fluxo entre interações rápidas do cliente.
     */
    public String generateReentryWindow() {
        String token = UUID.randomUUID().toString();
        reentryWindows.put(token, LocalDateTime.now().plusSeconds(45));
        return token;
    }

    /**
     * Recupera o segredo calculado para conferência ou uso posterior.
     */
    public String getSecretByToken(String token) {
        String secret = activeSessions.get(token);

        System.out.println("\n[Service-Lookup] Buscando segredo para o token: " + token);
        if (secret != null) {
            System.out.println("[Service-Lookup] Segredo encontrado: " + secret.substring(0, 8) + "...");
        } else {
            System.err.println("[Service-Lookup] !!! NENHUM SEGREDO ENCONTRADO !!!");
        }

        return secret;
    }

    /**
     * ESTÁGIO 2: Finaliza o cálculo matemático com o produto B do cliente.
     */
    public void finalizeSharedSecret(String token, String clientB) {
    validateReentryWindow(token);

    HandshakeContext ctx = pendingHandshakes.get(token);
    if (ctx == null) {
        System.err.println("\n\n[!!!] CONTEXTO NÃO ENCONTRADO PARA O TOKEN: " + token);
        throw new RuntimeException("Contexto de Handshake não encontrado ou expirado.");
    }

    try {
        System.out.println("\n\n");
        System.out.println("================================================================================");
        System.out.println(">>> [OPERACAO MATEMATICA]: FINALIZANDO SHARED SECRET");
        System.out.println("--------------------------------------------------------------------------------");
        System.out.println("TOKEN: " + token);
        System.out.println("INPUT CLIENT B: " + clientB);

        // S = B^a mod p
        BigInteger b = new BigInteger(clientB, 16);
        BigInteger sharedSecret = b.modPow(ctx.privateA, ctx.p);

        String secretHex = sharedSecret.toString(16);

        System.out.println(">>> CÁLCULO CONCLUÍDO:");
        System.out.println(">>> SHARED SECRET (S): " + secretHex);
        System.out.println("--------------------------------------------------------------------------------");

        // PERSISTÊNCIA: Salvando o segredo calculado no mapa de sessões ativas
        this.activeSessions.put(token, secretHex);

        System.out.println(">>> [STATUS]: Segredo vinculado ao token no activeSessions.");
        System.out.println("================================================================================");
        System.out.println("\n\n");

    } catch (Exception e) {
        System.err.println("\n\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        System.err.println(">>> [ERRO NO CALCULO DH]: " + e.getMessage());
        System.err.println("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n\n");
        throw new RuntimeException("Erro ao processar chave B: " + e.getMessage());
    }
}


    /**
     * Persiste o contexto matemático gerado no Estágio 1.
     * Vincula o segredo 'a' e os parâmetros P e G ao windowToken.
     */
    public void saveHandshakeContext(String token, Map<String, Object> params) {
        // Realizamos o cast seguro dos valores que vieram do generateServerHandshake
        // p e g são constantes, mas recuperamos para manter a integridade do contexto
        HandshakeContext ctx = new HandshakeContext(
                new BigInteger(params.get("A").toString(), 16), // Na verdade, aqui guardamos o 'a' privado se
                                                                // necessário,
                P_DH,
                G_DH);

        pendingHandshakes.put(token, ctx);
    }

    /**
     * Valida e consome a janela de reentrada.
     */
    public String consumeReentryWindow(String token) {
        validateReentryWindow(token);
        // Removemos o token de janela apenas após o uso bem-sucedido no controller
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

    public void cleanup(String token) {
        reentryWindows.remove(token);
        pendingHandshakes.remove(token);
    }
}
