package com.prismo.modules.session.util;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

public class EncryptionUtils {
    private static final String ALGO = "AES/GCM/NoPadding";
    private static final int TAG_LENGTH = 128;
    private static final int IV_LENGTH = 12;

    /**
     * Deriva uma chave AES-256 a partir de qualquer string via SHA-256.
     * Garante sempre exatamente 32 bytes, independente do tamanho do segredo (ex: DH shared secret hex).
     */
    private static byte[] deriveKey(String secret) throws Exception {
        return MessageDigest.getInstance("SHA-256")
                .digest(secret.getBytes(StandardCharsets.UTF_8));
    }

    public static String encrypt(String data, String secret) throws Exception {
        byte[] iv = new byte[IV_LENGTH];
        new SecureRandom().nextBytes(iv);

        SecretKeySpec keySpec = new SecretKeySpec(deriveKey(secret), "AES");
        Cipher cipher = Cipher.getInstance(ALGO);
        cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(TAG_LENGTH, iv));

        byte[] encrypted = cipher.doFinal(data.getBytes(StandardCharsets.UTF_8));
        byte[] combined = new byte[IV_LENGTH + encrypted.length];
        System.arraycopy(iv, 0, combined, 0, IV_LENGTH);
        System.arraycopy(encrypted, 0, combined, IV_LENGTH, encrypted.length);

        return Base64.getEncoder().encodeToString(combined);
    }
}
