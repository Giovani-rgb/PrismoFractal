package com.prismo.modules.oauth.controller;

import com.prismo.logger.AppLogger;
import com.prismo.modules.oauth.service.ServiceOAuthPi;
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

    public OAuthPiController(ServiceOAuthPi service, AppLogger log) {
        this.service = service;
        this.log     = log;
    }

    // =========================================================================
    // ROTA 1: POST /r — Decifragem do Envelope RSA-OAEP via Túnel DH
    //
    // Body esperado (AES-GCM DH-Signed):
    //   { "iv": "<base64>", "ciphertext": "<base64>" }
    //
    // Payload decifrado pelo servidor:
    //   { id_prospect, clientPublicKeyRSA, intent, ts }
    //
    // Header obrigatório: X-Freezer-Token (freezerToken da sessão DH ativa)
    // =========================================================================
    @PostMapping("/r")
    public ResponseEntity<?> handleOAuthHandshake(
            @RequestBody  Map<String, String> encryptedBody,
            @RequestHeader(value = "X-Freezer-Token", required = false) String freezerToken
    ) {
        try {
            log.controllers("Envelope DH-Signed recebido na rota /r. Iniciando decifragem RSA.");

            if (freezerToken == null || freezerToken.isBlank()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "X-Freezer-Token ausente: sessão DH não identificada."));
            }

            String iv         = encryptedBody.get("iv");
            String ciphertext = encryptedBody.get("ciphertext");

            if (iv == null || ciphertext == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("error", "Envelope malformado: campos 'iv' e 'ciphertext' são obrigatórios."));
            }

            Map<String, Object> result = service.handleOAuthPassportIssue(freezerToken, iv, ciphertext);

            log.controllers("Passaporte OAuth emitido com sucesso via decifragem DH.");
            return ResponseEntity.ok(result);

        } catch (RuntimeException e) {
            log.warning("Falha controlada no fluxo /r: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Erro crítico inesperado na rota /r", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erro interno: " + e.getMessage()));
        }
    }

    // =========================================================================
    // ROTA 2: POST /PiOAuth — Consolidação Pi Network via Envelope DH-Signed
    //
    // Body esperado (AES-GCM DH-Signed):
    //   { "iv": "<base64>", "ciphertext": "<base64>" }
    //
    // Payload decifrado pelo servidor:
    //   { serverSessionRef, piAuthData: { accessToken, user }, ts }
    //
    // Header obrigatório: X-Freezer-Token
    // =========================================================================
    @PostMapping("/PiOAuth")
    public ResponseEntity<?> authenticateWithPiNetwork(
            HttpServletRequest request,
            @RequestBody  Map<String, String> encryptedBody,
            @RequestHeader(value = "X-Freezer-Token", required = false) String freezerToken
    ) {
        try {
            log.controllers("Envelope DH-Signed recebido na rota /PiOAuth. Consolidando autenticação Pi.");

            if (freezerToken == null || freezerToken.isBlank()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "X-Freezer-Token ausente: sessão DH não identificada."));
            }

            String iv         = encryptedBody.get("iv");
            String ciphertext = encryptedBody.get("ciphertext");

            if (iv == null || ciphertext == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("error", "Envelope malformado: campos 'iv' e 'ciphertext' são obrigatórios."));
            }

            Map<String, Object> result = service.processPiNetworkAuthentication(freezerToken, iv, ciphertext);

            log.controllers("Autenticação Pi Network consolidada com sucesso.");
            return ResponseEntity.ok(result);

        } catch (RuntimeException e) {
            log.error("Falha controlada na consolidação /PiOAuth: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Erro crítico inesperado na rota /PiOAuth", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erro interno: " + e.getMessage()));
        }
    }
}
