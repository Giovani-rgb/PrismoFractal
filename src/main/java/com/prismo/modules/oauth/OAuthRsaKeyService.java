package com.prismo.modules.oauth;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.security.*;
import java.security.interfaces.RSAPublicKey;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Gera e mantém em memória o par RSA-2048 usado para assinar tokens OAuth (RS256).
 * A chave pública é exposta via /.well-known/jwks.json para que o Google
 * (e qualquer client OIDC) possa verificar tokens emitidos pelo Prismo.
 */
@Service
public class OAuthRsaKeyService {

    private static final Logger log = LoggerFactory.getLogger(OAuthRsaKeyService.class);

    private KeyPair keyPair;
    private String  kid;

    @PostConstruct
    public void init() throws NoSuchAlgorithmException {
        KeyPairGenerator gen = KeyPairGenerator.getInstance("RSA");
        gen.initialize(2048, new SecureRandom());
        this.keyPair = gen.generateKeyPair();
        this.kid     = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        log.info("[OAuth RSA] 🔑 Par RSA-2048 gerado com sucesso. KID: {}", this.kid);
    }

    public PublicKey getPublicKey()   { return keyPair.getPublic();  }
    public PrivateKey getPrivateKey() { return keyPair.getPrivate(); }
    public String getKid()            { return kid; }

    /**
     * Retorna a chave pública no formato JWK (JSON Web Key) para o endpoint JWKS.
     */
    public Map<String, Object> toJwk() {
        RSAPublicKey pub = (RSAPublicKey) keyPair.getPublic();

        // Encode Big Integers sem sinal, URL-safe Base64, sem padding
        String n = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(toUnsignedBytes(pub.getModulus().toByteArray()));
        String e = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(toUnsignedBytes(pub.getPublicExponent().toByteArray()));

        Map<String, Object> jwk = new LinkedHashMap<>();
        jwk.put("kty", "RSA");
        jwk.put("use", "sig");
        jwk.put("alg", "RS256");
        jwk.put("kid", kid);
        jwk.put("n",   n);
        jwk.put("e",   e);
        return jwk;
    }

    /** Remove byte de sinal (0x00) que BigInteger adiciona para números positivos. */
    private byte[] toUnsignedBytes(byte[] bytes) {
        if (bytes.length > 1 && bytes[0] == 0) {
            byte[] trimmed = new byte[bytes.length - 1];
            System.arraycopy(bytes, 1, trimmed, 0, trimmed.length);
            return trimmed;
        }
        return bytes;
    }
}
