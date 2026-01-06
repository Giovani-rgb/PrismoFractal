package com.prismo.session;

import com.prismo.dto.*;
import com.prismo.mapper.SessionMapper;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sessions")
public class SessionController {

    private final SessionService service;

    public SessionController(SessionService service) {
        this.service = service;
    }

    @PostMapping
    public SessionResponse create(HttpServletRequest request) {
        return SessionMapper.toResponse(
            service.create(request)
        );
    }

    @PostMapping("/read")
    public SessionResponse read(
        @RequestBody(required = false) ReadSessionRequest body
    ) {
        if (body == null || body.sessionId() == null) {
            //ResponseStatusException cannot be resolved to a type (Java). E HttpStatus cannot be resolved to a variable (Java)
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "sessionId é obrigatório"
            );
        }

        return SessionMapper.toResponse(
            service.get(body.sessionId())
        );
    }

}
