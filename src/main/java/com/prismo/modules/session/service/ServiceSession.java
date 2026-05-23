package com.prismo.modules.session.service;

import com.prismo.config.JwtService;
import com.prismo.modules.session.dto.DiffieHellmanModel;
import com.prismo.modules.session.model.Session;
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

    // =========================================================================
    // ORQUESTRAÇÃO DE ROTAS E HANDSHAKE (O PASSADOR DE BASTÃO)
    // =========================================================================

    /**
     * FASE 1: ROTA /public (Abertura do Handshake)
     * O cliente (frontend) acessa /public pela primeira vez (sem a chave B).
     * O servidor prepara o terreno matemático e abre a janela de validação anti-bot (REENTRY_WINDOW).
     *
     * @return Payload para o cliente processar sua própria chave local e conhecer seu ticket de retorno.
     */
    public Map<String, Object> handlePublicInit() {
    log.info("[SERVICE SESSION - FASE 1] Inicializando contexto seguro para nova conexão.");
    
    // 1. O ServiceSession assume o controle de criar o ticket de identificação
    String windowToken = UUID.randomUUID().toString();
    
    // 2. O CryptoHelper agora faz o trabalho pesado e já devolve o Map completo (DH + AntiBot)
    Map<String, Object> publicPayload = cryptoHelper.initiatePublicContext(windowToken);

    log.debug("[SERVICE SESSION - FASE 1] Parâmetros DH e Anti-Bot gerados com sucesso para o token: {}", windowToken);

    // 3. Retorna a estrutura unificada direta para o Controller / Frontend
    return publicPayload;
}


    /**
     * FASE 2: ROTA /public (Fechamento do Handshake / Callback do Cliente)
     * O cliente retorna à rota /public com o windowToken gerado na Fase 1 e a sua chave pública B.
     * Delegamos ao CryptoHelper a validação temporal (AntiBot) e o cálculo final do Shared Secret.
     *
     * @param windowToken O token de reentrada emitido na Fase 1.
     * @param clientBHex A chave pública gerada pelo dispositivo do cliente.
     * @return O passaporte "ANONYMOUS_PASS" de uso único.
     */
    public Map<String, Object> handlePublicFinalize(String windowToken, String clientBHex) {
        log.info("[SERVICE SESSION - FASE 2] Recebido retorno do cliente para validação do token: {}", windowToken);

        // 1. Passa o bastão para o CryptoHelper bater as regras AntiBot e fechar o cálculo de chaves
        Map<String, Object> publicHandshakeResult = cryptoHelper.finalizePublicHandshake(windowToken, clientBHex);
        
        // 2. Extrai e retorna apenas o token de acesso à rota /anonymous
        @SuppressWarnings("unchecked")
        Map<String, Object> anonymousPass = (Map<String, Object>) publicHandshakeResult.get("anonymousPass");
        
        log.info("[SERVICE SESSION - FASE 2] Handshake fechado com sucesso. Emitindo passaporte /anonymous.");
        return anonymousPass;
    }


    // =========================================================================
    // OPERAÇÕES CRUD DA SESSÃO (PERSISTÊNCIA DE NEGÓCIO)
    // =========================================================================

    /**
     * CREATE: ROTA /anonymous (Fase Final de Negócio)
     * Executado quando o cliente consome com sucesso seu token ANONYMOUS_PASS no controller.
     * Cria e persiste no banco uma sessão anônima válida.
     */
    public Session createAnonymous(String ipAddress, String userAgent) {
        log.info("[SERVICE SESSION - CRUD] Criando nova sessão anônima persistente. IP: {}", ipAddress);
        
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

        Session savedSession = repository.save(session);
        log.debug("[SERVICE SESSION - CRUD] Sessão anônima criada com ID: {}", savedSession.getId());
        
        return savedSession;
    }

        // =========================================================================
    // ETAPA 3: ROTA "/anonymous" (Consolidação e Congelamento de Fluxo)
    // =========================================================================
    /**
     * FASE 3: ROTA /anonymous (Upgrade para o Contexto de Freezer)
     * <p>
     * Acionado dentro do escopo da rota anônima para finalizar a transição de estado.
     * Invoca o CryptoHelper para destruir o token temporário e envelopar a apólice
     * de segurança contendo as permissões de navegação, escopo rwu e interações.
     *
     * @param anonymousToken O token de passagem atual que será invalidado e promovido.
     * @return O payload completo com os objetos de permissão exigidos pelo front.
     */
    public Map<String, Object> handleAnonymousUpgrade(String anonymousToken) {
        log.info("[SERVICE SESSION - FASE 3] Processando upgrade de contexto da rota /anonymous para Freezer.");
        
        // Invoca o orquestrador para gerar a apólice de permissões (rwu, navigation, interactions)
        Map<String, Object> permissionPayload = cryptoHelper.upgradeToFreezerContext(anonymousToken);
        
        log.info("[SERVICE SESSION - FASE 3] Permissão de navegação (rwu) consolidada com sucesso.");
        return permissionPayload;
    }


    /**
     * READ: Recupera uma sessão existente.
     * Utilizado para validações posteriores no ciclo de vida do cliente.
     */
    public Session getActiveSession(UUID sessionId) {
        log.debug("[SERVICE SESSION - CRUD] Buscando sessão ativa: {}", sessionId);
        return repository.findById(sessionId)
                .filter(s -> !s.isRevoked())
                .orElseThrow(() -> new EntityNotFoundException("Sessão inválida, revogada ou não encontrada."));
    }

    /**
     * UPDATE (Delete Lógico): Revoga ativamente uma sessão do sistema.
     */
    public void revoke(UUID sessionId) {
        log.info("[SERVICE SESSION - CRUD] Solicitada revogação para a sessão: {}", sessionId);
        Session session = repository.findById(sessionId)
                .orElseThrow(() -> new EntityNotFoundException("Session não encontrada para revogação."));
        
        session.setRevoked(true);
        repository.save(session);
        log.info("[SERVICE SESSION - CRUD] Sessão {} revogada com sucesso.", sessionId);
    }


    // =========================================================================
    // UTILITÁRIOS (Cookies, Hash, GeoLoc e Integração Limpeza)
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

    private String generateFingerprint(String ip, String userAgent) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest((ip + "|" + userAgent).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            log.error("[SERVICE SESSION - UTILS] Erro interno na geração de hash do fingerprint.", e);
            throw new RuntimeException("Erro interno de hash");
        }
    }

    private String resolveCountrySafely(String ipAddress) {
        try {
            return geoLocationService.getCountryByIp(ipAddress);
        } catch (Exception e) {
            log.warn("[SERVICE SESSION - UTILS] Falha de GeoLoc para IP {}. Fallback para UNKNOWN. Motivo: {}", ipAddress, e.getMessage());
            return "UNKNOWN";
        }
    }

    /**
     * Pega o segredo em RAM sem expor o DHModel.
     */
    public String getSecretByToken(String token) {
        return cryptoHelper.getSecretByToken(token);
    }

    /**
     * Dispara a limpeza imediata dos mapas e objetos da memória principal.
     */
    public void cleanup(String token) {
        log.info("[SERVICE SESSION - CLEANUP] Solicitando descarte de memória ao CryptoHelper para token: {}", token);
        cryptoHelper.fullCleanup(token);
    }
}
