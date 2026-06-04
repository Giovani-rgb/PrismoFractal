package com.prismo.modules.session.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prismo.config.JwtService;
import com.prismo.logger.AppLogger; // Importação correta do seu Wrapper Global
import com.prismo.modules.session.dto.DiffieHellmanModel;
import com.prismo.modules.session.model.Session;
import com.prismo.modules.session.repository.ResponseQueries;
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
    private final ResponseQueries responseQueries;
    private final AppLogger log; // Injeção do nosso Logger customizado
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ServiceSession(SessionRepository repository,
            GeoLocationService geoLocationService,
            JwtService jwtService,
            CryptoHelper cryptoHelper,
            ResponseQueries responseQueries,
            AppLogger log) {
        this.repository = repository;
        this.geoLocationService = geoLocationService;
        this.jwtService = jwtService;
        this.cryptoHelper = cryptoHelper;
        this.responseQueries = responseQueries;
        this.log = log;
    }

    // =========================================================================
    // HANDSHAKE PÚBLICO
    // =========================================================================

    public Map<String, Object> handlePublicInit() {
        log.controllers("Handshake Fase 1: Inicializando contexto seguro para nova conexão de entrada.");
        String windowToken = UUID.randomUUID().toString();
        Map<String, Object> publicPayload = cryptoHelper.initiatePublicContext(windowToken);
        log.controllers("Handshake Fase 1: Parâmetros Diffie-Hellman consolidados para o Window Token: {}",
                windowToken);
        return publicPayload;
    }

    public Map<String, Object> handlePublicFinalize(String windowToken, String clientBHex) {
        log.controllers("Handshake Fase 2: Recebido retorno de chave pública 'B' do cliente. Token: {}", windowToken);
        Map<String, Object> publicHandshakeResult = cryptoHelper.finalizePublicHandshake(windowToken, clientBHex);

        @SuppressWarnings("unchecked")
        Map<String, Object> anonymousPass = (Map<String, Object>) publicHandshakeResult.get("anonymousPass");

        log.controllers(
                "Handshake Fase 2: Chave secreta finalizada. Passaporte para a rota /anonymous emitido com sucesso.");
        return anonymousPass;
    }

    // =========================================================================
    // FLUXO 3: EMISSÃO DO PASSAPORTE PARA /refresh (POST /public + X-Freezer-Token)
    // =========================================================================
