package com.prismo.service;

import com.prismo.domain.*;

import java.util.List;

public class MusicService {

    public Music example() {

        Stanza chorus = new Stanza(
            "chorus",
            List.of(
                "Tudo se quebra em luz",
                "O som reflete em mim",
                "Prismo revela o fim"
            )
        );

        MusicPattern pattern = new MusicPattern("rock", "4/4", 120);

        return new Music(
            "Prismo Song",
            List.of(chorus),
            pattern
        );
    }
}
