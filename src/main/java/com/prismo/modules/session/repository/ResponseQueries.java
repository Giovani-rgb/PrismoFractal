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
     * Sobrecarga legada — apenas sessão básica.
     */
    public Map<String, String> sanitizeAndEncrypt(Session session, String secretHex) {
        return sanitizeAndEncrypt(session, null, secretHex);
    }

    /**
     * Sanitiza os dados da sessão e acopla escopos dinâmicos de segurança antes
     * de cifrar tudo em um único bloco AES-256-GCM.
     */
    public Map<String, String> sanitizeAndEncrypt(Session session, Map<String, Object> extraData, String secretHex) {
        try {
            log.info("[RESPONSE QUERIES] Sanitizando dados e escopos para cifragem. Sessão: {}", session.getId());

            Map<String, Object> data = new HashMap<>();
            data.put("id_prospect", session.getId());
            data.put("refs",         session.getUserId());
            data.put("country",      session.getCountry());
            data.put("revoked",      session.isRevoked());
            data.put("keyUpdate",    session.getKeyUpdate());
            data.put("createdAt",    session.getCreatedAt());
            data.put("expiresAt",    session.getExpiresAt());
            data.put("lastAccessAt", session.getLastAccessAt());

            if (extraData != null && !extraData.isEmpty()) {
                log.debug("[RESPONSE QUERIES] Acoplando {} chaves extras ao payload.", extraData.size());
                data.putAll(extraData);
            }

            return encryptJson(mapper.writeValueAsString(data), secretHex);

        } catch (Exception e) {
            log.error("[RESPONSE QUERIES] Falha ao cifrar resposta combinada.", e);
            throw new RuntimeException("Erro ao processar e criptografar resposta da sessão", e);
        }
    }

    /**
     * Decifra um payload AES-256-GCM recebido do cliente (mesma derivação de chave que o encrypt).
     *
     * @param ivBase64         IV em Base64
     * @param ciphertextBase64 Ciphertext em Base64
     * @param secretHex        Shared Secret em Hexadecimal (idêntico ao usado no encrypt)
     * @return JSON decifrado como String
     */
    public String decryptPayload(String ivBase64, String ciphertextBase64, String secretHex) {
        try {
            log.debug("[RESPONSE QUERIES] Decifrando payload do cliente.");

            byte[] keyBytes = MessageDigest.getInstance("SHA-256")
                    .digest(secretHex.getBytes(StandardCharsets.UTF_8));
            SecretKeySpec keySpec = new SecretKeySpec(keyBytes, "AES");

            byte[] iv         = Base64.getDecoder().decode(ivBase64);
            byte[] ciphertext = Base64.getDecoder().decode(ciphertextBase64);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(128, iv));
            byte[] plaintext = cipher.doFinal(ciphertext);

            log.debug("[RESPONSE QUERIES] Payload decifrado com sucesso.");
            return new String(plaintext, StandardCharsets.UTF_8);

        } catch (Exception e) {
            log.error("[RESPONSE QUERIES] Falha ao decifrar payload do cliente: {}", e.getMessage());
            throw new RuntimeException("Erro ao decifrar payload: " + e.getMessage());
        }
    }

    // ─── Internal helper ─────────────────────────────────────────────────────

    private Map<String, String> encryptJson(String jsonPayload, String secretHex) throws Exception {
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
        return response;
    }
}
