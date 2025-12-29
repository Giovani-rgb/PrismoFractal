package com.prismo.domain;

import java.util.List;

public class Stanza {

    private String type; // verse, chorus, bridge...
    private List<String> lines;

    public Stanza(String type, List<String> lines) {
        this.type = type;
        this.lines = lines;
    }

    public String getType() {
        return type;
    }

    public List<String> getLines() {
        return lines;
    }
}
