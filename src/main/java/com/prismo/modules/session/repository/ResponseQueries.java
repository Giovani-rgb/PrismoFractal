package com.prismo.modules.session.repository;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.prismo.modules.session.model.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Component 
public class ResponseQueries {

    private static final Logger log = LoggerFactory.getLogger(ResponseQueries.class);
    private final ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
    private final SecureRandom secureRandom = new SecureRandom();

    /**
     * Sanitiza e criptografa os dados da sessão.
     *
     * A chave AES é derivada via SHA-256 do secretHex (hex string do DH shared secret),
     * garantindo sempre exatamente 32 bytes — alinhado com o frontend:
     *   deriveKey(secret) = SHA-256(UTF-8(secret)) → importKey('raw', hash, 'AES-GCM')
     *
     * Retorna {iv, ciphertext} em Base64, prontos para o EncryptedPayload do Angular.
     */
    public Map<String, String> sanitizeAndEncrypt(Session session, String secretHex) {
        try {
            log.info("[RESPONSE QUERIES] Sanitizando dados para cifragem. Sessão: {}", session.getId());

            Map<String, Object> data = new HashMap<>();
            data.put("id_prospect", session.getId());
            data.put("refs",        session.getUserId());
            data.put("country",     session.getCountry());
            data.put("revoked",     session.isRevoked());
            data.put("keyUpdate",   session.getKeyUpdate());
            data.put("createdAt",   session.getCreatedAt());
            data.put("expiresAt",   session.getExpiresAt());
            data.put("lastAccessAt",session.getLastAccessAt());

            String jsonPayload = mapper.writeValueAsString(data);

            // Deriva chave AES-256 via SHA-256 da string hex (igual ao crypto.subtle no frontend)
            byte[] keyBytes = MessageDigest.getInstance("SHA-256")
                    .digest(secretHex.getBytes(StandardCharsets.UTF_8));
            SecretKeySpec keySpec = new SecretKeySpec(keyBytes, "AES");

            byte[] iv = new byte[12];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(128, iv));
            byte[] ciphertext = cipher.doFinal(jsonPayload.getBytes(StandardCharsets.UTF_8));

            Map<String, String> response = new HashMap<>();
            response.put("iv",         Base64.getEncoder().encodeToString(iv));
            response.put("ciphertext", Base64.getEncoder().encodeToString(ciphertext));

            log.info("[RESPONSE QUERIES] Payload cifrado com sucesso. Pronto para o Web Worker.");
            return response;

        } catch (Exception e) {
            log.error("[RESPONSE QUERIES] Falha ao cifrar resposta.", e);
            throw new RuntimeException("Erro ao processar e criptografar resposta da sessão", e);
        }
    }
}
