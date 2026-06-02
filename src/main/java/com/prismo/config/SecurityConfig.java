package com.prismo.config;

import com.prismo.logger.AppLogger; // Importação do Wrapper global da pasta correta
import com.prismo.modules.session.security.SessionAuthFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtFilter;
    private final SessionAuthFilter sessionAuthFilter;
    private final AppLogger log; // Declaração do nosso Wrapper Global

    // Construtor atualizado incluindo a injeção do AppLogger
    public SecurityConfig(JwtAuthenticationFilter jwtFilter, SessionAuthFilter sessionAuthFilter, AppLogger log) {
        this.jwtFilter = jwtFilter;
        this.sessionAuthFilter = sessionAuthFilter;
        this.log = log;
    }

    @Bean
    public WebSecurityCustomizer webSecurityCustomizer() {
        log.request("Configurando exceções globais para arquivos estáticos (Assets, CSS, JS, Favicon).");
        return (web) -> web.ignoring().requestMatchers(
            "/*.js", "/*.css", "/*.scss", "/*.txt",
            "/favicon.ico", "/assets/**"
        );
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        log.request("Inicializando regras globais da esteira de segurança (SecurityFilterChain).");

        try {
            http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                    .requestMatchers("/.well-known/**").permitAll()
                    .requestMatchers("/api/auth/**").permitAll()
                    .requestMatchers("/api/sessions/public").permitAll()
                    .requestMatchers("/api/sessions/**").permitAll()
                    .requestMatchers("/api/**").authenticated()
                    .anyRequest().permitAll()
                )
                // Injetando filtros customizados na ordem exata da esteira
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(sessionAuthFilter, JwtAuthenticationFilter.class);

            // Logs informando os mapeamentos aplicados para fins de auditoria no boot da aplicação
            log.request("Rotas públicas mapeadas com sucesso: [/.well-known/**, /api/auth/**, /api/sessions/**]");
            log.admin("Políticas restritas injetadas: [/api/**] requer autenticação válida.");
            log.request("Ordem da esteira estabelecida: [JwtAuthenticationFilter] -> [SessionAuthFilter]");

            return http.build();
        } catch (Exception e) {
            log.error("Erro crítico ao inicializar as diretivas do Spring Security: {}", e.getMessage());
            throw e;
        }
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        // Logado no contexto do admin/sistema pois dita o padrão criptográfico das credenciais principais
        log.admin("Codificador de senhas padrão configurado: BCryptPasswordEncoder.");
        return new BCryptPasswordEncoder();
    }
}
