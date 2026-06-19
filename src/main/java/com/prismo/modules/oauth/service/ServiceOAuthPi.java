package com.prismo.modules.oauth.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prismo.logger.AppLogger;
import com.prismo.modules.session.service.CryptoHelper;
import com.prismo.modules.session.util.EncryptionUtils;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
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

    private final AppLogger    log;
    private final CryptoHelper cryptoHelper;
    private final ObjectMapper objectMapper;
    private final SecureRandom secureRandom = new SecureRandom();

    // Armazena o challenge RSA em RAM: { id_prospect → challengeHex }
    // Uso único: gerado em /r, consumido em /PiOAuth.
    private final ConcurrentHashMap<String, String> rsaChallenges = new ConcurrentHashMap<>();

    // Spec de padding alinhada ao SubtleCrypto do browser:
    //   RSA-OAEP + SHA-256 (hash e MGF1)
    private static final OAEPParameterSpec OAEP_SPEC = new OAEPParameterSpec(
        "SHA-256", "MGF1", new MGF1ParameterSpec("SHA-256"), PSource.PSpecified.DEFAULT
    );

    public ServiceOAuthPi(AppLogger log, CryptoHelper cryptoHelper, ObjectMapper objectMapper) {
        this.log          = log;
        this.cryptoHelper = cryptoHelper;
        this.objectMapper = objectMapper;
    }

    // =========================================================================
    // ROTA /r — Dupla validação + geração do challenge RSA-OAEP
    //
    // Fluxo:
    //   1. Recupera sharedSecret DH via freezerToken
    //   2. Decifra envelope AES-GCM(DH) → extrai { id_prospect, clientPublicKeyRSA, intent }
    //   3. Valida id_prospect e intent
    //   4. Importa clientPublicKeyRSA como X.509 / SPKI
    //   5. Gera challenge aleatório (32 bytes → hex)
    //   6. Cifra challenge com RSA-OAEP(clientPublicKeyRSA) → rsaEncryptedChallenge
    //   7. Persiste challenge em RAM keyed por id_prospect
    //   8. Retorna { status, serverSessionRef, rsaEncryptedChallenge }
    // =========================================================================
    @SuppressWarnings("unchecked")
    public Map<String, Object> handleOAuthPassportIssue(
            String freezerToken,
            String ivBase64,
            String ciphertextBase64
    ) {
        log.queries("Iniciando /r: decifragem AES-GCM(DH) + geração de challenge RSA-OAEP.");

        // 1. Shared Secret DH via freezerToken
        String sharedSecret = cryptoHelper.getSecretByToken(freezerToken);
        if (sharedSecret == null || sharedSecret.isBlank()) {
            throw new RuntimeException("Shared Secret não localizado: freezerToken inválido ou expirado.");
        }

        // 2. Decifrar envelope AES-GCM
        String plainJson;
        try {
            plainJson = EncryptionUtils.decrypt(ivBase64, ciphertextBase64, sharedSecret);
        } catch (Exception e) {
            throw new RuntimeException("Falha na decifragem AES-GCM do envelope /r: " + e.getMessage());
        }

        // 3. Parsear e validar payload
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

        // 4. Importar chave pública RSA-OAEP do cliente (formato SPKI / X.509)
        PublicKey rsaPublicKey;
        try {
            byte[] keyBytes = Base64.getDecoder().decode(clientPublicKey);
            rsaPublicKey = KeyFactory.getInstance("RSA")
                    .generatePublic(new X509EncodedKeySpec(keyBytes));
        } catch (Exception e) {
            throw new RuntimeException("Falha ao importar clientPublicKeyRSA (SPKI inválido): " + e.getMessage());
        }

        // 5. Gerar challenge aleatório (32 bytes → hex lowercase)
        byte[] challengeBytes = new byte[32];
        secureRandom.nextBytes(challengeBytes);
        StringBuilder hexBuilder = new StringBuilder(64);
        for (byte b : challengeBytes) {
            hexBuilder.append(String.format("%02x", b));
        }
        String challenge = hexBuilder.toString();

        // 6. Cifrar challenge com RSA-OAEP(SHA-256 / MGF1-SHA-256)
        //    Alinhado ao SubtleCrypto: { name: 'RSA-OAEP', hash: 'SHA-256' }
        String rsaEncryptedChallenge;
        try {
            Cipher rsaCipher = Cipher.getInstance("RSA/ECB/OAEPPadding");
            rsaCipher.init(Cipher.ENCRYPT_MODE, rsaPublicKey, OAEP_SPEC);
            byte[] encrypted = rsaCipher.doFinal(challenge.getBytes("UTF-8"));
            rsaEncryptedChallenge = Base64.getEncoder().encodeToString(encrypted);
        } catch (Exception e) {
            throw new RuntimeException("Falha ao cifrar challenge com RSA-OAEP: " + e.getMessage());
        }

        // 7. Persiste challenge em RAM (uso único — consumido em /PiOAuth)
        rsaChallenges.put(idProspect, challenge);
        log.controllers("Challenge RSA-OAEP gerado e cifrado para id_prospect={}.", idProspect);

        // 8. Retorna passaporte com rsaEncryptedChallenge
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
    // ROTA /PiOAuth — Consolidação Pi Network selada pelas duas criptografias
    //
    // Camada 1 (DH):  AES-GCM(sharedSecret) → abre o envelope
    // Camada 2 (RSA): rsaProof deve bater com o challenge armazenado
    //                 → prova que o cliente decifrou o RSA-OAEP em /r
    //
    // Fluxo:
    //   1. Decifra AES-GCM(DH)
    //   2. Extrai rsaProof + piAuthData + serverSessionRef
    //   3. Recupera challenge armazenado (id_prospect do serverSessionRef)
    //   4. Verifica rsaProof == challenge (timing-safe)
    //   5. Remove challenge (uso único)
    //   6. Retorna identidade consolidada
    // =========================================================================
    @SuppressWarnings("unchecked")
    public Map<String, Object> processPiNetworkAuthentication(
            String freezerToken,
            String ivBase64,
            String ciphertextBase64
    ) {
        log.queries("Iniciando /PiOAuth: decifragem AES-GCM(DH) + verificação RSA proof.");

        // 1. Shared Secret DH
        String sharedSecret = cryptoHelper.getSecretByToken(freezerToken);
        if (sharedSecret == null || sharedSecret.isBlank()) {
            throw new RuntimeException("Shared Secret não localizado: freezerToken inválido ou expirado.");
        }

        // 2. Decifrar envelope AES-GCM
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

        // 3. Extrair campos
        String              rsaProof      = (String)              payload.get("rsaProof");
        Map<String, Object> piAuthData    = (Map<String, Object>) payload.get("piAuthData");
        Map<String, Object> serverSession = (Map<String, Object>) payload.get("serverSessionRef");

        if (rsaProof == null || rsaProof.isBlank()) {
            throw new RuntimeException("Verificação RSA /PiOAuth: rsaProof ausente no payload.");
        }
        if (piAuthData == null) {
            throw new RuntimeException("Verificação /PiOAuth: piAuthData ausente no payload.");
        }

        // 4. Recuperar e verificar o challenge RSA
        String idProspect = serverSession != null
                ? (String) serverSession.get("validated_prospect")
                : null;

        if (idProspect == null || idProspect.isBlank()) {
            throw new RuntimeException("Verificação RSA /PiOAuth: id_prospect ausente no serverSessionRef.");
        }

        String storedChallenge = rsaChallenges.get(idProspect);
        if (storedChallenge == null) {
            throw new RuntimeException(
                "Verificação RSA /PiOAuth: challenge não localizado para o prospect. "
                + "O fluxo /r não foi concluído ou o challenge já foi consumido."
            );
        }

        // Comparação timing-safe (evita timing attacks)
        if (!timingSafeEquals(rsaProof, storedChallenge)) {
            rsaChallenges.remove(idProspect); // descarta mesmo em falha
            throw new RuntimeException(
                "Verificação RSA /PiOAuth: rsaProof inválido. "
                + "Posse da chave privada RSA não confirmada — acesso negado."
            );
        }

        // 5. Consome o challenge (uso único)
        rsaChallenges.remove(idProspect);
        log.controllers("Dupla verificação OK: AES-GCM(DH) ✅  RSA-OAEP proof ✅  id_prospect={}.", idProspect);

        // 6. Retorna identidade Pi Network consolidada
        String              accessToken = (String)              piAuthData.get("accessToken");
        Map<String, Object> user        = (Map<String, Object>) piAuthData.get("user");

        log.controllers("Pi Network consolidado. Usuário: {}.", user != null ? user.get("username") : "N/A");

        return Map.of(
            "status",   "AUTH_CONSOLIDATED",
            "identity", Map.of(
                "uid",         user != null ? user.getOrDefault("uid",      "") : "",
                "username",    user != null ? user.getOrDefault("username", "") : "",
                "accessToken", accessToken != null ? accessToken : "",
                "sessionRef",  serverSession != null ? serverSession : Map.of()
            ),
            "permission", Map.of(
                "oauth",     true,
                "piNetwork", true,
                "provider",  "PI_NETWORK",
                "dualSeal",  true   // AES-GCM(DH) + RSA-OAEP ambos verificados
            )
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UTIL: Comparação em tempo constante (timing-safe equals)
    // ─────────────────────────────────────────────────────────────────────────
    private static boolean timingSafeEquals(String a, String b) {
        if (a == null || b == null) return false;
        byte[] aBytes = a.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        byte[] bBytes = b.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        if (aBytes.length != bBytes.length) return false;
        int result = 0;
        for (int i = 0; i < aBytes.length; i++) {
            result |= aBytes[i] ^ bBytes[i];
        }
        return result == 0;
    }
}
