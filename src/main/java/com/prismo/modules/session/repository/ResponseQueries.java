package com.prismo.modules.session.repository;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.prismo.modules.session.model.Session;
import com.prismo.modules.session.util.EncryptionUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Component 
public class ResponseQueries {

    private static final Logger log = LoggerFactory.getLogger(ResponseQueries.class);
    private final ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());

    /**
     * Sanitiza e criptografa os dados da sessão utilizando obrigatoriamente
     * o Shared Secret do Diffie-Hellman resolvido em runtime.
     */
    public Map<String, String> sanitizeAndEncrypt(Session session, String secret) {
        try {
            log.info("[RESPONSE QUERIES] Sanitizando dados para cifragem em runtime. Sessão: {}", session.getId());

            // 1. Mapeia estritamente os dados de negócio (SEM o token)
            Map<String, Object> data = new HashMap<>();
            data.put("id_prospect", session.getId());
            data.put("refs", session.getUserId()); 
            data.put("country", session.getCountry());
            data.put("revoked", session.isRevoked());
            data.put("keyUpdate", session.getKeyUpdate());
            data.put("createdAt", session.getCreatedAt());
            data.put("expiresAt", session.getExpiresAt());
            data.put("lastAccessAt", session.getLastAccessAt());

            // 2. Converte o objeto para string JSON (Minificada por padrão)
            String jsonPayload = mapper.writeValueAsString(data);

            // 3. Criptografa usando o AES-GCM com a chave simétrica vinda do handshake
            String encryptedBase64 = EncryptionUtils.encrypt(jsonPayload, secret);
            byte[] combined = Base64.getDecoder().decode(encryptedBase64);

            // 4. Separa os bytes do array combinado (IV = 12 bytes)
            byte[] iv = new byte[12];
            byte[] ciphertext = new byte[combined.length - 12];
            
            System.arraycopy(combined, 0, iv, 0, 12);
            System.arraycopy(combined, 12, ciphertext, 0, ciphertext.length);

            // 5. Cria o mapa estruturado para o frontend
            Map<String, String> response = new HashMap<>();
            response.put("iv", Base64.getEncoder().encodeToString(iv));
            response.put("ciphertext", Base64.getEncoder().encodeToString(ciphertext));

            log.info("[RESPONSE QUERIES] Payload cifrado com sucesso em runtime.");
            return response; 

        } catch (Exception e) {
            log.error("[RESPONSE QUERIES] Falha ao cifrar resposta com a chave de runtime.", e);
            throw new RuntimeException("Erro ao processar e criptografar resposta da sessão", e);
        }
    }
}
