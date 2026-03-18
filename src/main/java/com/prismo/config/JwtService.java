package com.prismo.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.function.Function;

@Service
public class JwtService {

    private final SecretKey signingKey;

    public JwtService(@Value("${jwt.secret}") String secret) {
        // Garante que a chave tenha tamanho suficiente para o algoritmo HS256
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes());
    }

    /**
     * Método Original: Gera token padrão de 1 hora para login de usuário.
     */
    public String generateToken(String username) {
        return generateToken(username, 1000 * 60 * 60L); // 1 hora
    }

    /**
     * Método Novo/Sobrecarga: Permite definir o tempo de expiração.
     * Útil para sessões de longa duração (ex: 30 dias).
     */
    public String generateToken(String subject, long expirationMillis) {
        return Jwts.builder()
                .setSubject(subject)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + expirationMillis))
                .signWith(signingKey, SignatureAlgorithm.HS256)
                .compact();
    }

    /**
     * Extrai o Subject (pode ser username ou UUID de sessão).
     */
    public String extractSubject(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public boolean isTokenValid(String token, String expectedSubject) {
        final String extracted = extractSubject(token);
        return (extracted.equals(expectedSubject) && !isTokenExpired(token));
    }

    public boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    // --- Métodos Auxiliares para manter o código limpo ---

    private Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(signingKey)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
}