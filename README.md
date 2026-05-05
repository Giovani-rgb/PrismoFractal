# PRISMO

<p align="center">
  <img src="https://img.shields.io/badge/Java-17-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white"/>
  <img src="https://img.shields.io/badge/Spring_Boot-3.2-6DB33F?style=for-the-badge&logo=springboot&logoColor=white"/>
  <img src="https://img.shields.io/badge/Spring_Security-JWT-6DB33F?style=for-the-badge&logo=springsecurity&logoColor=white"/>
  <img src="https://img.shields.io/badge/Angular-21-DD0031?style=for-the-badge&logo=angular&logoColor=white"/>
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white"/>
  <img src="https://img.shields.io/badge/SCSS-CC6699?style=for-the-badge&logo=sass&logoColor=white"/>
  <img src="https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?style=for-the-badge&logo=postgresql&logoColor=white"/>
  <img src="https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black"/>
  <img src="https://img.shields.io/badge/Maven-C71A36?style=for-the-badge&logo=apachemaven&logoColor=white"/>
</p>

> Ferramenta criativa de composição musical com estética pixel-art, gerenciamento de letras, estrutura de músicas e sessões anônimas seguras.

---

## Conceitos Centrais

| Conceito | Descrição |
|---|---|
| **World** | Projeto musical — nome, template de estrutura, BPM e fórmula de compasso |
| **Melody DNA** | Ideologia musical — estilo, harmonia e padrões rítmicos |
| **Chunks** | Frases/letras organizadas em estrofes e seções |
| **Sessions** | Sessões anônimas protegidas por handshake Diffie-Hellman anti-bot |

---

## Arquitetura do Sistema

O projeto é um **monorepo full-stack**: o Spring Boot serve a API REST e também os arquivos estáticos do Angular (build output), tudo na porta **5000**.

```
PRISMO
├── frontend/prismo-chunks/               # SPA Angular 21
│   └── src/app/
│       ├── pages/                        # Telas: intro, dashboard, world, songs,
│       │                                 #        landing, melody-dna, settings
│       ├── services/                     # session.service, project.service,
│       │                                 # session.router
│       ├── interceptors/                 # session.interceptor (inbound / recovery /
│       │                                 # transaction)
│       ├── context/                      # session.context (BehaviorSubject global)
│       ├── crowdedExecultion/            # SessionCreatExecution,
│       │                                 # SessionRehydratExecution
│       ├── web-workers/                  # Web Worker: DH key exchange (off-thread)
│       ├── pipes/                        # session.worker (AES-GCM + entropia)
│       ├── models/                       # Interfaces e tipos
│       ├── helpers/                      # Utilitários
│       └── biblioteca/                   # Componentes reutilizáveis
│
├── src/main/java/com/prismo/            # Backend Spring Boot
│   ├── config/                           # SecurityConfig, JwtService,
│   │                                     # JwtAuthenticationFilter
│   ├── controller/                       # ViewController (serve o Angular)
│   └── modules/                          # Módulos por feature
│       ├── session/                      # Sessões anônimas
│       │   ├── controller/               # SessionController
│       │   ├── service/                  # ServiceSession, CryptoHelper
│       │   ├── modelrepository/          # Session entity + SessionRepository
│       │   ├── dto/                      # DTOs de sessão
│       │   ├── util/                     # Utilitários do módulo
│       │   └── security/                 # SessionAuthFilter
│       └── userauth/                     # Autenticação de usuários
│           ├── controller/               # UserAuthController
│           ├── service/                  # UserAuthService
│           ├── modelrepository/          # User entity + UserRepository
│           └── dto/                      # DTOs de autenticação
│
├── src/main/resources/
│   ├── static/                           # Build do Angular (gerado automaticamente)
│   └── application.properties            # Configurações da aplicação
│
└── scripts/
    └── load-env.mjs                      # Injeta variáveis .env no environment.ts
```

---

## Fluxo de Sessão (Anti-Bot)

A criação de sessão é protegida por um pipeline criptográfico de 3 etapas:

```
[Frontend]                              [Backend]

1. POST /api/sessions/public ─────────► Gera parâmetros DH (p, g, A)
                             ◄───────── windowToken + minWait (tempo mínimo)

   ⏳ Frontend aguarda minWait (comportamento humano validado)

2. POST /api/sessions/public ─────────► Valida janela de tempo + calcula segredo DH
   body: { B }  header: X-Window-Token ◄───────── anonymousToken (TTL 15s, uso único)

3. POST /api/sessions/anonymous ──────► Valida e consome anonymousToken, cria sessão
   header: X-Anonymous-Token  ◄───────── JWT + cookie de sessão cifrado (AES-GCM)
```

---

## Stack de Tecnologias

### Backend
- **Java 17** + **Spring Boot 3.2** — API REST e servidor de arquivos estáticos
- **Spring Security** — filtros de autenticação e autorização por camada
- **JWT** — tokens assinados para sessões anônimas e autenticação de usuário
- **Spring Data JPA** — ORM com PostgreSQL
- **Diffie-Hellman** — troca de chaves criptográficas para proteção anti-bot

### Frontend
- **Angular 21** — SPA com standalone components, sem NgModule
- **TypeScript** (strict mode) + **SCSS** — tipagem forte e estilo global retro/pixel-art
- **RxJS BehaviorSubject** — estado global de sessão via `SessionContext`
- **Angular Signals** — estado reativo de projeto via `ProjectService`
- **Web Workers** — operações criptográficas (DH + AES-GCM) fora da thread principal
- **@angular/fire v19** + **Firebase 12** — Analytics e Auth

### Banco de Dados
- **PostgreSQL** hospedado no **Supabase** (cloud), conectado via JDBC/JPA

---

## Variáveis de Ambiente

| Variável | Usado por | Finalidade |
|---|---|---|
| `SUPABASE_PASSWORD` | Backend | Conexão com o banco PostgreSQL |
| `JWT_SECRET` | Backend | Assinatura dos tokens JWT |
| `VITE_API_URL` | Frontend build | URL base da API |
| `VITE_APP_NAME` | Frontend build | Título da aplicação |
| `VITE_SESSION_TIMEOUT` | Frontend build | Duração do timeout de sessão |
| `VITE_JWT_TOKEN_KEY` | Frontend build | Chave de armazenamento do token |

---

## Como Rodar

### Projeto completo (recomendado)

```bash
# 1. Build do frontend (gera os estáticos servidos pelo Spring Boot)
cd frontend/prismo-chunks && npm run build

# 2. Sobe o backend — serve tudo na porta 5000
mvn clean spring-boot:run
```

### Frontend em modo desenvolvimento

```bash
cd frontend/prismo-chunks && npm run serve
```

---

## Licença

Este projeto está licenciado sob a **Apache License 2.0**. Veja o arquivo [LICENSE](./LICENSE) para mais detalhes.