public Map<String, Object> handleFreezePassportIssue(String freezeToken, String iv, String ciphertext) {
    log.queries("Fluxo Freeze Passport: Iniciando emissão de passaporte via Freeze Token (Prefixo: {}...).",
            freezeToken.substring(0, Math.min(8, freezeToken.length())));

    // 1. Recupera o sharedSecret — .get() mantém o contexto ativo em paralelo no dhContexts
    log.queries("Buscando segredo criptográfico compartilhado para reidratação de canal.");
    String sharedSecret = this.getSecretByToken(freezeToken);
    if (sharedSecret == null) {
        log.error("Fluxo Freeze Passport abortado: Contexto criptográfico expirou ou o token informado é inválido.");
        throw new RuntimeException("Freeze token inválido — sessão expirada ou servidor reiniciado.");
    }

    // 2. Decifra o payload enviado pelo frontend usando o seu método existente
    String json = responseQueries.decryptPayload(iv, ciphertext, sharedSecret);
    UUID sessionId = extractIdProspect(json);

    // 3. Valida se a sessão do usuário existe e está ativa
    log.queries("Validando integridade da sessão [{}] mapeada a partir do payload decifrado.", sessionId);
    Session session = getActiveSession(sessionId);
    log.queries("Fluxo Freeze Passport: Sessão verificada e ativa. Encaminhando geração de token.");

    // 4. GERA O TOKEN VIA CRYPTOHELPER:
    // O método retorna diretamente o mapa de resposta do AntiBotManager e vincula no dhContexts
    Map<String, Object> passportData = cryptoHelper.generateRefreshPassport(freezeToken, session.getId().toString());

    // 5. PREPARA OS DADOS EXTRAS DO ANTIBOT:
    // Montamos o payload contendo UNICAMENTE o que o AntiBotManager determinou
    Map<String, Object> antiBotPayload = Map.of(
            "refreshPassport", passportData.get("refresh_Pass"), 
            "status",          passportData.get("status"), 
            "minWait",         passportData.get("minWait") 
    );

    // 6. CRIPTOGRAFIA LIMPA E ISOLADA:
    // Usamos o novo método para cifrar APENAS o payload do AntiBotManager, sem misturar a Session
    log.queries("Cifrando payload do AntiBot isoladamente usando o sharedSecret.");
    Map<String, String> encryptedResponse = responseQueries.encryptGenericPayload(antiBotPayload, sharedSecret);

    // 7. Retorna o pacote blindado com as chaves "iv" e "ciphertext" em Base64
    return Map.of(
            "iv",         encryptedResponse.get("iv"),
            "ciphertext", encryptedResponse.get("ciphertext")
    );
}


    // =========================================================================
    // RENOVAÇÃO VIA PASSAPORTE (POST /refresh + X-Refresh-Passport)
    // =========================================================================

    /**
     * Consome o refreshPassport emitido pelo Fluxo 3 e executa a renovação completa
     * da sessão.
     */
    public Map<String, String> handleRefreshWithPassport(String refreshPassport) {
        log.controllers("Consumindo passaporte de uso único (Single-use Passport: {}...).",
                refreshPassport.substring(0, Math.min(8, refreshPassport.length())));

        // 1. Consome o passport — single-use, remove dos mapas
        String ctx = cryptoHelper.consumeRefreshPassport(refreshPassport);
        if (ctx == null) {
            log.warning("Falha de consumo: Passaporte de renovação já foi utilizado ou é inválido.");
            throw new RuntimeException("Passaporte de renovação inválido ou já utilizado.");
        }
        String freezeToken = ctx;
        String sessionIdStr = ctx;

        // 2. Recupera o sharedSecret via freeze token (ainda vivo em paralelo)
        log.queries("Recuperando segredo de canal persistido em paralelo associado ao Freeze Token.");
        String sharedSecret = getSecretByToken(freezeToken);
        if (sharedSecret == null) {
            log.warning("Falha de reidratação: Contexto criptográfico original expirou em memória.");
            throw new RuntimeException("Contexto criptográfico expirado — freeze token não encontrado.");
        }

        // 3. Carrega sessão ativa
        UUID sessionId = UUID.fromString(sessionIdStr);
        Session session = getActiveSession(sessionId);

        // 4. Atualiza lastAccessAt e rotaciona keyUpdate (renovação completa)
        session.setLastAccessAt(LocalDateTime.now());
        session.setKeyUpdate(UUID.randomUUID());
        repository.save(session);
        log.controllers("Sessão [{}] estendida e salva. Chave rotativa modificada com sucesso.", session.getId());

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
            log.error("Falha no parse estrutural do JSON do prospect.", e);
            throw new RuntimeException("Falha ao extrair id_prospect: " + e.getMessage());
        }
    }

    // =========================================================================
    // CRIAÇÃO ANÔNIMA
    // =========================================================================

    public Session createAnonymous(String ipAddress, String userAgent) {
        log.queries("Instanciando registro bruto de sessão anônima no banco de dados.");

        UUID sessionId = UUID.randomUUID();
        String jwt = jwtService.generateToken(sessionId.toString(), 30L * 24 * 60 * 60 * 1000);

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
        log.queries("Sessão persistida no Supabase com ID: {}", saved.getId());
        return saved;
    }

    public Map<String, Object> handleAnonymousUpgrade(String anonymousToken) {
        log.controllers("Processando transição e upgrade de contexto: Anonymous -> Freezer.");
        Map<String, Object> permissionPayload = cryptoHelper.upgradeToFreezerContext(anonymousToken);
        log.controllers("Contexto Freezer consolidado em memória.");
        return permissionPayload;
    }

    // =========================================================================
    // READ / UPDATE / DELETE
    // =========================================================================

    public Session getActiveSession(UUID sessionId) {
        log.queries("Executando verificação de revogação/existência para ID: {}", sessionId);
        return repository.findById(sessionId)
                .filter(s -> !s.isRevoked())
                .orElseThrow(() -> new EntityNotFoundException("Sessão inválida, revogada ou não encontrada."));
    }

    public void revoke(UUID sessionId) {
        log.queries("Buscando sessão para execução de exclusão lógica (Revogação). ID: {}", sessionId);
        Session session = repository.findById(sessionId)
                .orElseThrow(() -> new EntityNotFoundException("Sessão não encontrada para revogação."));
        session.setRevoked(true);
        repository.save(session);
        log.queries("Sessão [{}] marcada com sucesso como revogada.", sessionId);
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
        log.controllers("Rotina de Cleanup: Descartando e invalidando token temporário: {}", token);
        cryptoHelper.fullCleanup(token);
    }

    private String generateFingerprint(String ip, String userAgent) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest((ip + "|" + userAgent).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            log.error("Algoritmo de hash SHA-256 indisponível no ambiente da JVM atual.");
            throw new RuntimeException("Erro interno de hash");
        }
    }

    private String resolveCountrySafely(String ipAddress) {
        try {
            return geoLocationService.getCountryByIp(ipAddress);
        } catch (Exception e) {
            // Log de aviso isolado, pois não interrompe a esteira do sistema
            log.warning("Falha ao resolver GeoLocalização para o IP [{}]. Aplicando Fallback: UNKNOWN.", ipAddress);
            return "UNKNOWN";
        }
    }
}
