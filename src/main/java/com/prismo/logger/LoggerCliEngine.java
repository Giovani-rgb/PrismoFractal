package com.prismo.logger;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.LoggerContext;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.InputStreamReader;

@Component
public class LoggerCliEngine implements CommandLineRunner {

    @Override
    public void run(String... args) throws Exception {
        // Evita rodar a CLI se o ambiente não possuir um terminal interativo (ex: Docker sem -t, CI/CD)
        if (System.in == null || System.console() == null && isRunningInManagedEnvironment()) {
            return; 
        }

        Thread cliThread = new Thread(() -> {
            try {
                // Aguarda 4 segundos para garantir que todas as mensagens de inicialização do Spring sumiram
                Thread.sleep(4000);

                BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
                printIntro();

                while (!Thread.currentThread().isInterrupted()) {
                    printMenuPrompt();
                    String input = reader.readLine();

                    if (input == null) {
                        // Se o stream fechou, encerra a thread para evitar loop de 100% de CPU
                        break; 
                    }

                    input = input.trim();
                    if (input.isEmpty()) continue;

                    if ("6".equals(input) || "exit".equalsIgnoreCase(input)) {
                        System.out.println("\n[CLI] Painel de monitoramento dinâmico minimizado. O servidor Prismo continua operando normalmente.");
                        break;
                    }

                    processCommand(input);
                }
            } catch (Exception e) {
                // Fechamento limpo da thread em caso de interrupção externa
            }
        });

        cliThread.setName("prismo-logger-cli");
        cliThread.setDaemon(true); // Garante que a JVM feche de forma limpa se o app principal parar
        cliThread.start();
    }

    private void printIntro() {
        System.out.println("\n=======================================================");
        System.out.println(" ⚡ PRISMO INTERACTIVE LOGGER ENGINE ATIVADA");
        System.out.println(" Digite [menu] a qualquer momento para listar as opções.");
        System.out.println("=======================================================");
    }

    private void printMenuPrompt() {
        System.out.print("\n[PRISMO-LOGGER-CLI] Escolha (1-Prod, 2-Debug, 3-Trace, 4-Warn, 5-Status, 6-Sair): ");
    }

    private void printFullMenu() {
        System.out.println("\n=======================================================");
        System.out.println("       PRISMO INTERACTIVE LOGGER CLI (Runtime)         ");
        System.out.println("=======================================================");
        System.out.println(" [1] -> Padrão Prod (INFO: ADMIN, CONTROLLER, REQUEST) ");
        System.out.println(" [2] -> Modo Debug  (DEBUG: Tudo anterior + RAM)       ");
        System.out.println(" [3] -> Rastreamento Cripto (TRACE: Tudo + QUERIES)   ");
        System.out.println(" [4] -> Silencioso  (WARN: Apenas ADMIN e Erros)       ");
        System.out.println(" [5] -> Verificar Nível Atual                          ");
        System.out.println(" [6] -> Sair da CLI                                    ");
        System.out.println("=======================================================");
    }

    private void processCommand(String input) {
        if ("menu".equalsIgnoreCase(input)) {
            printFullMenu();
            return;
        }

        switch (input) {
            case "1":
                changeLogLevel(Level.INFO);
                break;
            case "2":
                changeLogLevel(Level.DEBUG);
                break;
            case "3":
                changeLogLevel(Level.TRACE);
                break;
            case "4":
                changeLogLevel(Level.WARN);
                break;
            case "5":
                showCurrentLevel();
                break;
            default:
                System.out.println("\n❌ Opção inválida! Digite de 1 a 6 ou [menu] para listar as opções.");
        }
    }

    private void changeLogLevel(Level targetLevel) {
        LoggerContext loggerContext = (LoggerContext) LoggerFactory.getILoggerFactory();
        loggerContext.getLogger("com.prismo.logger").setLevel(targetLevel);

        System.out.println("\n>>> Filtro dinâmico do Prismo alterado com sucesso para: [" + targetLevel + "] <<<");
    }

    private void showCurrentLevel() {
        LoggerContext loggerContext = (LoggerContext) LoggerFactory.getILoggerFactory();
        Level current = loggerContext.getLogger("com.prismo.logger").getLevel();
        String levelName = (current != null) ? current.toString() : "Herdado (" + loggerContext.getLogger("ROOT").getLevel() + ")";

        System.out.println("\n[STATUS] Nível ativo no barramento com.prismo.logger: [" + levelName + "]");
    }

    private boolean isRunningInManagedEnvironment() {
        // Validação auxiliar para capturar se está rodando dentro de engines como o IntelliJ terminal ou empacotado
        return System.getProperty("java.class.path").contains("idea_rt.jar") == false;
    }
}
