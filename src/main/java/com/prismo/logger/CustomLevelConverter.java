package com.prismo.logger;

import ch.qos.logback.classic.pattern.ClassicConverter;
import ch.qos.logback.classic.spi.ILoggingEvent;
import org.slf4j.Marker;

public class CustomLevelConverter extends ClassicConverter {

    @Override
    public String convert(ILoggingEvent event) {
        Marker marker = event.getMarker();

        // Se houver um marcador customizado nosso, substitui a palavra nativa no console
        if (marker != null) {
            String markerName = marker.getName();
            
            // Usamos .contains ou uma checagem direta baseada no nome para evitar falhas de envelopamento
            switch (markerName) {
                case "ADMIN":      return "ADMIN     ";
                case "CONTROLLER": return "CONTROLLER";
                case "REQUEST":    return "REQUEST   ";
                case "QUERIES":    return "QUERIES   ";
                case "RAM":        return "RAM       ";
            }
        }

        // Fallback para erros e avisos normais com espaçamento idêntico para manter o console alinhado
        String nativeLevel = event.getLevel().toString();
        switch (nativeLevel) {
            case "ERROR": return "ERROR     ";
            case "WARN":  return "WARNING   ";
            default:      return "INFO      ";
        }
    }
}
