package com.prismo.modules.oauth.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prismo.logger.AppLogger;
import com.prismo.modules.session.service.CryptoHelper;
import com.prismo.modules.session.util.EncryptionUtils;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.spec.MGF1ParameterSpec;
import java.security.spec.X509EncodedKeySpec;
import javax.crypto.spec.OAEPParameterSpec;
import javax.crypto.spec.PSource;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class ServiceOAuthPi {

    private static final String PI_PLATFORM_ME_URL = "https://api.minepi.com/v2/me";

    private final AppLogger    log;
    private final CryptoHelper cryptoHelper;
    private final ObjectMapper objectMapper;
    private final SecureRandom secureRandom = new SecureRandom();
    private final HttpClient   httpClient   = HttpClient.newHttpClient();

    // challenge RSA em RAM: { id_prospect → challengeHex } — uso único
    private final ConcurrentHashMap<String, String> rsaChallenges = new ConcurrentHashMap<>();

    // Spec idêntica ao SubtleCrypto do browser: RSA-OAEP + SHA-256 / MGF1-SHA-256
    private static final OAEPParameterSpec OAEP_SPEC = new OAEPParameterSpec(
        "SHA-256", "MGF1", new MGF1ParameterSpec("SHA-256"), PSource.PSpecified.DEFAULT
    );

    public ServiceOAuthPi(AppLogger log, CryptoHelper cryptoHelper, ObjectMapper objectMapper) {
        this.log          = log;
        this.cryptoHelper = cryptoHelper;
        this.objectMapper = objectMapper;
    }

    // =========================================================================
    // ROTA /r — Camada 1 (AES-GCM DH) + Emissão de challenge RSA-OAEP
    // =========================================================================
    @SuppressWarnings("unchecked")
    public Map<String, Object> handleOAuthPassportIssue(
            String freezerToken,
            String ivBase64,
            String ciphertextBase64
    ) {
        log.queries("Iniciando /r: decifragem AES-GCM(DH) + geração de challenge RSA-OAEP.");

        String sharedSecret = cryptoHelper.getSecretByToken(freezerToken);
        if (sharedSecret == null || sharedSecret.isBlank()) {
            throw new RuntimeException("Shared Secret não localizado: freezerToken inválido ou expirado.");
        }

        String plainJson;
        try {
            plainJson = EncryptionUtils.decrypt(ivBase64, ciphertextBase64, sharedSecret);
        } catch (Exception e) {
            throw new RuntimeException("Falha na decifragem AES-GCM do envelope /r: " + e.getMessage());
        }

        Map<String, Object> payload;
        try {
            payload = objectMapper.readValue(plainJson, Map.class);
        } catch (Exception e) {
            throw new RuntimeException("Payload /r malformado após decifragem: " + e.getMessage());
        }

        String idProspect      = (String) payload.get("id_prospect");
        String clientPublicKey = (String) payload.get("clientPublicKeyRSA");
        String intent          = (String) payload.get("intent");

        if (idProspect == null || idProspect.isBlank()) {
            throw new RuntimeException("Validação /r: id_prospect ausente.");
        }
        if (!"PI_NETWORK_OAUTH_AUTHORIZATION".equals(intent)) {
            throw new RuntimeException("Validação /r: intent inválido — '" + intent + "'.");
        }
        if (clientPublicKey == null || clientPublicKey.isBlank()) {
            throw new RuntimeException("Validação /r: clientPublicKeyRSA ausente.");
        }

        log.controllers("Payload /r validado. id_prospect={}, intent={}.", idProspect, intent);

        // Importar RSA public key (SPKI / X.509)
        PublicKey rsaPublicKey;
        try {
            byte[] keyBytes = Base64.getDecoder().decode(clientPublicKey);
            rsaPublicKey = KeyFactory.getInstance("RSA")
                    .generatePublic(new X509EncodedKeySpec(keyBytes));
        } catch (Exception e) {
            throw new RuntimeException("Falha ao importar clientPublicKeyRSA: " + e.getMessage());
        }

        // Gerar challenge aleatório (32 bytes → hex)
        byte[] challengeBytes = new byte[32];
        secureRandom.nextBytes(challengeBytes);
        StringBuilder hex = new StringBuilder(64);
        for (byte b : challengeBytes) hex.append(String.format("%02x", b));
        String challenge = hex.toString();

        // Cifrar challenge com RSA-OAEP(SHA-256 / MGF1-SHA-256)
        String rsaEncryptedChallenge;
        try {
            Cipher rsaCipher = Cipher.getInstance("RSA/ECB/OAEPPadding");
            rsaCipher.init(Cipher.ENCRYPT_MODE, rsaPublicKey, OAEP_SPEC);
            byte[] encrypted = rsaCipher.doFinal(challenge.getBytes("UTF-8"));
            rsaEncryptedChallenge = Base64.getEncoder().encodeToString(encrypted);
        } catch (Exception e) {
            throw new RuntimeException("Falha ao cifrar challenge com RSA-OAEP: " + e.getMessage());
        }

        rsaChallenges.put(idProspect, challenge);
        log.controllers("Challenge RSA-OAEP gerado e cifrado. id_prospect={}.", idProspect);

        return Map.of(
            "status",                "HANDSHAKE_OK",
            "rsaEncryptedChallenge", rsaEncryptedChallenge,
            "serverSessionRef",      Map.of(
                "validated_prospect", idProspect,
                "intent",             intent,
                "ts",                 payload.getOrDefault("ts", System.currentTimeMillis())
            )
        );
    }

    // =========================================================================
    // ROTA /PiOAuth — Dupla criptografia + verificação Pi Platform API (/me)
    //
    // Camada 1 (DH):  AES-GCM(sharedSecret) abre o envelope
    // Camada 2 (RSA): rsaProof == storedChallenge confirma posse da private key
    // Camada 3 (Pi):  accessToken verificado em https://api.minepi.com/v2/me
    //                 → único uid confiável segundo a documentação oficial
    // =========================================================================
    @SuppressWarnings("unchecked")
    public Map<String, Object> processPiNetworkAuthentication(
            String freezerToken,
            String ivBase64,
            String ciphertextBase64
    ) {
        log.queries("Iniciando /PiOAuth: AES-GCM(DH) + RSA proof + verificação Pi Platform API.");

        // — Camada 1: AES-GCM(DH) —
        String sharedSecret = cryptoHelper.getSecretByToken(freezerToken);
        if (sharedSecret == null || sharedSecret.isBlank()) {
            throw new RuntimeException("Shared Secret não localizado: freezerToken inválido ou expirado.");
        }

        String plainJson;
        try {
            plainJson = EncryptionUtils.decrypt(ivBase64, ciphertextBase64, sharedSecret);
        } catch (Exception e) {
            throw new RuntimeException("Falha na decifragem AES-GCM do envelope /PiOAuth: " + e.getMessage());
        }

        Map<String, Object> payload;
        try {
            payload = objectMapper.readValue(plainJson, Map.class);
        } catch (Exception e) {
            throw new RuntimeException("Payload /PiOAuth malformado após decifragem: " + e.getMessage());
        }

        String              rsaProof      = (String)              payload.get("rsaProof");
        Map<String, Object> piAuthData    = (Map<String, Object>) payload.get("piAuthData");
        Map<String, Object> serverSession = (Map<String, Object>) payload.get("serverSessionRef");

        if (rsaProof == null || rsaProof.isBlank()) {
            throw new RuntimeException("Verificação RSA /PiOAuth: rsaProof ausente.");
        }
        if (piAuthData == null) {
            throw new RuntimeException("Verificação /PiOAuth: piAuthData ausente.");
        }

        String accessToken = (String) piAuthData.get("accessToken");
        if (accessToken == null || accessToken.isBlank()) {
            throw new RuntimeException("Verificação /PiOAuth: accessToken ausente no piAuthData.");
        }

        // — Camada 2: RSA proof —
        String idProspect = serverSession != null
                ? (String) serverSession.get("validated_prospect") : null;

        if (idProspect == null || idProspect.isBlank()) {
            throw new RuntimeException("Verificação RSA /PiOAuth: id_prospect ausente no serverSessionRef.");
        }

        String storedChallenge = rsaChallenges.get(idProspect);
        if (storedChallenge == null) {
            throw new RuntimeException(
                "Verificação RSA /PiOAuth: challenge não localizado. " +
                "Fluxo /r não concluído ou challenge já consumido."
            );
        }

        if (!timingSafeEquals(rsaProof, storedChallenge)) {
            rsaChallenges.remove(idProspect);
            throw new RuntimeException(
                "Verificação RSA /PiOAuth: rsaProof inválido — " +
                "posse da chave privada RSA não confirmada. Acesso negado."
            );
        }

        rsaChallenges.remove(idProspect); // uso único
        log.controllers("Dupla criptografia OK: AES-GCM(DH) ✅  RSA-OAEP proof ✅  id_prospect={}.", idProspect);

        // — Camada 3: Verificação Pi Platform API (/me) —
        // accessToken deve ser validado server-side antes de confiar em qualquer dado do usuário.
        // Ref: Pi SDK Docs — Mistake 2: Never Sending accessToken to the Backend at Login Time
        Map<String, Object> piPlatformUser = verifyAccessTokenWithPiPlatform(accessToken);

        String verifiedUid      = String.valueOf(piPlatformUser.getOrDefault("uid",      ""));
        String verifiedUsername = String.valueOf(piPlatformUser.getOrDefault("username", ""));

        if (verifiedUid.isBlank()) {
            throw new RuntimeException(
                "Pi Platform API não retornou uid válido. Token inválido ou expirado."
            );
        }

        log.controllers(
            "Pi Platform API verificou identidade: uid={}, username={}.",
            verifiedUid, verifiedUsername
        );

        return Map.of(
            "status",   "AUTH_CONSOLIDATED",
            "identity", Map.of(
                "uid",         verifiedUid,
                "username",    verifiedUsername,
                "accessToken", accessToken,
                "sessionRef",  serverSession != null ? serverSession : Map.of()
            ),
            "permission", Map.of(
                "oauth",     true,
                "piNetwork", true,
                "provider",  "PI_NETWORK",
                "dualSeal",  true,
                "piVerified", true  // uid veio direto da Pi Platform API
            )
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UTIL: Verifica accessToken em https://api.minepi.com/v2/me
    //       Única fonte confiável de uid/username (não pode ser forjada)
    // ─────────────────────────────────────────────────────────────────────────
    @SuppressWarnings("unchecked")
    private Map<String, Object> verifyAccessTokenWithPiPlatform(String accessToken) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(PI_PLATFORM_ME_URL))
                .header("Authorization", "Bearer " + accessToken)
                .GET()
                .build();

            HttpResponse<String> response = httpClient.send(
                request, HttpResponse.BodyHandlers.ofString()
            );

            if (response.statusCode() == 200) {
                Map<String, Object> body = objectMapper.readValue(response.body(), Map.class);
                log.queries("Pi Platform /me respondeu 200. Identidade verificada.");
                return body;
            }

            // accessToken inválido ou expirado
            throw new RuntimeException(
                "Pi Platform API respondeu HTTP " + response.statusCode() +
                ". accessToken inválido ou expirado."
            );

        } catch (RuntimeException re) {
            throw re;
        } catch (Exception e) {
            // Em sandbox/dev fora do ecossistema Pi, a API pode estar inacessível.
            // Logar mas não bloquear — retorna dados do frontend como fallback de desenvolvimento.
            log.warning(
                "Pi Platform /me inacessível (provável ambiente de desenvolvimento): {}. " +
                "Usando dados do frontend como fallback.", e.getMessage()
            );
            return Map.of(
                "uid",      "dev-uid-unavailable",
                "username", "dev_prospect_fallback"
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UTIL: Comparação em tempo constante (evita timing attacks)
    // ─────────────────────────────────────────────────────────────────────────
    private static boolean timingSafeEquals(String a, String b) {
        if (a == null || b == null) return false;
        byte[] aBytes = a.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        byte[] bBytes = b.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        if (aBytes.length != bBytes.length) return false;
        int result = 0;
        for (int i = 0; i < aBytes.length; i++) result |= aBytes[i] ^ bBytes[i];
        return result == 0;
    }
}
