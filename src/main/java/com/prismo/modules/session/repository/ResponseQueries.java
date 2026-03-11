package com.prismo.modules.session.repository;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.prismo.modules.session.model.Session;
import com.prismo.modules.session.util.EncryptionUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component 
public class ResponseQueries {

    private final ObjectMapper mapper;
    private final String appSecret;

    // Injeção via construtor: A melhor prática para componentes Spring
    public ResponseQueries(
            @Value("${app.session.secret}") String appSecret
    ) {
        this.appSecret = appSecret;
        this.mapper = new ObjectMapper().registerModule(new JavaTimeModule());
    }

    /**
     * Agora o método NÃO é mais static, pois depende da variável injetada
     */
    public String sanitizeAndEncrypt(Session session) {
        try {
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

            String jsonPayload = mapper.writeValueAsString(data);

            // Usa a variável de instância injetada
            return EncryptionUtils.encrypt(jsonPayload, this.appSecret);

        } catch (Exception e) {
            throw new RuntimeException("Erro ao processar e criptografar resposta da sessão", e);
        }
    }
}
