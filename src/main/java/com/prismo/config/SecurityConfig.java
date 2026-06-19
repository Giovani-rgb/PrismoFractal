package com.prismo.config;

import com.prismo.modules.session.security.SessionAuthFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtFilter;
    private final SessionAuthFilter sessionAuthFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtFilter, SessionAuthFilter sessionAuthFilter) {
        this.jwtFilter = jwtFilter;
        this.sessionAuthFilter = sessionAuthFilter;
    }

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
            // 1. Ativa o filtro de CORS integrado ao Security
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            
            .csrf(csrf -> csrf.disable())
            .headers(headers -> headers
                .frameOptions(frameOptions -> frameOptions.disable())
            )
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // LIBERAÇÃO DO PREFLIGHT: Garante que as checagens de CORS passem direto pelos filtros
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                
                .requestMatchers("/.well-known/**").permitAll()
                .requestMatchers("/api/oauth/**").permitAll()
                .requestMatchers("/api/sessions/public").permitAll()
                .requestMatchers("/api/sessions/**").permitAll()
                .requestMatchers("/api/**").authenticated()
                .anyRequest().permitAll()
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterAfter(sessionAuthFilter, JwtAuthenticationFilter.class);

        return http.build();
    }

    // 2. Regras de Origens e Cabeçalhos aceitos pelo Backend
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        configuration.setAllowedOriginPatterns(Arrays.asList(
            "https://prismo-262a2.web.app",
            "https://prismo-262a2.firebaseapp.com",
            "https://*.replit.dev",
            "https://*.spock.replit.dev",
            "https://*.replit.app",
            "http://localhost:*"
        ));

        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        configuration.setAllowedHeaders(Arrays.asList("*"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
