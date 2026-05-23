package com.prismo.modules.session.service;

import com.prismo.modules.session.dto.DiffieHellmanModel;
import com.prismo.modules.session.enums.AntiBotTokenType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.math.BigInteger;
import java.security.SecureRandom;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Orquestrador centralizado do Contexto de Criptografia e Segurança Anti-Bot.
 * <p>
 * Executa o handshake Diffie-Hellman completo dentro do escopo da rota /public,
 * utilizando a validação de reentrada para emitir com segurança o token de acesso à rota /anonymous.
 */
@Component
public class CryptoHelper {

    private static final Logger log = LoggerFactory.getLogger(CryptoHelper.class);

    private final SecureRandom secureRandom = new SecureRandom();
    private final AntiBotManager antiBotManager;

    // Mapa que retém os dados matemáticos do handshake ativos durante a negociação na rota /public
    private final Map<String, DiffieHellmanModel> dhContexts = new ConcurrentHashMap<>();
    
    // Grupo 14 do RFC 3526 (2048-bit MODP Group)
    private static final BigInteger P_DH = new BigInteger(
            "FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1" +
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

    public CryptoHelper(AntiBotManager antiBotManager) {
        this.antiBotManager = antiBotManager;
    }

    // =========================================================================
    // ETAPA 1: ROTA "/public" (GET Inicial - Abertura do Handshake)
    // =========================================================================
    /**
     * PRIMEIRA PARTE DO CÁLCULO: Inicialização do Contexto Seguro.
     * <p>
     * Chamado no primeiro hit da rota pública. Abre uma janela de reentrada temporizada
     * direcionada para a própria rota pública e calcula a chave 'A' do servidor.
     *
     * @param clientToken O identificador gerado ou recebido para indexar este início de fluxo.
     * @return O modelo DH contendo os parâmetros iniciais e a chave pública 'A'.
     */
    public Map<String, Object> initiatePublicContext(String clientToken) {
        log.info("[ROTA /public - PARTE 1] Iniciando Handshake. Abrindo janela de reentrada.");

        // 1. Cria a janela de tempo (REENTRY_WINDOW) e captura o mapa com as regras anti-bot
        Map<String, Object> antiBotData = antiBotManager.createNewWindow(clientToken);
        log.debug("[ROTA /public - PARTE 1] REENTRY_WINDOW registrada para o token: {}", clientToken);

        // 2. Executa a primeira parte do cálculo matemático (A = g^_a mod p)
        log.debug("[ROTA /public - PARTE 1] Computando expoente privado efêmero de 2048-bits...");
        BigInteger _a = new BigInteger(2048, secureRandom).mod(P_DH);
        BigInteger A = G_DH.modPow(_a, P_DH);

        // O modelo completo (com o segredo privado '_a') continua salvo com segurança no servidor
        DiffieHellmanModel ctx = new DiffieHellmanModel(P_DH, G_DH, _a, A);
        dhContexts.put(clientToken, ctx);

        log.info("[ROTA /public - PARTE 1] Sucesso. Chave pública 'A' calculada. Aguardando retorno do cliente.");

        // 3. Mescla os dados do Diffie-Hellman com os dados do Anti-Bot
        // Usamos um HashMap baseado no antiBotData para herdar "reentryToken", "minWait" e "status" automaticamente
        Map<String, Object> responsePayload = new java.util.HashMap<>(antiBotData);

        // Adiciona apenas as partes PÚBLICAS do DH que o front precisa para calcular o segredo dele
        responsePayload.put("p", P_DH.toString(16)); // .toString() evita problemas de precisão numérica no ecossistema JS/TS
        responsePayload.put("g", G_DH.toString(16));
        responsePayload.put("A", A.toString(16));

        return responsePayload;
    }

    // =========================================================================
    // ETAPA 2: ROTA "/public" (POST Retorno - Fechamento do Handshake e Redirecionamento)
    // =========================================================================
    /**
     * SEGUNDA PARTE DO CÁLCULO: Validação do Humano e Emissão do Passaporte.
     * <p>
     * O cliente retorna à rota pública enviando a sua chave 'B'. Validamos o tempo do antibot,
     * calculamos o Shared Secret e, se tudo estiver perfeito, geramos e retornamos o token
     * de passagem que dá o direito de acessar a rota "/anonymous".
     *
     * @param token O token de reentrada que o cliente usou para voltar à rota pública.
     * @param clientBHex A chave pública enviada pelo cliente (B) em Hexadecimal.
     * @return Map contendo o token "ANONYMOUS_PASS" de acesso à próxima rota e o segredo calculado.
     */
    public Map<String, Object> finalizePublicHandshake(String token, String clientBHex) { // 'token' aqui é o windowToken
        log.info("[ROTA /public - PARTE 2] Cliente retornou para validação e fechamento do cálculo.");

        // 1. BARREIRA ANTI-BOT: Valida se o cliente voltou dentro do tempo humano esperado
        log.debug("[ROTA /public - PARTE 2] Verificando comportamento de tempo na REENTRY_WINDOW...");
        antiBotManager.consumeAndValidateToken(token, AntiBotTokenType.REENTRY_WINDOW);
        log.info("[ROTA /public - PARTE 2] Filtro comportamental aprovado. Cliente validado como humano.");

        // 2. Recupera o cálculo matemático parcial que guardamos na Parte 1 (usando o windowToken)
        DiffieHellmanModel ctx = dhContexts.remove(token); // Usamos .remove() para já tirar o windowToken de circulação
        if (ctx == null) {
            log.error("[ROTA /public - PARTE 2] Contexto de chaves não localizado para o token: {}", token);
            throw new RuntimeException("Sessão criptográfica inválida ou exposta.");
        }

        // 3. Executa a segunda parte do cálculo do Diffie-Hellman
        log.debug("[ROTA /public - PARTE 2] Calculando o Segredo Compartilhado final...");
        BigInteger clientB = new BigInteger(clientBHex, 16);
        ctx.computeSharedSecret(clientB);
        String sharedSecretHex = ctx.getSharedSecret().toString(16);

        // 4. Emite o token de passagem para a rota /anonymous
        log.info("[ROTA /public - PARTE 2] Handshake concluído. Emitindo passaporte de acesso para /anonymous.");
        Map<String, Object> anonymousPassData = antiBotManager.generateAnonymousToken();

        // =========================================================================
        // AJUSTE CRUCIAL: Vincula o contexto matemático ao novo token de acesso
        // =========================================================================
        String anonymousToken = (String) anonymousPassData.get("anonymousToken");
        dhContexts.put(anonymousToken, ctx); 
        log.debug("[ROTA /public - PARTE 2] Contexto Diffie-Hellman transferido para o 'anonymousToken' com sucesso.");
        // =========================================================================

        return Map.of(
            "anonymousPass", anonymousPassData, // Contém o token físico para consumir em /anonymous
            "sharedSecretHex", sharedSecretHex
        );
    }


        // =========================================================================
    // ETAPA 3: CONSOLIDAR E CONGELAR FLUXO (Geração do Objeto de Permissão de Navegação)
    // =========================================================================
    /**
     * Organiza a transição do fluxo anônimo para o estado estável de longa duração (Freezer),
     * construindo o objeto completo de permissão de navegação, escopos RWU e regras de interação.
     *
     * @param currentAnonymousToken Token usado na rota /anonymous que será substituído.
     * @return Map contendo o payload consolidado de autorização para o ecossistema do app.
     */
    public Map<String, Object> upgradeToFreezerContext(String currentAnonymousToken) {
        log.info("[CRYPTO HELPER] Processando upgrade de rota. Construindo permissões do Freezer.");

        // 1. Localiza e remove o contexto DH antigo para evitar reaproveitamento
        DiffieHellmanModel ctx = dhContexts.remove(currentAnonymousToken);
        if (ctx == null) {
            log.error("[FREEZER] Falha crítica: Contexto matemático não encontrado para o token: {}", currentAnonymousToken);
            throw new RuntimeException("Sessão criptográfica inconsistente ou já revogada.");
        }

        // 2. Gera a credencial estável através do AntiBotManager
        Map<String, Object> freezerData = antiBotManager.generateFreezerToken();
        String freezerToken = (String) freezerData.get("freezerToken");

        // 3. Transfere o contexto matemático para o novo token para manter a decifragem AES viva
        dhContexts.put(freezerToken, ctx);

        // 4. OBJETO DE NAVEGAÇÃO: Define as diretrizes e caminhos liberados após o congelamento
        Map<String, Object> navigationPolicy = Map.of(
            "targetState", "AUTHORIZED_FREEZER",
            "allowedRoutes", java.util.List.of("/dashboard", "/secure/*"),
            "originToken", currentAnonymousToken,
            "freezerToken", freezerToken,
            "minWaitSeconds", freezerData.get("minWait")
        );

        // 5. OBJETO RWU: Define os direitos granulares de Leitura (Read), Escrita (Write) e Uso (Use)
        Map<String, Object> rwuPermissions = Map.of(
            "read", true,
            "write", true,
            "use", true,
            "inheritedContext", true,
            "restrictions", java.util.List.of("isolated-session-only")
        );

        // 6. OBJETO DE INTERAÇÃO: Regras de acoplamento com outros objetos/entidades do sistema
        Map<String, Object> interactionSpecs = Map.of(
            "allowedModules", java.util.List.of("session", "core-modules"),
            "allowCrossModuleCalls", true,
            "signatureValidated", true,
            "timestamp", java.time.Instant.now().toString()
        );

        // 7. PAYLOAD CONSOLIDADO: Incorpora todas as camadas exigidas pelo ecossistema de segurança
        return Map.of(
            "status", "navigation_authorized",
            "navigation", navigationPolicy,
            "rwu", rwuPermissions,
            "interactions", interactionSpecs
        );
    }


    // =========================================================================
    // UTILS & LIMPEZA: Consumidos pelas rotas seguintes (/anonymous, etc.)
    // =========================================================================
    /**
     * Resgata o segredo compartilhado (Shared Secret) calculado, em formato Hexadecimal.
     * Utiliza o token ativo como chave de busca no mapa de contextos em RAM.
     *
     * @param token O token correspondente ao estágio atual (geralmente o anonymousToken na rota /anonymous).
     * @return O segredo em Hexadecimal pronto para uso no AES-GCM, ou null se não localizado/calculado.
     */
    public String getSecretByToken(String token) {
        log.debug("[CRYPTO HELPER] Tentando resgatar o Shared Secret para o token: {}", token);

        if (token == null || token.isBlank()) {
            log.warn("[CRYPTO HELPER] Busca abortada: O token fornecido está nulo ou vazio.");
            return null;
        }

        // Busca o modelo matemático associado ao token atual no mapa
        DiffieHellmanModel ctx = dhContexts.get(token);

        // Validação 1: O token existe no mapa?
        if (ctx == null) {
            log.warn("[CRYPTO HELPER] Bloqueado: Nenhum contexto Diffie-Hellman foi localizado em RAM para o token informado.");
            return null;
        }

        // Validação 2: A Fase 2 já aconteceu e o segredo foi computado?
        if (ctx.getSharedSecret() == null) {
            log.error("[CRYPTO HELPER] Crítico: O contexto existe, mas o cálculo do Shared Secret ainda não foi executado.");
            return null;
        }

        log.info("[CRYPTO HELPER] Sucesso: Shared Secret recuperado e pronto para a cifragem AES-GCM.");
        return ctx.getSharedSecret().toString(16);
    }



    /**
     * Purga os dados binários e limpa os mapas de memória de ambos os componentes.
     */
    public void fullCleanup(String token) {
        log.info("[CLEANUP] Executando descarte completo do token: {}", token);
        antiBotManager.removeToken(token);
        
        DiffieHellmanModel ctx = dhContexts.remove(token);
        if (ctx != null) {
            ctx.clearSecrets();
            log.info("[CLEANUP] Memória RAM limpa com sucesso.");
        }
    }
}
