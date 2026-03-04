package com.prismo.modules.session.repository;

import com.prismo.modules.session.model.Session;
import java.util.HashMap;
import java.util.Map;

public final class ResponseQueries {

    private ResponseQueries() {}

    public static Map<String, Object> sanitize(Session session) {
        // Usamos HashMap porque ele PERMITE valores nulos (null values)
        Map<String, Object> response = new HashMap<>();
        
        response.put("id_prospect", session.getId());
        response.put("refs", session.getUserId()); // Agora pode ser null sem erro
        response.put("country", session.getCountry());
        response.put("revoked", session.isRevoked());
        response.put("keyUpdate", session.getKeyUpdate());
        response.put("createdAt", session.getCreatedAt());
        response.put("expiresAt", session.getExpiresAt());
        response.put("lastAccessAt", session.getLastAccessAt());
        
        // Se você quiser retornar o Token também (já que ele é gerado no Service):
        if (session.getToken() != null) {
            response.put("token", session.getToken());
        }

        return response;
    }
}