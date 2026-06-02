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
    // FLUXO 3: EMISSÃO DO PASSAPORTE PARA /refresh  (POST /public + X-Freezer-Token)
    // =========================================================================

    /**
     * Fluxo 3 do /public — análogo ao Fluxo 2 que emite anonymousToken para /anonymous.
     * <p>
     * Recebe o payload cifrado, recupera o sharedSecret via X-Freezer-Token,
     * valida a sessão e emite um refreshPassport. O frontend usa esse passaporte
     * para chamar /refresh diretamente — sem expor o freeze token novamente.
     * O freeze token é mantido em paralelo no dhContexts (não consumido).
     *
     * @param freezeToken O token de congelamento recebido via header X-Freezer-Token
     * @param iv          IV Base64 do payload cifrado pelo cliente
     * @param ciphertext  Ciphertext Base64 do payload cifrado pelo cliente
     * @return Map com { refreshPassport, status, minWait }
     */
    public Map<String, Object> handleFreezePassportIssue(String freezeToken, String iv, String ciphertext) {
        log.info("[FREEZE PASSPORT] Emissão de passaporte via freeze token: {}...",
                freezeToken.substring(0, Math.min(8, freezeToken.length())));

        // 1. Recupera o sharedSecret — .get() mantém o contexto ativo em paralelo
        String sharedSecret = getSecretByToken(freezeToken);
        if (sharedSecret == null) {
            log.warn("[FREEZE PASSPORT] Freeze token inválido ou contexto expirado: {}",
                    freezeToken.substring(0, Math.min(8, freezeToken.length())));
            throw new RuntimeException("Freeze token inválido — sessão expirada ou servidor reiniciado.");
        }

        // 2. Decifra o payload → extrai id_prospect
        String json      = responseQueries.decryptPayload(iv, ciphertext, sharedSecret);
        UUID   sessionId = extractIdProspect(json);

        // 3. Valida que a sessão existe e está ativa (sem modificar nada ainda)
        Session session = getActiveSession(sessionId);
        log.info("[FREEZE PASSPORT] Sessão {} validada. Emitindo passaporte de renovação.", session.getId());

        // 4. Gera o refreshPassport e vincula freeze token + sessionId nos mapas do CryptoHelper
        String refreshPassport = cryptoHelper.generateRefreshPassport(freezeToken, session.getId().toString());

        return Map.of(
            "refreshPassport", refreshPassport,
            "status",          "refresh_authorized",
            "minWait",         1.5
        );
    }

    // =========================================================================
    // RENOVAÇÃO VIA PASSAPORTE  (POST /refresh + X-Refresh-Passport)
    // =========================================================================

    /**
     * Consome o refreshPassport emitido pelo Fluxo 3 e executa a renovação completa da sessão.
     * <p>
     * O passport vincula internamente o freeze token (para recuperar o sharedSecret)
     * e o sessionId. Após consumo o passport é descartado (single-use).
     *
     * @param refreshPassport Token de passaporte emitido pelo Fluxo 3 do /public
     * @return Sessão renovada, cifrada com o sharedSecret do freeze token original
     */
    public Map<String, String> handleRefreshWithPassport(String refreshPassport) {
        log.info("[REFRESH PASSPORT] Consumindo passaporte: {}...",
                refreshPassport.substring(0, Math.min(8, refreshPassport.length())));

        // 1. Consome o passport — single-use, remove dos mapas
        String[] ctx = cryptoHelper.consumeRefreshPassport(refreshPassport);
        if (ctx == null) {
            throw new RuntimeException("Passaporte de renovação inválido ou já utilizado.");
        }
        String freezeToken    = ctx[0];
        String sessionIdStr   = ctx[1];

        // 2. Recupera o sharedSecret via freeze token (ainda vivo em paralelo)
        String sharedSecret = getSecretByToken(freezeToken);
        if (sharedSecret == null) {
            throw new RuntimeException("Contexto criptográfico expirado — freeze token não encontrado.");
        }

        // 3. Carrega sessão ativa
        UUID    sessionId = UUID.fromString(sessionIdStr);
        Session session   = getActiveSession(sessionId);

        // 4. Atualiza lastAccessAt e rotaciona keyUpdate (renovação completa)
        session.setLastAccessAt(LocalDateTime.now());
        session.setKeyUpdate(UUID.randomUUID());
        repository.save(session);
        log.info("[REFRESH PASSPORT] ✅ Sessão {} renovada via passaporte.", session.getId());

        // 5. Encripta com o sharedSecret do canal DH original (não o appSessionSecret)
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
