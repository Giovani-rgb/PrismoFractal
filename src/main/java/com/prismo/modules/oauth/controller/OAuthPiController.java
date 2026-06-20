package com.prismo.modules.oauth.controller;

import com.prismo.logger.AppLogger;
import com.prismo.modules.oauth.service.ServiceOAuthPi;
import com.prismo.modules.session.repository.ResponseQueries;
import com.prismo.modules.session.service.CryptoHelper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/oauth")
public class OAuthPiController {

    private final ServiceOAuthPi  service;
    private final AppLogger        log;
    private final CryptoHelper     cryptoHelper;
    private final ResponseQueries  responseQueries;

    public OAuthPiController(
            ServiceOAuthPi  service,
            AppLogger        log,
            CryptoHelper     cryptoHelper,
            ResponseQueries  responseQueries
    ) {
        this.service         = service;
        this.log             = log;
        this.cryptoHelper    = cryptoHelper;
        this.responseQueries = responseQueries;
    }

    // =========================================================================
    // ROTA 1: POST /r
    //
    // Recebe: { iv, ciphertext } — AES-GCM(DH) cifrado pelo frontend
    // Devolve: { iv, ciphertext } — AES-GCM(DH) cifrado pelo backend via ResponseQueries
    //   Payload decifrado: { status, rsaEncryptedChallenge, serverSessionRef }
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

            Map<String, Object> result       = service.handleOAuthPassportIssue(freezerToken, iv, ciphertext);
            String              sharedSecret = cryptoHelper.getSecretByToken(freezerToken);
            Map<String, String> envelope     = responseQueries.encryptGenericPayload(result, sharedSecret);

            log.controllers("Passaporte /r emitido e cifrado com AES-GCM(DH) via ResponseQueries.");
            return ResponseEntity.ok(envelope);

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
    // Recebe: { iv, ciphertext } — AES-GCM(DH) + RSA proof cifrado pelo frontend
    // Devolve: { iv, ciphertext } — AES-GCM(DH) cifrado pelo backend via ResponseQueries
    //   Payload decifrado: { status, identity, permission }
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

            Map<String, Object> result       = service.processPiNetworkAuthentication(freezerToken, iv, ciphertext);
            String              sharedSecret = cryptoHelper.getSecretByToken(freezerToken);
            Map<String, String> envelope     = responseQueries.encryptGenericPayload(result, sharedSecret);

            log.controllers("Autenticação /PiOAuth consolidada e cifrada com AES-GCM(DH) via ResponseQueries.");
            return ResponseEntity.ok(envelope);

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
}
