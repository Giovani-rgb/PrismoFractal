package com.prismo.domain;

public class MusicPattern {

    private String genre;
    private String timeSignature;
    private int bpm;

    public MusicPattern(String genre, String timeSignature, int bpm) {
        this.genre = genre;
        this.timeSignature = timeSignature;
        this.bpm = bpm;
    }

    public String getGenre() {
        return genre;
    }

    public String getTimeSignature() {
        return timeSignature;
    }

    public int getBpm() {
        return bpm;
    }
}
