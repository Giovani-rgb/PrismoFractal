package com.prismo.logger;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.Marker;
import org.slf4j.MarkerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import jakarta.annotation.PostConstruct;

@Component
public class AppLogger {

    private static final Logger logger = LoggerFactory.getLogger(AppLogger.class);

    // Instanciação dos Marcadores Oficiais
    private static final Marker ADMIN_MARKER      = MarkerFactory.getMarker("ADMIN");
    private static final Marker CONTROLLER_MARKER = MarkerFactory.getMarker("CONTROLLER");
    private static final Marker REQUEST_MARKER    = MarkerFactory.getMarker("REQUEST");
    private static final Marker QUERIES_MARKER    = MarkerFactory.getMarker("QUERIES");
    private static final Marker RAM_MARKER        = MarkerFactory.getMarker("RAM");

    @Value("${spring.application.name:App}")
    private String appName;

    @Value("${application.version:1.0.0}")
    private String appVersion;

    @Value("${app.environment:DEV}")
    private String environment;

    private String logPrefix;

    @PostConstruct
    public void init() {
        // Formata o prefixo uma única vez no boot para economizar processamento
        this.logPrefix = String.format("[%s | v%s | %s] - ", 
            appName.toUpperCase(), appVersion, environment.toUpperCase());
    }

    /**
     * Injeta o prefixo mantendo a string de formato intacta para o interpretador do SLF4J.
     */
    private String appendPrefix(String format) {
        return logPrefix + format;
    }

    // =========================================================================
    // IMPLEMENTAÇÃO CORRIGIDA COM OS NÍVEIS REAIS DO SLF4J
    // =========================================================================

    public void admin(String format, Object... arguments) {
        if (logger.isWarnEnabled()) {
            logger.warn(ADMIN_MARKER, appendPrefix(format), arguments);
        }
    }

    public void controllers(String format, Object... arguments) {
        if (logger.isInfoEnabled()) {
            logger.info(CONTROLLER_MARKER, appendPrefix(format), arguments);
        }
    }

    public void request(String format, Object... arguments) {
        if (logger.isInfoEnabled()) {
            logger.info(REQUEST_MARKER, appendPrefix(format), arguments);
        }
    }

    public void queries(String format, Object... arguments) {
        // Corrigido para Trace: permite que a CLI libere este log ao mudar para TRACE
        if (logger.isTraceEnabled()) {
            logger.trace(QUERIES_MARKER, appendPrefix(format), arguments);
        }
    }

    public void ram(String format, Object... arguments) {
        // Corrigido para Debug: permite que a CLI libere este log ao mudar para DEBUG
        if (logger.isDebugEnabled()) {
            logger.debug(RAM_MARKER, appendPrefix(format), arguments);
        }
    }

    public void warning(String format, Object... arguments) {
        if (logger.isWarnEnabled()) {
            logger.warn(appendPrefix(format), arguments);
        }
    }

    public void error(String format, Object... arguments) {
        if (logger.isErrorEnabled()) {
            logger.error(appendPrefix(format), arguments);
        }
    }

    public void error(String message, Throwable throwable) {
        if (logger.isErrorEnabled()) {
            logger.error(appendPrefix(message), throwable);
        }
    }
}
