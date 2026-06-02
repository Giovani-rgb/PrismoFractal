package com.prismo.config;

import com.prismo.logger.AppLogger; // Importação ajustada para a pasta correta
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.Collections;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final AppLogger log; // Declaração do nosso Wrapper Global

    // Injeção de dependência atualizada no construtor
    public JwtAuthenticationFilter(JwtService jwtService, AppLogger log) {
        this.jwtService = jwtService;
        this.log = log;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        // Captura o início de qualquer requisição que bate na API externa
        log.request("Iniciando interceptação da requisição HTTP: [{} {}]", 
                request.getMethod(), request.getRequestURI());

        final String authHeader = request.getHeader("Authorization");

        // Se não houver Header ou não for Bearer, segue para o próximo filtro
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            log.request("Requisição anônima ou sem cabeçalho Authorization Bearer válido para URI: {}", 
                    request.getRequestURI());
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7).trim();

        try {
            String username = jwtService.extractSubject(token);

            if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {

                if (!jwtService.isTokenExpired(token)) {
                    
                    // Se o usuário extraído for o admin padrão do seu properties, logamos no escopo ADMIN
                    if ("admin".equalsIgnoreCase(username)) {
                        log.admin("Acesso autenticado para conta administrativa corporativa na rota: {}", 
                                request.getRequestURI());
                    } else {
                        log.request("Usuário '{}' autenticado com sucesso via JWT.", username);
                    }

                    UsernamePasswordAuthenticationToken authToken =
                            new UsernamePasswordAuthenticationToken(
                                    username,
                                    null,
                                    Collections.emptyList()
                            );

                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                } else {
                    log.warning("Tentativa de acesso com token expirado para o usuário: {}", username);
                }
            }
        } catch (Exception e) {
            // Em vez de deixar o catch totalmente vazio (silencioso), usamos o nível WARNING.
            // Isso evita poluir o console com stacktraces gigantes de sessões expiradas normais,
            // mas ainda mantém um rastro semântico limpo para auditoria técnica.
            log.warning("Falha na validação do token JWT da requisição. Motivo: {}", e.getMessage());
        }

        filterChain.doFilter(request, response);
    }
}
