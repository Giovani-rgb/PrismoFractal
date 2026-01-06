package com.prismo.session;

import com.prismo.domain.Session;
import jakarta.servlet.http.HttpServletRequest;

public interface SessionService {

    Session create(HttpServletRequest request);

    Session get(String sessionId);

    void close(String sessionId);
}
