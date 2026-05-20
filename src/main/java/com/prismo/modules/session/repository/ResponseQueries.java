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
     * Sanitiza e criptografa os dados da sessão utilizando o Shared Secret do DH (em formato Hex).
     * Retorna a estrutura exata esperada pela interface EncryptedPayload do Frontend.
     */
    public Map<String, String> sanitizeAndEncrypt(Session session, String secretHex) {
        try {
            log.info("[RESPONSE QUERIES] Sanitizando dados para cifragem em runtime. Sessão: {}", session.getId());

            // 1. Mapeia estritamente os dados de negócio (Sem vazar tokens estruturais)
            Map<String, Object> data = new HashMap<>();
            data.put("id_prospect", session.getId());
            data.put("refs", session.getUserId()); 
            data.put("country", session.getCountry());
            data.put("revoked", session.isRevoked());
            data.put("keyUpdate", session.getKeyUpdate());
            data.put("createdAt", session.getCreatedAt());
            data.put("expiresAt", session.getExpiresAt());
            data.put("lastAccessAt", session.getLastAccessAt());

            // 2. Converte para string JSON minificada
            String jsonPayload = mapper.writeValueAsString(data);

            // 3. Resolve a chave do AES: Decodifica o Shared Secret de Hex para byte[] (32 bytes / 256 bits)
            byte[] keyBytes = hexToBytes(secretHex);
            SecretKeySpec keySpec = new SecretKeySpec(keyBytes, "AES");

            // 4. Gera um IV aleatório e seguro de 12 bytes (Padrão ouro do AES-GCM)
            byte[] iv = new byte[12];
            secureRandom.nextBytes(iv);

            // 5. Configura a cifragem AES-GCM (Tag de Autenticação de 128 bits / 16 bytes)
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            GCMParameterSpec parameterSpec = new GCMParameterSpec(128, iv);
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, parameterSpec);

            // Executa a cifragem. O Java injeta a Tag de autenticação automaticamente ao final do array
            byte[] ciphertext = cipher.doFinal(jsonPayload.getBytes("UTF-8"));

            // 6. Monta o mapa de resposta isolando os componentes em Base64
            Map<String, String> response = new HashMap<>();
            response.put("iv", Base64.getEncoder().encodeToString(iv));
            response.put("ciphertext", Base64.getEncoder().encodeToString(ciphertext));

            log.info("[RESPONSE QUERIES] Payload cifrado com sucesso. Pronto para consumo do Web Worker.");
            return response; 

        } catch (Exception e) {
            log.error("[RESPONSE QUERIES] Falha catastrófica ao cifrar resposta com a chave de runtime.", e);
            throw new RuntimeException("Erro ao processar e criptografar resposta da sessão", e);
        }
    }

    /**
     * Auxiliar indispensável para converter a String Hex do Diffie-Hellman em array de bytes utilizável pelo AES.
     */
    private byte[] hexToBytes(String hex) {
        if (hex == null || hex.length() == 0) {
            throw new IllegalArgumentException("O segredo compartilhado (Shared Secret) não pode ser nulo ou vazio.");
        }
        int len = hex.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4)
                                 + Character.digit(hex.charAt(i+1), 16));
        }
        return data;
    }
}
