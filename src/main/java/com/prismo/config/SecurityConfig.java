package com.prismo.config;

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

    public SecurityConfig(JwtAuthenticationFilter jwtFilter, SessionAuthFilter sessionAuthFilter) {
        this.jwtFilter = jwtFilter;
        this.sessionAuthFilter = sessionAuthFilter;
    }

    /**
     * Arquivos estáticos do Angular ignorados completamente — nenhum filtro roda.
     * Cobre: index.html, bundles JS/CSS, favicon, assets, e qualquer
     * rota SPA sem extensão que o ViewController encaminha para index.html.
     */
    @Bean
    public WebSecurityCustomizer webSecurityCustomizer() {
        return (web) -> web.ignoring().requestMatchers(
            "/*.js", "/*.css", "/*.scss", "/*.txt",
            "/favicon.ico", "/assets/**"
        );
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Rotas públicas da API
                .requestMatchers("/api/auth/**").permitAll()
                // Módulo session — o SessionAuthFilter valida as credenciais do app Angular
                .requestMatchers("/api/sessions/**").permitAll()
                // Demais rotas /api/** exigem JWT válido
                .requestMatchers("/api/**").authenticated()
                // Rotas SPA (Angular HTML5 routing) — o ViewController serve index.html
                .anyRequest().permitAll()
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterAfter(sessionAuthFilter, JwtAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
