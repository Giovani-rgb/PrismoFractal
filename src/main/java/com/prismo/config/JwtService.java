package com.prismo.config;

import com.prismo.logger.AppLogger; // Importação ajustada para a pasta correta
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
    private final AppLogger log; // Declaração do nosso Wrapper Global

    // Injeção de dependência via construtor
    public JwtService(@Value("${jwt.secret}") String secret, AppLogger log) {
        this.log = log;
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
        log.request("Gerando novo token JWT para o subject [{}]. Expiração definida para {} ms.", 
                subject, expirationMillis);
        
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
        try {
            final String extracted = extractSubject(token);
            boolean isValid = (extracted.equals(expectedSubject) && !isTokenExpired(token));
            
            if (!isValid) {
                log.warning("Validação de token falhou: Subject extraído não corresponde ao esperado ou expirou.");
            }
            return isValid;
        } catch (Exception e) {
            log.warning("Falha ao validar a estrutura ou assinatura do token para o subject '{}'", expectedSubject);
            return false;
        }
    }

    public boolean isTokenExpired(String token) {
        try {
            return extractExpiration(token).before(new Date());
        } catch (Exception e) {
            log.warning("Não foi possível validar a expiração do token. Tratando como expirado.");
            return true;
        }
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
        try {
            return Jwts.parserBuilder()
                    .setSigningKey(signingKey)
                    .build()
                    .parseClaimsJws(token)
                    .getBody();
        } catch (io.jsonwebtoken.security.SignatureException e) {
            log.error("Assinatura JWT inválida ou corrompida detectada!");
            throw e;
        } catch (io.jsonwebtoken.ExpiredJwtException e) {
            log.warning("Tentativa de leitura de um token JWT que já expirou.");
            throw e;
        } catch (Exception e) {
            log.error("Erro genérico ao fazer o parse das Claims do JWT: {}", e.getMessage());
            throw e;
        }
    }
}
