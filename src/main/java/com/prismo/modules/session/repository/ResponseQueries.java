package com.prismo.modules.session.repository;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.prismo.modules.session.model.Session;
import com.prismo.modules.session.util.EncryptionUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Component 
public class ResponseQueries {

    private final ObjectMapper mapper;
    private final String appSecret;

    public ResponseQueries(
            @Value("${app.session.secret}") String appSecret
    ) {
        this.appSecret = appSecret;
        this.mapper = new ObjectMapper().registerModule(new JavaTimeModule());
    }

    /**
     * Prepara os dados da sessão, criptografa e retorna um objeto estruturado
     * para que o Frontend (Angular) consiga processar sem erros de fluxo.
     */
    public Map<String, String> sanitizeAndEncrypt(Session session) {
        try {
            // 1. Mapeia os dados que serão enviados na sessão
            Map<String, Object> data = new HashMap<>();
            data.put("id_prospect", session.getId());
            data.put("refs", session.getUserId()); 
            data.put("country", session.getCountry());
            data.put("revoked", session.isRevoked());
            data.put("keyUpdate", session.getKeyUpdate());
            data.put("createdAt", session.getCreatedAt());
            data.put("expiresAt", session.getExpiresAt());
            data.put("lastAccessAt", session.getLastAccessAt());

            if (session.getToken() != null) {
                data.put("token", session.getToken());
            }

            // 2. Converte o objeto para string JSON
            String jsonPayload = mapper.writeValueAsString(data);

            // 3. Criptografa usando AES-GCM (retorna IV + Ciphertext combinados em Base64)
            String encryptedBase64 = EncryptionUtils.encrypt(jsonPayload, this.appSecret);
            byte[] combined = Base64.getDecoder().decode(encryptedBase64);

            // 4. Separa os bytes para enviar um JSON estruturado
            // O IV no seu EncryptionUtils tem 12 bytes
            byte[] iv = new byte[12];
            byte[] ciphertext = new byte[combined.length - 12];
            
            System.arraycopy(combined, 0, iv, 0, 12);
            System.arraycopy(combined, 12, ciphertext, 0, ciphertext.length);

            // 5. Cria o mapa de resposta que o Spring converterá em JSON
            Map<String, String> response = new HashMap<>();
            response.put("iv", Base64.getEncoder().encodeToString(iv));
            response.put("ciphertext", Base64.getEncoder().encodeToString(ciphertext));

            return response; 

        } catch (Exception e) {
            throw new RuntimeException("Erro ao processar e criptografar resposta da sessão", e);
        }
    }
}