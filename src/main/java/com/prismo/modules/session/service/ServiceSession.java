package com.prismo.modules.session.service;

import com.prismo.config.JwtService; // Importado o novo serviço global
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
import java.util.Optional;
import java.util.UUID;

@Service
@Transactional
public class ServiceSession {

    private final SessionRepository repository;
    private final GeoLocationService geoLocationService;
    private final JwtService jwtService; // Injetado para centralizar a segurança

    public ServiceSession(SessionRepository repository,
                          GeoLocationService geoLocationService,
                          JwtService jwtService) {
        this.repository = repository;
        this.geoLocationService = geoLocationService;
        this.jwtService = jwtService;
    }

    /**
     * Cria uma nova sessão anônima.
     * Utiliza o JwtService global com expiração de 30 dias.
     */
    public Session createAnonymous(String ipAddress, String userAgent) {
        UUID sessionId = UUID.randomUUID();
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expiresAt = now.plusDays(30);

        // 30 dias em milissegundos para o JWT
        long thirtyDaysMillis = 30L * 24 * 60 * 60 * 1000;
        
        // Gera o token usando o serviço global centralizado
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

    /**
     * Gera o cookie HTTP-Only para transporte seguro.
     */
    public ResponseCookie generateSessionCookie(String encryptedValue) {
        return ResponseCookie.from("session_data", encryptedValue)
                .httpOnly(true)
                .secure(true) // Altere para false se testar em HTTP local sem SSL
                .path("/")
                .maxAge(Duration.ofDays(30)) // Sincronizado com o banco e JWT
                .sameSite("Lax")
                .build();
    }

    /**
     * Busca sessão válida (Leitura otimizada).
     */
    @Transactional(readOnly = true)
    public Optional<Session> findValidByToken(String token) {
        return repository.findByToken(token)
                .filter(s -> !s.isRevoked())
                .filter(s -> s.getExpiresAt().isAfter(LocalDateTime.now()));
    }

    /**
     * Revoga uma sessão pelo ID.
     */
    public void revoke(UUID sessionId) {
        Session session = repository.findById(sessionId)
                .orElseThrow(() -> new EntityNotFoundException("Session não encontrada"));
        session.setRevoked(true);
    }

    /**
     * Atualiza o timestamp de último acesso.
     */
    public void updateLastAccess(UUID sessionId) {
        Session session = repository.findById(sessionId)
                .orElseThrow(() -> new EntityNotFoundException("Session não encontrada"));
        session.setLastAccessAt(LocalDateTime.now());
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
}