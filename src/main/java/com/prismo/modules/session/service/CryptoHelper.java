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
    public DiffieHellmanModel initiatePublicContext(String clientToken) {
        log.info("[ROTA /public - PARTE 1] Iniciando Handshake. Abrindo janela de reentrada.");

        // 1. Cria a janela de tempo (REENTRY_WINDOW) para o cliente retornar e se validar na rota pública
        antiBotManager.createNewWindow(clientToken);
        log.debug("[ROTA /public - PARTE 1] REENTRY_WINDOW registrada para o token: {}", clientToken);

        // 2. Executa a primeira parte do cálculo matemático (A = g^_a mod p)
        log.debug("[ROTA /public - PARTE 1] Computando expoente privado efêmero de 2048-bits...");
        BigInteger _a = new BigInteger(2048, secureRandom).mod(P_DH);
        BigInteger A = G_DH.modPow(_a, P_DH);
        
        DiffieHellmanModel ctx = new DiffieHellmanModel(P_DH, G_DH, _a, A);
        dhContexts.put(clientToken, ctx);

        log.info("[ROTA /public - PARTE 1] Sucesso. Chave pública 'A' calculada. Aguardando retorno do cliente.");
        return ctx;
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
