package com.prismo.domain;

import java.util.List;

public class Music {

    private String title;
    private List<Stanza> stanzas;
    private MusicPattern pattern;

    public Music(String title, List<Stanza> stanzas, MusicPattern pattern) {
        this.title = title;
        this.stanzas = stanzas;
        this.pattern = pattern;
    }

    public String getTitle() {
        return title;
    }

    public List<Stanza> getStanzas() {
        return stanzas;
    }

    public MusicPattern getPattern() {
        return pattern;
    }
}
