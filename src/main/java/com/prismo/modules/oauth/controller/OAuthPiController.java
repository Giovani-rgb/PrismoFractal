package com.prismo.modules.oauth.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prismo.logger.AppLogger;
import com.prismo.modules.oauth.service.ServiceOAuthPi;
import com.prismo.modules.session.service.CryptoHelper;
import com.prismo.modules.session.util.EncryptionUtils;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/oauth")
public class OAuthPiController {

    private final ServiceOAuthPi service;
    private final AppLogger       log;
    private final CryptoHelper    cryptoHelper;
    private final ObjectMapper    objectMapper;

    public OAuthPiController(
            ServiceOAuthPi service,
            AppLogger       log,
            CryptoHelper    cryptoHelper,
            ObjectMapper    objectMapper
    ) {
        this.service      = service;
        this.log          = log;
        this.cryptoHelper = cryptoHelper;
        this.objectMapper = objectMapper;
    }

    // =========================================================================
    // ROTA 1: POST /r
    //
    // Recebe: { iv, ciphertext }  — AES-GCM(DH) cifrado pelo frontend
    // Devolve: { iv, ciphertext } — AES-GCM(DH) cifrado pelo backend
    //   Payload decifrado pelo cliente: { status, rsaEncryptedChallenge, serverSessionRef }
    //   O rsaEncryptedChallenge já está cifrado com RSA-OAEP(clientPublicKey)
    //   → dupla criptografia na camada do desafio
    // =========================================================================
    @PostMapping("/r")
    public ResponseEntity<?> handleOAuthHandshake(
            @RequestBody  Map<String, String> encryptedBody,
            @RequestHeader(value = "X-Freezer-Token", required = false) String freezerToken
    ) {
        try {
            log.controllers("Envelope DH-Signed recebido em /r. Iniciando decifragem.");

            if (freezerToken == null || freezerToken.isBlank()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "X-Freezer-Token ausente."));
            }

            String iv         = encryptedBody.get("iv");
            String ciphertext = encryptedBody.get("ciphertext");

            if (iv == null || ciphertext == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("error", "Envelope malformado: 'iv' e 'ciphertext' obrigatórios."));
            }

            Map<String, Object> result = service.handleOAuthPassportIssue(freezerToken, iv, ciphertext);

            // Cifra a resposta com AES-GCM(DH) — mesmo sharedSecret da sessão
            // O frontend decifra com decryptJson(response, sharedSecret)
            Map<String, String> encryptedResponse = encryptResponse(result, freezerToken);

            log.controllers("Passaporte /r emitido e cifrado com AES-GCM(DH).");
            return ResponseEntity.ok(encryptedResponse);

        } catch (RuntimeException e) {
            log.warning("Falha controlada em /r: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Erro crítico em /r", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erro interno: " + e.getMessage()));
        }
    }

    // =========================================================================
    // ROTA 2: POST /PiOAuth
    //
    // Recebe: { iv, ciphertext }  — AES-GCM(DH) + RSA proof cifrado pelo frontend
    // Devolve: { iv, ciphertext } — AES-GCM(DH) cifrado pelo backend
    //   Payload decifrado pelo cliente: { status, identity, permission }
    // =========================================================================
    @PostMapping("/PiOAuth")
    public ResponseEntity<?> authenticateWithPiNetwork(
            HttpServletRequest request,
            @RequestBody  Map<String, String> encryptedBody,
            @RequestHeader(value = "X-Freezer-Token", required = false) String freezerToken
    ) {
        try {
            log.controllers("Envelope DH-Signed recebido em /PiOAuth. Consolidando autenticação Pi.");

            if (freezerToken == null || freezerToken.isBlank()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "X-Freezer-Token ausente."));
            }

            String iv         = encryptedBody.get("iv");
            String ciphertext = encryptedBody.get("ciphertext");

            if (iv == null || ciphertext == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("error", "Envelope malformado: 'iv' e 'ciphertext' obrigatórios."));
            }

            Map<String, Object> result = service.processPiNetworkAuthentication(freezerToken, iv, ciphertext);

            // Cifra a resposta com AES-GCM(DH)
            Map<String, String> encryptedResponse = encryptResponse(result, freezerToken);

            log.controllers("Autenticação /PiOAuth consolidada e resposta cifrada com AES-GCM(DH).");
            return ResponseEntity.ok(encryptedResponse);

        } catch (RuntimeException e) {
            log.error("Falha controlada em /PiOAuth: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Erro crítico em /PiOAuth", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erro interno: " + e.getMessage()));
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UTIL: Serializa e cifra a resposta com AES-GCM(DH sharedSecret)
    // ─────────────────────────────────────────────────────────────────────────
    private Map<String, String> encryptResponse(Map<String, Object> data, String freezerToken) throws Exception {
        String sharedSecret = cryptoHelper.getSecretByToken(freezerToken);
        if (sharedSecret == null || sharedSecret.isBlank()) {
            throw new RuntimeException("sharedSecret não encontrado para cifrar resposta.");
        }
        String json = objectMapper.writeValueAsString(data);
        return EncryptionUtils.encryptToEnvelope(json, sharedSecret);
    }
}
