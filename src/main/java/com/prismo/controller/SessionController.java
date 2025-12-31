package com.prismo.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/session")
@CrossOrigin(origins = "*")
public class SessionController {

    @PostMapping("/start")
    public ResponseEntity<Map<String, Object>> startSession(@RequestBody Map<String, String> request) {
        String projectName = request.getOrDefault("projectName", "Meu Projeto");
        
        Map<String, Object> response = new HashMap<>();
        response.put("id", "session_" + UUID.randomUUID());
        response.put("projectName", projectName);
        response.put("createdAt", System.currentTimeMillis());
        
        return ResponseEntity.ok(response);
    }

    @GetMapping("/current")
    public ResponseEntity<Map<String, String>> getCurrentSession() {
        Map<String, String> response = new HashMap<>();
        response.put("message", "Session is active");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/end")
    public ResponseEntity<Map<String, String>> endSession() {
        Map<String, String> response = new HashMap<>();
        response.put("message", "Session ended");
        return ResponseEntity.ok(response);
    }
}
