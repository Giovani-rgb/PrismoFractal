package com.prismo.controller;

import com.prismo.logger.AppLogger; // Importação correta do seu Wrapper
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import jakarta.servlet.http.HttpServletRequest;

@Controller
public class ViewController {

    private final AppLogger log;

    // Injeção de dependência via construtor
    public ViewController(AppLogger log) {
        this.log = log;
    }

    @GetMapping({"/", "/{path:^(?!api|static|.*\\.).*}"})
    public String forward(HttpServletRequest request) {
        // Registra o roteamento dinâmico do SPA no escopo de CONTROLLERS
        log.controllers("Rota frontend capturada: '{}'. Redirecionando fluxo para o index.html", 
                request.getRequestURI());
        
        try {
            return "forward:/index.html";
        } catch (Exception e) {
            log.error("Falha ao executar forward interno para o index.html na rota: " + request.getRequestURI(), e);
            throw e;
        }
    }
}
