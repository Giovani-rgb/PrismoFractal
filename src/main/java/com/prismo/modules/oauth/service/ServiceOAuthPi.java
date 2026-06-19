package com.prismo.modules.oauth.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prismo.logger.AppLogger;
import com.prismo.modules.session.service.CryptoHelper;
import com.prismo.modules.session.util.EncryptionUtils;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class ServiceOAuthPi {

    private final AppLogger     log;
    private final CryptoHelper  cryptoHelper;
    private final ObjectMapper  objectMapper;

    public ServiceOAuthPi(AppLogger log, CryptoHelper cryptoHelper, ObjectMapper objectMapper) {
        this.log          = log;
        this.cryptoHelper = cryptoHelper;
        this.objectMapper = objectMapper;
    }

    // =========================================================================
    // ROTA /r — Decifra o envelope RSA assinado pelo túnel DH e emite passaporte
    // =========================================================================

    /**
     * Recebe o envelope AES-GCM { iv, ciphertext } vindo do Angular.
     * Recupera o sharedSecret DH pelo freezerToken, decifra o payload,
     * valida a intenção e o id_prospect, e emite o serverSessionRef.
     *
     * @param freezerToken   Header X-Freezer-Token da sessão estabelecida
     * @param ivBase64       IV do envelope (base64, 12 bytes)
     * @param ciphertextBase64 Ciphertext AES-GCM (base64)
     * @return Passaporte de referência para a rota /PiOAuth (Stage 6)
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> handleOAuthPassportIssue(
            String freezerToken,
            String ivBase64,
            String ciphertextBase64
    ) {
        log.queries("Iniciando decifragem do envelope RSA-OAEP via túnel DH.");

        // 1. Recupera o sharedSecret DH vinculado ao freezerToken desta sessão
        String sharedSecret = cryptoHelper.getSecretByToken(freezerToken);
        if (sharedSecret == null || sharedSecret.isBlank()) {
            throw new RuntimeException(
                "Shared Secret não localizado: freezerToken inválido, expirado ou sessão encerrada."
            );
        }
        log.queries("Shared Secret DH recuperado com sucesso via freezerToken.");

        // 2. Decifra o envelope AES-GCM usando a chave derivada do sharedSecret
        String plainJson;
        try {
            plainJson = EncryptionUtils.decrypt(ivBase64, ciphertextBase64, sharedSecret);
        } catch (Exception e) {
            throw new RuntimeException("Falha na decifragem AES-GCM do envelope RSA: " + e.getMessage());
        }
        log.queries("Envelope decifrado com sucesso. Validando payload.");

        // 3. Parseia e valida o payload { id_prospect, clientPublicKeyRSA, intent, ts }
        Map<String, Object> payload;
        try {
            payload = objectMapper.readValue(plainJson, Map.class);
        } catch (Exception e) {
            throw new RuntimeException("Payload decifrado inválido (JSON malformado): " + e.getMessage());
        }

        String idProspect      = (String) payload.get("id_prospect");
        String clientPublicKey = (String) payload.get("clientPublicKeyRSA");
        String intent          = (String) payload.get("intent");

        if (idProspect == null || idProspect.isBlank()) {
            throw new RuntimeException("Validação falhou: id_prospect ausente no payload decifrado.");
        }
        if (!"PI_NETWORK_OAUTH_AUTHORIZATION".equals(intent)) {
            throw new RuntimeException("Validação falhou: intent inválido — '" + intent + "'.");
        }
        if (clientPublicKey == null || clientPublicKey.isBlank()) {
            throw new RuntimeException("Validação falhou: clientPublicKeyRSA ausente no payload decifrado.");
        }

        log.controllers("Payload validado. id_prospect={}, intent={}", idProspect, intent);

        // 4. Emite o passaporte de referência para o Stage 6
        return Map.of(
            "status",           "HANDSHAKE_OK",
            "serverSessionRef", Map.of(
                "validated_prospect", idProspect,
                "intent",             intent,
                "keyHint",            clientPublicKey.length() > 32
                                          ? clientPublicKey.substring(0, 32) + "..."
                                          : clientPublicKey,
                "ts",                 payload.getOrDefault("ts", System.currentTimeMillis())
            )
        );
    }

    // =========================================================================
    // ROTA /PiOAuth — Decifra payload de consolidação e finaliza autenticação Pi
    // =========================================================================

    /**
     * Recebe o envelope AES-GCM { iv, ciphertext } da consolidação Pi Network.
     * Decifra usando o mesmo sharedSecret DH, extrai piAuthData e persiste a identidade.
     *
     * @param freezerToken     Header X-Freezer-Token da sessão
     * @param ivBase64         IV do envelope (base64)
     * @param ciphertextBase64 Ciphertext AES-GCM (base64)
     * @return Payload final de autenticação consolidada
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> processPiNetworkAuthentication(
            String freezerToken,
            String ivBase64,
            String ciphertextBase64
    ) {
        log.queries("Iniciando consolidação Pi Network via decifragem do envelope DH-Signed.");

        // 1. Recupera o sharedSecret DH
        String sharedSecret = cryptoHelper.getSecretByToken(freezerToken);
        if (sharedSecret == null || sharedSecret.isBlank()) {
            throw new RuntimeException(
                "Shared Secret não localizado: freezerToken inválido ou sessão encerrada."
            );
        }

        // 2. Decifra o envelope
        String plainJson;
        try {
            plainJson = EncryptionUtils.decrypt(ivBase64, ciphertextBase64, sharedSecret);
        } catch (Exception e) {
            throw new RuntimeException("Falha na decifragem AES-GCM do payload Pi Network: " + e.getMessage());
        }

        // 3. Parseia { serverSessionRef, piAuthData, ts }
        Map<String, Object> payload;
        try {
            payload = objectMapper.readValue(plainJson, Map.class);
        } catch (Exception e) {
            throw new RuntimeException("Payload Pi Network inválido (JSON malformado): " + e.getMessage());
        }

        Map<String, Object> piAuthData     = (Map<String, Object>) payload.get("piAuthData");
        Map<String, Object> serverSession  = (Map<String, Object>) payload.get("serverSessionRef");

        if (piAuthData == null) {
            throw new RuntimeException("Validação falhou: piAuthData ausente no payload decifrado.");
        }

        String accessToken = (String) piAuthData.get("accessToken");
        Map<String, Object> user = (Map<String, Object>) piAuthData.get("user");

        log.controllers("Pi Network payload consolidado. Usuário: {}", user != null ? user.get("username") : "N/A");

        // 4. Retorna identidade consolidada
        return Map.of(
            "status",   "AUTH_CONSOLIDATED",
            "identity", Map.of(
                "uid",         user != null ? user.getOrDefault("uid",      "") : "",
                "username",    user != null ? user.getOrDefault("username", "") : "",
                "accessToken", accessToken != null ? accessToken : "",
                "sessionRef",  serverSession != null ? serverSession : Map.of()
            ),
            "permission", Map.of(
                "oauth", true,
                "piNetwork", true,
                "provider", "PI_NETWORK"
            )
        );
    }
}
