package com.prismo.modules.session.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

@Component
public class SessionAuthFilter extends OncePerRequestFilter {

    @Value("${APP_SESSION_SECRET}")
    private String secretSession;

    @Value("${APP_ID_KEY}")
    private String appId;

    // Aplica SOMENTE às rotas do módulo de sessão
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/sessions/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");
        String appIdHeader = request.getHeader("X-App-Id");

        // Angular envia "Bearer <secret>" — extrai somente o secret
        String receivedSecret = null;
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            receivedSecret = authHeader.substring(7).trim();
        }

        if (secretSession.equals(receivedSecret) && appId.equals(appIdHeader)) {
            filterChain.doFilter(request, response);
        } else {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"error\":\"Credenciais de modulo invalidas.\"}");
        }
    }
}
