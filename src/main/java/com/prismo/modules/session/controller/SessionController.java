package com.prismo.modules.session.controller;

import com.prismo.modules.session.model.Session;
import com.prismo.modules.session.service.ServiceSession;
import com.prismo.modules.session.repository.ResponseQueries;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Controller Prismo: Gestão de Sessões e Handshake Criptográfico.
 */
@RestController
@RequestMapping("/api/sessions")
public class SessionController {

    private final ServiceSession service;
    private final ResponseQueries responseQueries;

    public SessionController(ServiceSession service, ResponseQueries responseQueries) {
        this.service = service;
        this.responseQueries = responseQueries;
    }
    @PostMapping("/public")
    public ResponseEntity<Map<String, Object>> establishPublicHandshake(
            @RequestBody(required = false) Map<String, String> clientPayload,
            @RequestHeader(value = "X-Window-Token", required = false) String windowToken
    ) {
        try {
            // ESTÁGIO 1: Drop inicial
            if (clientPayload == null || !clientPayload.containsKey("B")) {
                // ... (Mantenha o log do Stage 1 como está, ele está ótimo)
                Map<String, Object> dhParams = service.generateServerHandshake();
                String newToken = service.generateReentryWindow();
                service.saveHandshakeContext(newToken, dhParams); 
                dhParams.put("windowToken", newToken);
                return ResponseEntity.ok(dhParams);
            }

            // ESTÁGIO 2: O Callback (B + Token)
            String clientB = clientPayload.get("B");

            System.out.println("\n\n");
            System.out.println("================================================================================");
            System.out.println(">>> [HANDSHAKE STAGE 2]: INTERCEPTAÇÃO DE SEGURANÇA");
            System.out.println(">>> Token do Header: " + windowToken);
            System.out.println(">>> Chave 'B' do Cliente: " + clientB);
            System.out.println("--------------------------------------------------------------------------------");

            if (windowToken == null || windowToken.isBlank()) {
                System.err.println("!!! [ALERTA]: Tentativa de Stage 2 sem X-Window-Token");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Token ausente."));
            }

            // 1. Calcula o segredo
            service.finalizeSharedSecret(windowToken, clientB);

            // 2. BUSCA O SEGREDO PARA LOG (Faça isso ANTES de consumir a janela)
            // Assumindo que seu service agora tem um método para recuperar o que foi calculado
            String secretCalculated = service.getSecretByToken(windowToken); 

            System.out.println(">>> [MATCH CHECK] VALOR CALCULADO NO JAVA:");
            System.out.println(">>> SHARED SECRET: " + (secretCalculated != null ? secretCalculated : "NÃO ENCONTRADO/NULO"));
            System.out.println("--------------------------------------------------------------------------------");

            // 3. Agora sim, mata a janela/contexto se necessário
            System.out.println(">>> Consumindo Reentry Window (Limpando contexto)...");
            service.consumeReentryWindow(windowToken);

            Map<String, Object> responseBody = Map.of(
                "status", "established",
                "fingerprint", (secretCalculated != null && secretCalculated.length() > 8) 
                                ? secretCalculated.substring(0, 8) : "error"
            );

            System.out.println(">>> [FINALIZADO]: Enviando confirmação ao cliente com Fingerprint.");
            System.out.println("================================================================================");
            System.out.println("\n\n");

            return ResponseEntity.ok(responseBody);

        } catch (Exception e) {
            // ... (Seu bloco catch de erro está perfeito)
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }




    /**
     * ROTA REFRESH: Atualiza os claims do token através do Cookie.
     * O valor vem do 'nameSessionKey' definido no environment do Frontend.
     */
    @PostMapping("/refresh")
    public ResponseEntity<Map<String, String>> refresh(
            @CookieValue(name = "nameSessionKey") String sessionCipher
    ) {
        // 1. Revalida a sessão através do ciphertext do cookie
        Session updatedSession = service.refreshSessionData(sessionCipher);

        // 2. Cifra os novos dados para a resposta
        Map<String, String> encryptedResponse = responseQueries.sanitizeAndEncrypt(updatedSession);

        // 3. Rotaciona o cookie de sessão no browser
        ResponseCookie newCookie = service.generateSessionCookie(encryptedResponse.get("ciphertext"));

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, newCookie.toString())
                .body(encryptedResponse);
    }

    /**
     * ROTA ANONYMOUS: Criação de sessão após o túnel seguro estar pronto.
     */
    @PostMapping("/anonymous")
    public ResponseEntity<Map<String, String>> createAnonymous(
            HttpServletRequest request,
            @RequestHeader(value = "User-Agent", defaultValue = "UNKNOWN") String userAgent
    ) {
        String ip = extractIp(request);
        Session session = service.createAnonymous(ip, userAgent);
        
        Map<String, String> encryptedResponse = responseQueries.sanitizeAndEncrypt(session);
        ResponseCookie sessionCookie = service.generateSessionCookie(encryptedResponse.get("ciphertext"));

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, sessionCookie.toString())
                .body(encryptedResponse);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> revoke(@PathVariable UUID id) {
        service.revoke(id);
        return ResponseEntity.noContent().build();
    }

    private String extractIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        return (ip == null || ip.isBlank()) ? request.getRemoteAddr() : ip;
    }
}

