package com.prismo.controller;

import com.prismo.domain.Music;
import com.prismo.service.MusicService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MusicController {

    private final MusicService service = new MusicService();

    
    @GetMapping("/music")
    public Music getMusic() {
        return service.example();
    }
}
