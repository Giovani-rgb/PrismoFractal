package com.prismo.modules.session.util;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

public class EncryptionUtils {
    private static final String ALGO       = "AES/GCM/NoPadding";
    private static final int    TAG_LENGTH = 128;
    private static final int    IV_LENGTH  = 12;

    /**
     * Deriva uma chave AES-256 a partir de qualquer string via SHA-256.
     * Espelha exatamente o que o front faz:
     *   SHA-256( TextEncoder.encode(secret) ) → importKey('raw', hash, 'AES-GCM')
     */
    private static byte[] deriveKey(String secret) throws Exception {
        return MessageDigest.getInstance("SHA-256")
                .digest(secret.getBytes(StandardCharsets.UTF_8));
    }

    // =========================================================================
    // ENCRYPT — combina IV + ciphertext em um único Base64 (legacy)
    // =========================================================================
    public static String encrypt(String data, String secret) throws Exception {
        byte[] iv = new byte[IV_LENGTH];
        new SecureRandom().nextBytes(iv);

        SecretKeySpec keySpec = new SecretKeySpec(deriveKey(secret), "AES");
        Cipher cipher = Cipher.getInstance(ALGO);
        cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(TAG_LENGTH, iv));

        byte[] encrypted = cipher.doFinal(data.getBytes(StandardCharsets.UTF_8));
        byte[] combined  = new byte[IV_LENGTH + encrypted.length];
        System.arraycopy(iv,        0, combined, 0,         IV_LENGTH);
        System.arraycopy(encrypted, 0, combined, IV_LENGTH, encrypted.length);

        return Base64.getEncoder().encodeToString(combined);
    }

    // =========================================================================
    // ENCRYPT TO ENVELOPE — retorna { iv: base64, ciphertext: base64 }
    // Formato idêntico ao que encryptJson() produz no Angular/SubtleCrypto.
    // Usado para cifrar respostas do servidor que o frontend vai decifrar.
    // =========================================================================
    public static java.util.Map<String, String> encryptToEnvelope(String data, String secret) throws Exception {
        byte[] iv = new byte[IV_LENGTH];
        new SecureRandom().nextBytes(iv);

        SecretKeySpec keySpec = new SecretKeySpec(deriveKey(secret), "AES");
        Cipher cipher = Cipher.getInstance(ALGO);
        cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(TAG_LENGTH, iv));

        byte[] encrypted = cipher.doFinal(data.getBytes(StandardCharsets.UTF_8));

        return java.util.Map.of(
            "iv",         Base64.getEncoder().encodeToString(iv),
            "ciphertext", Base64.getEncoder().encodeToString(encrypted)
        );
    }

    // =========================================================================
    // DECRYPT — recebe { iv: base64, ciphertext: base64 } separados
    // Formato idêntico ao que o front produz com encryptJson():
    //   iv         → btoa(String.fromCharCode(...iv_12_bytes))
    //   ciphertext → btoa(String.fromCharCode(...aesgcm_output))
    // =========================================================================
    public static String decrypt(String ivBase64, String ciphertextBase64, String secret) throws Exception {
        byte[] iv         = Base64.getDecoder().decode(ivBase64);
        byte[] ciphertext = Base64.getDecoder().decode(ciphertextBase64);

        SecretKeySpec keySpec = new SecretKeySpec(deriveKey(secret), "AES");
        Cipher cipher = Cipher.getInstance(ALGO);
        cipher.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(TAG_LENGTH, iv));

        byte[] decrypted = cipher.doFinal(ciphertext);
        return new String(decrypted, StandardCharsets.UTF_8);
    }
}
