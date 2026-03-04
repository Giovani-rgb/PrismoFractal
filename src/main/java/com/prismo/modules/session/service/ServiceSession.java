package com.prismo.modules.session.service;

import com.prismo.modules.session.model.Session;
import com.prismo.modules.session.repository.SessionRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import javax.crypto.SecretKey;

@Service
@Transactional
public class ServiceSession {

    private final SessionRepository repository;
    private final GeoLocationService geoLocationService;

    // ⚠️ Em produção isso deve vir de configuração (.env / application.yml)
    private final SecretKey secretKey =
            Keys.hmacShaKeyFor("super-secret-key-super-secret-key-123456".getBytes());

    public ServiceSession(SessionRepository repository,
                          GeoLocationService geoLocationService) {
        this.repository = repository;
        this.geoLocationService = geoLocationService;
    }

    /**
     * Cria uma nova sessão anônima realizando apenas um INSERT no banco.
     * * Fluxo Otimizado:
     * 1) Gera ID (UUID) manualmente
     * 2) Resolve geolocalização e metadados
     * 3) Gera o JWT usando o ID pré-gerado
     * 4) Salva a entidade completa de uma única vez
     */
    public Session createAnonymous(String ipAddress, String userAgent) {
        // 1️⃣ Geração manual do ID para evitar múltiplos saves
        UUID sessionId = UUID.randomUUID();

        // 2️⃣ Definição de datas e metadados
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expiresAt = now.plusDays(30);
        String country = resolveCountrySafely(ipAddress);
        String fingerprint = generateFingerprint(ipAddress, userAgent);

        // 3️⃣ Geração do JWT usando o ID que acabamos de criar
        String jwt = generateJwt(sessionId, expiresAt);

        // 4️⃣ Construção da entidade Session completa
        Session session = new Session();
        session.setId(sessionId); // Define o ID manualmente
        session.setUserId(null);
        session.setIpAddress(ipAddress);
        session.setUserAgent(userAgent);
        session.setCountry(country);
        session.setFingerprint(fingerprint);
        session.setToken(jwt);
        session.setCreatedAt(now);
        session.setLastAccessAt(now);
        session.setExpiresAt(expiresAt);
        session.setRevoked(false);

        // 5️⃣ Persistência única
        return repository.save(session);
    }

    /**
     * Busca sessão válida por token.
     */
    public Optional<Session> findValidByToken(String token) {
        return repository.findByToken(token)
                .filter(s -> !s.isRevoked())
                .filter(s -> s.getExpiresAt().isAfter(LocalDateTime.now()));
    }

    /**
     * Lista sessões ativas de um usuário.
     */
    public List<Session> findActiveByUser(UUID userId) {
        return repository.findByUserIdAndRevokedFalse(userId);
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
     * Atualiza último acesso.
     */
    public void updateLastAccess(UUID sessionId) {
        Session session = repository.findById(sessionId)
                .orElseThrow(() -> new EntityNotFoundException("Session não encontrada"));

        session.setLastAccessAt(LocalDateTime.now());
    }

    /**
     * Gera fingerprint baseado em IP + UserAgent.
     * Isso NÃO é identidade. É apenas heurística.
     */
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

    /**
     * Resolve país via IP.
     * Se falhar, retorna UNKNOWN.
     */
    private String resolveCountrySafely(String ipAddress) {
        try {
            return geoLocationService.getCountryByIp(ipAddress);
        } catch (Exception e) {
            return "UNKNOWN";
        }
    }

    /**
     * Gera JWT contendo:
     * - subject = ID da sessão
     * - issuedAt
     * - expiration sincronizada com expiresAt da sessão
     */
    private String generateJwt(UUID sessionId, LocalDateTime expiresAt) {

        return Jwts.builder()
                .setSubject(sessionId.toString())
                .setIssuedAt(new Date())
                .setExpiration(Date.from(
                        expiresAt.atZone(ZoneId.systemDefault()).toInstant()
                ))
                .signWith(secretKey)
                .compact();
    }
}