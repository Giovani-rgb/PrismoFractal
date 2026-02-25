package com.prismo.modules.session.service;

import com.prismo.modules.session.model.Session;
import com.prismo.modules.session.repository.SessionRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.UUID;

@Service
@Transactional // Garante que todas as operações ocorram dentro de uma transação
public class ServiceSession {

    private final SessionRepository repository;

    // Salt usado para evitar fingerprint previsível
    private static final String SECRET_SALT = "prismo-secret";

    // Tempo padrão de duração da sessão anônima
    private static final int SESSION_DURATION_HOURS = 12;

    public ServiceSession(SessionRepository repository) {
        this.repository = repository;
    }

    /**
     * Cria ou reutiliza uma sessão anônima baseada em fingerprint.
     *
     * Fluxo:
     * 1) Gera fingerprint determinística (ip + userAgent + salt)
     * 2) Verifica se já existe sessão ativa não revogada
     * 3) Se existir e ainda estiver válida -> reutiliza
     * 4) Caso contrário -> cria nova sessão
     */
    public Session createAnonymous(String ip, String userAgent) {

        LocalDateTime now = LocalDateTime.now();

        // Gera hash SHA-256 determinístico
        String fingerprint = generateFingerprint(ip, userAgent);

        return repository.findByTokenAndRevokedFalse(fingerprint)
                // Verifica se sessão ainda está válida
                .filter(session -> session.getExpiresAt().isAfter(now))

                // Se existir sessão válida, atualiza último acesso
                .map(session -> {
                    session.setLastAccessAt(now);
                    return session;
                })

                // Caso não exista ou esteja expirada, cria nova
                .orElseGet(() -> {
                    Session session = new Session();
                    session.setUserId(null); // null = sessão anônima
                    session.setToken(fingerprint);
                    session.setIpAddress(ip);
                    session.setUserAgent(userAgent);
                    session.setCountry("UNKNOWN");
                    session.setExpiresAt(now.plusHours(SESSION_DURATION_HOURS));
                    session.setRevoked(false);
                    session.setCreatedAt(now);
                    session.setLastAccessAt(now);

                    return repository.save(session);
                });
    }

    /**
     * Gera fingerprint determinística baseada em:
     * IP + UserAgent + SECRET_SALT
     *
     * Usa SHA-256 para evitar colisões simples
     */
    private String generateFingerprint(String ip, String userAgent) {
        try {
            String raw = ip + "|" + userAgent + "|" + SECRET_SALT;

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(raw.getBytes(StandardCharsets.UTF_8));

            return HexFormat.of().formatHex(hash);

        } catch (Exception e) {
            throw new RuntimeException("Erro ao gerar fingerprint", e);
        }
    }

    /**
     * Revoga uma sessão existente.
     * Não remove do banco (boa prática),
     * apenas marca como revogada.
     */
    public void revoke(UUID sessionId) {

        Session session = repository.findById(sessionId)
                .orElseThrow(() -> new EntityNotFoundException("Session não encontrada"));

        session.setRevoked(true);
        session.setExpiresAt(LocalDateTime.now());
    }
}