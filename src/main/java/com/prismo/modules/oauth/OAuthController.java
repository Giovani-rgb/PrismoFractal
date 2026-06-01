package com.prismo.modules.oauth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Expõe os endpoints OIDC discovery para que o Google OAuth possa
 * validar tokens assinados com a chave RSA do Prismo.
 */
@RestController
public class OAuthController {

    private static final Logger log = LoggerFactory.getLogger(OAuthController.class);

    private final OAuthRsaKeyService rsaKeyService;

    public OAuthController(OAuthRsaKeyService rsaKeyService) {
        this.rsaKeyService = rsaKeyService;
    }

    /**
     * GET /.well-known/jwks.json
     * Retorna o conjunto de chaves públicas JWK para verificação de tokens RS256.
     */
    @GetMapping(value = "/.well-known/jwks.json", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> jwks() {
        log.debug("[OAuth] JWKS solicitado.");
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("keys", List.of(rsaKeyService.toJwk()));
        return ResponseEntity.ok(response);
    }

    /**
     * GET /.well-known/openid-configuration
     * Documento de descoberta OIDC para integrações de terceiros.
     */
    @GetMapping(value = "/.well-known/openid-configuration", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> oidcDiscovery() {
        log.debug("[OAuth] OIDC discovery solicitado.");
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("issuer",                                "https://prismo.app");
        config.put("jwks_uri",                              "/.well-known/jwks.json");
        config.put("authorization_endpoint",                "https://prismo.app/oauth/authorize");
        config.put("token_endpoint",                        "https://prismo.app/oauth/token");
        config.put("response_types_supported",              List.of("code", "token", "id_token"));
        config.put("subject_types_supported",               List.of("public"));
        config.put("id_token_signing_alg_values_supported", List.of("RS256"));
        config.put("scopes_supported",                      List.of("openid", "profile", "email"));
        config.put("token_endpoint_auth_methods_supported", List.of("client_secret_basic", "private_key_jwt"));
        return ResponseEntity.ok(config);
    }
}
