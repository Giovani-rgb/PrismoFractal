package com.prismo.modules.session.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prismo.config.JwtService;
import com.prismo.modules.session.dto.DiffieHellmanModel;
import com.prismo.modules.session.model.Session;
import com.prismo.modules.session.repository.ResponseQueries;
import com.prismo.modules.session.repository.SessionRepository;
import jakarta.persistence.EntityNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private static final Logger log = LoggerFactory.getLogger(ServiceSession.class);

    private final SessionRepository  repository;
    private final GeoLocationService geoLocationService;
    private final JwtService         jwtService;
    private final CryptoHelper       cryptoHelper;
    private final ResponseQueries    responseQueries;
    private final ObjectMapper       objectMapper = new ObjectMapper();

    public ServiceSession(SessionRepository repository,
                          GeoLocationService geoLocationService,
                          JwtService jwtService,
                          CryptoHelper cryptoHelper,
                          ResponseQueries responseQueries) {
        this.repository      = repository;
        this.geoLocationService = geoLocationService;
        this.jwtService      = jwtService;
        this.cryptoHelper    = cryptoHelper;
        this.responseQueries = responseQueries;
    }

    // =========================================================================
    // HANDSHAKE PÚBLICO
    // =========================================================================

    public Map<String, Object> handlePublicInit() {
        log.info("[SERVICE SESSION - FASE 1] Inicializando contexto seguro para nova conexão.");
        String windowToken = UUID.randomUUID().toString();
        Map<String, Object> publicPayload = cryptoHelper.initiatePublicContext(windowToken);
        log.debug("[SERVICE SESSION - FASE 1] Parâmetros DH gerados para token: {}", windowToken);
        return publicPayload;
    }

    public Map<String, Object> handlePublicFinalize(String windowToken, String clientBHex) {
        log.info("[SERVICE SESSION - FASE 2] Recebido retorno do cliente. Token: {}", windowToken);
        Map<String, Object> publicHandshakeResult = cryptoHelper.finalizePublicHandshake(windowToken, clientBHex);

        @SuppressWarnings("unchecked")
        Map<String, Object> anonymousPass = (Map<String, Object>) publicHandshakeResult.get("anonymousPass");

        log.info("[SERVICE SESSION - FASE 2] Handshake fechado. Passaporte /anonymous emitido.");
        return anonymousPass;
    }

    // =========================================================================
    // REIDRATAÇÃO VIA FREEZE TOKEN (POST /public com payload encriptado)
    // =========================================================================

    /**
     * Reidratação de sessão via Freeze Token.
     * <p>
     * O cliente envia o freezeToken (persistido no vault local) junto com um payload
     * AES-256-GCM contendo { id_prospect, ts }. O servidor:
     * <ol>
     *   <li>Recupera o sharedSecret via freezeToken (dhContexts em RAM)</li>
     *   <li>Decifra o payload de identificação</li>
     *   <li>Localiza e valida a sessão pelo id_prospect</li>
     *   <li>Retorna a sessão re-encriptada com o MESMO sharedSecret</li>
     * </ol>
     *
     * @param freezeToken O token de congelamento gerado no upgrade /anonymous → Freezer
     * @param iv          IV Base64 do payload encriptado pelo cliente
     * @param ciphertext  Ciphertext Base64 do payload encriptado pelo cliente
     * @return Sessão re-encriptada com o sharedSecret do freezeToken
     */
    public Map<String, String> handleFreezeRehydrate(String freezeToken, String iv, String ciphertext) {
        log.info("[SERVICE SESSION - REHYDRATE] Reidratação via freeze token: {}...",
                freezeToken.substring(0, Math.min(8, freezeToken.length())));

        // 1. Recupera o sharedSecret associado ao freezeToken
        String sharedSecret = getSecretByToken(freezeToken);
        if (sharedSecret == null) {
            log.warn("[REHYDRATE] Freeze token inválido ou sessão expirada no servidor: {}",
                    freezeToken.substring(0, 8));
            throw new RuntimeException("Freeze token inválido — sessão expirada ou servidor reiniciado.");
        }

        // 2. Decifra o payload de identificação enviado pelo cliente
        String json = responseQueries.decryptPayload(iv, ciphertext, sharedSecret);
        log.debug("[REHYDRATE] Payload de identificação decifrado: {}", json);

        // 3. Extrai o id_prospect
        UUID sessionId = extractIdProspect(json);

        // 4. Localiza a sessão ativa no banco
        Session session = getActiveSession(sessionId);
        log.info("[REHYDRATE] ✅ Sessão {} encontrada. Reencriptando com sharedSecret do freezeToken.", session.getId());

        // 5. Retorna a sessão re-encriptada com o MESMO sharedSecret (sem novo DH)
        return responseQueries.sanitizeAndEncrypt(session, sharedSecret);
    }

    private UUID extractIdProspect(String json) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> map = objectMapper.readValue(json, Map.class);
            Object id = map.get("id_prospect");
            if (id == null) {
                throw new RuntimeException("Campo id_prospect ausente no payload de reidratação.");
            }
            return UUID.fromString(id.toString());
        } catch (RuntimeException re) {
            throw re;
        } catch (Exception e) {
            throw new RuntimeException("Falha ao extrair id_prospect: " + e.getMessage());
        }
    }

    // =========================================================================
    // CRIAÇÃO ANÔNIMA
    // =========================================================================

    public Session createAnonymous(String ipAddress, String userAgent) {
        log.info("[SERVICE SESSION - CRUD] Criando nova sessão anônima. IP: {}", ipAddress);

        UUID   sessionId = UUID.randomUUID();
        String jwt       = jwtService.generateToken(sessionId.toString(), 30L * 24 * 60 * 60 * 1000);

        Session session = new Session();
        session.setId(sessionId);
        session.setIpAddress(ipAddress);
        session.setUserAgent(userAgent);
        session.setToken(jwt);
        session.setFingerprint(generateFingerprint(ipAddress, userAgent));
        session.setCountry(resolveCountrySafely(ipAddress));
        session.setExpiresAt(LocalDateTime.now().plusDays(30));
        session.setRevoked(false);

        Session saved = repository.save(session);
        log.debug("[SERVICE SESSION - CRUD] Sessão anônima criada: {}", saved.getId());
        return saved;
    }

    public Map<String, Object> handleAnonymousUpgrade(String anonymousToken) {
        log.info("[SERVICE SESSION - FASE 3] Processando upgrade /anonymous → Freezer.");
        Map<String, Object> permissionPayload = cryptoHelper.upgradeToFreezerContext(anonymousToken);
        log.info("[SERVICE SESSION - FASE 3] Freezer context consolidado.");
        return permissionPayload;
    }

    // =========================================================================
    // READ / UPDATE / DELETE
    // =========================================================================

    public Session getActiveSession(UUID sessionId) {
        log.debug("[SERVICE SESSION - CRUD] Buscando sessão ativa: {}", sessionId);
        return repository.findById(sessionId)
                .filter(s -> !s.isRevoked())
                .orElseThrow(() -> new EntityNotFoundException("Sessão inválida, revogada ou não encontrada."));
    }

    public void revoke(UUID sessionId) {
        log.info("[SERVICE SESSION - CRUD] Revogando sessão: {}", sessionId);
        Session session = repository.findById(sessionId)
                .orElseThrow(() -> new EntityNotFoundException("Sessão não encontrada para revogação."));
        session.setRevoked(true);
        repository.save(session);
        log.info("[SERVICE SESSION - CRUD] Sessão {} revogada.", sessionId);
    }

    // =========================================================================
    // UTILITÁRIOS
    // =========================================================================

    public ResponseCookie generateSessionCookie(String encryptedValue) {
        return ResponseCookie.from("nameSessionKey", encryptedValue)
                .httpOnly(true)
                .secure(true)
                .path("/")
                .maxAge(Duration.ofDays(30))
                .sameSite("Lax")
                .build();
    }

    public String getSecretByToken(String token) {
        return cryptoHelper.getSecretByToken(token);
    }

    public void cleanup(String token) {
        log.info("[SERVICE SESSION - CLEANUP] Descartando token: {}", token);
        cryptoHelper.fullCleanup(token);
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
            log.warn("[SERVICE SESSION] Falha de GeoLoc para IP {}. Fallback: UNKNOWN.", ipAddress);
            return "UNKNOWN";
        }
    }
}
