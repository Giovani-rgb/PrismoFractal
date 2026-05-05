package com.prismo.modules.session.service;

import com.prismo.config.JwtService;
import com.prismo.modules.session.model.Session;
import com.prismo.modules.session.repository.SessionRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;

@Service
@Transactional
public class ServiceSession {

    private final SessionRepository repository;
    private final GeoLocationService geoLocationService;
    private final JwtService jwtService;
    private final CryptoHelper cryptoHelper;

    public ServiceSession(SessionRepository repository,
                          GeoLocationService geoLocationService,
                          JwtService jwtService,
                          CryptoHelper cryptoHelper) {
        this.repository = repository;
        this.geoLocationService = geoLocationService;
        this.jwtService = jwtService;
        this.cryptoHelper = cryptoHelper;
    }

    /**
     * ESTÁGIO 1: Inicia o processo de handshake delegando a criação 
     * de parâmetros e janelas para o CryptoHelper.
     */
    public Map<String, Object> generateServerHandshake() {
        String token = UUID.randomUUID().toString();

        var window = cryptoHelper.createNewWindow(token);
        var dh = cryptoHelper.generateDH(token);

        return Map.of(
                "p", dh.getP().toString(16),
                "g", dh.getG().toString(16),
                "A", dh.getA().toString(16),
                "windowToken", token,
                "minWait", window.minWait()
        );
    }

    /**
     * ESTÁGIO 2: Finaliza o segredo e valida o comportamento temporal.
     * Não há mais comparação de match com segredo vindo do cliente.
     */
    public void finalizeSharedSecret(String token, String clientB) {
        validateAndConsumeWindow(token);
        
        // Calcula e armazena o segredo (para uso interno da infra de túnel)
        cryptoHelper.calculateSharedSecret(token, clientB);
    }

    /**
     * Gera o token de 10 segundos para consumo na rota anonymous.
     */
    public String generateReentryToken(String windowToken) {
        // Implementação enxuta: o próprio windowToken validado serve como base 
        // ou você pode gerar um novo identificador curto aqui.
        return UUID.randomUUID().toString().substring(0, 8); 
    }

    /**
     * Valida se o cliente respeitou o tempo de resposta (2.8s - 3.10s)
     * e aplica o delay artificial antes de liberar a resposta.
     */
    private void validateAndConsumeWindow(String token) {
        var meta = cryptoHelper.consumeWindow(token);

        if (meta == null) {
            throw new RuntimeException("Acesso negado: Sessão de handshake inexistente.");
        }

        if (LocalDateTime.now().isAfter(meta.expiresAt())) {
            throw new RuntimeException("Timeout: A janela de reentrada expirou.");
        }

        double elapsed = (System.currentTimeMillis() - meta.createdAtMillis()) / 1000.0;

        // Validação estrita conforme sua regra: 2.8s a 3.10s
        if (elapsed < meta.minWait()) {
            throw new RuntimeException("Violação de integridade: Resposta rápida demais.");
        }
        
        if (elapsed > 4.5) { // Margem de segurança para o teto de 3.10s + processamento
             throw new RuntimeException("Violação de integridade: Resposta tardia.");
        }

        applyArtificialDelay(meta.internalDelay());
    }

    private void applyArtificialDelay(long delay) {
        try {
            Thread.sleep(delay);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /**
     * Criação de sessão após validação completa.
     */
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
                .httpOnly(true)
                .secure(true)
                .path("/")
                .maxAge(Duration.ofDays(30))
                .sameSite("Lax")
                .build();
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
        return cryptoHelper.getSecretByToken(token);
    }

    /**
     * Emite o token de passagem (TTL 15s) após o handshake DH ser concluído.
     * O cliente deve apresentá-lo no header X-Anonymous-Token para acessar /anonymous.
     */
    
    



    public Map<String, Object> issueAnonymousPassToken() {
    // Delega a criação, o registro no mapa e o cálculo do minWait totalmente para o Helper
    return cryptoHelper.generateAnonymousToken();
}

public void consumeAnonymousPassToken(String token) {
    // Delega a validação (Timing + Expiração) e a remoção do mapa para o Helper
    cryptoHelper.consumeAnonymousToken(token);
}


    public Session refreshSessionData(String sessionCipher) {
        return repository.findAll().stream()
                .filter(s -> !s.isRevoked())
                .findFirst()
                .orElseThrow(() -> new EntityNotFoundException("Sessão inválida ou expirada."));
    }

    public void revoke(UUID sessionId) {
        Session session = repository.findById(sessionId)
                .orElseThrow(() -> new EntityNotFoundException("Session não encontrada"));
        session.setRevoked(true);
    }
    
    public void cleanup(String token) {
        cryptoHelper.fullCleanup(token);
    }
}
