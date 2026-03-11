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

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String headerAuth = request.getHeader("Authorization");
        String headerAppId = request.getHeader("X-App-ID");

        // Valida as credenciais para todas as requisições do módulo
        if (secretSession.equals(headerAuth) && appId.equals(headerAppId)) {
            filterChain.doFilter(request, response);
        } else {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write("Acesso negado: Credenciais de módulo inválidas.");
        }
    }
}
