# PRISMO - Music Composition Tool

## Overview

PRISMO is a creative music composition tool that lets users manage song lyrics and musical structure using game-inspired concepts like "Chunks," "World," and "DNA." The app has a retro pixel-art aesthetic (Press Start 2P font, game menu navigation).

**Core Concepts:**
- **World** – A musical project with name, structure template, BPM, and time signature
- **Melody DNA** – Musical ideology, style, harmony base, and rhythm patterns
- **Chunks** – Phrases/lyrics organized into stanzas and sections
- **Sessions** – Anonymous session management with Diffie-Hellman key exchange for anti-bot protection

The app is a full-stack monorepo: a Spring Boot backend serves both the REST API and the pre-built Angular frontend as static files on port 5000.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Angular 21 SPA)

- **Framework:** Angular 21 with standalone components (no NgModule pattern)
- **Language:** TypeScript with strict mode enabled
- **Styling:** SCSS, global pixel-art/retro theme
- **Build output:** Angular CLI builds directly into `src/main/resources/static/` so Spring Boot can serve it as static content
- **Routing:** Angular Router with these pages: Intro (game menu home), Dashboard (lyrics editor), World (project setup wizard), Songs, Settings, Landing, MelodyDNA
- **State management:** RxJS `BehaviorSubject` for session state via `SessionContext`; Angular Signals for project data via `ProjectService`
- **HTTP:** `HttpClient` with functional interceptors (`withInterceptors`) — three interceptor types: `inboundInterceptor` (anonymous), `recoveryInterceptor` (rehydration), `transactionInterceptor` (authenticated)
- **Environment config:** A `load-env.mjs` script runs before build/test to inject `.env` variables into `src/environments/environment.ts`

### Session Pipeline (Key Architectural Pattern)

The session system is the most complex part of the frontend:
1. **SessionContext** – Holds session state (tag, data, loading flags) in a `BehaviorSubject`
2. **SessionRouter** – Maps `SessionTag` enum values to pipeline routes (handler + interceptor)
3. **SessionPipelineOrchestrator** – Executes the correct route handler and applies the right interceptor per session state
4. **Web Worker** – Handles cryptographic operations (Diffie-Hellman key exchange, AES-GCM encrypt/decrypt) off the main thread
5. **SessionCreationExecution / SessionRehydrationExecution** – Orchestrate the full creation and rehydration flows respectively
6. **Storage:** Encrypted session data is stored in `sessionStorage` under an obfuscated key

Session tags: `VOID → PUBLIC → CREATE → REST` (new user) or `VOID → REHYDRATE → REST` (returning user)

### Backend (Spring Boot 3.2)

- **Language:** Java 17
- **Framework:** Spring Boot 3.2 with JPA, Spring Security (JWT)
- **Structure:** Feature-module organization under `src/main/java/com/prismo/modules/`
  - `session/` – Session management (controller, service, repository, model)
  - `userauth/` – User authentication (planned/in-progress: controller, service, repository, model, dto)
- **Port:** Runs on port 5000
- **Static serving:** Serves the Angular build from `src/main/resources/static/`
- **Session API endpoints:**
  - `POST /api/sessions/public` – Diffie-Hellman handshake
  - `POST /api/sessions/anonymous` – Create new anonymous session
  - `POST /api/sessions/refresh` – Refresh/rehydrate session (uses cookies)

### Security

- **Anti-bot:** Diffie-Hellman key exchange with time-window tokens (`X-Window-Token` header) and minimum wait enforcement
- **AES-GCM:** Session data encrypted client-side before storing in `sessionStorage`
- **JWT:** Backend signs tokens using a secret (`JWT_SECRET` environment variable)
- **App identity:** `X-App-Id` header sent on all requests

### Database

- **PostgreSQL** via Supabase (cloud-hosted)
- **ORM:** Spring Data JPA
- **Connection:** Configured via `SUPABASE_PASSWORD` environment variable in `application.properties`

### Build & Deployment

- Angular build runs first (`npm run build` in `frontend/prismo-chunks/`) and outputs to `src/main/resources/static/`
- Then `mvn clean spring-boot:run` starts the backend which serves everything from port 5000
- Environment variable injection happens via `scripts/load-env.mjs` (pre-build hook)

## External Dependencies

### Firebase (Frontend)
- **@angular/fire v19** + **firebase v12**
- Services used: Firebase App, Analytics, Auth, Firestore
- Config in `environment.ts` (project: `prismo-262a2`)
- Purpose: Analytics and authentication support (alongside the custom session system)

### Supabase / PostgreSQL (Backend)
- Cloud PostgreSQL database hosted on Supabase
- Connected via standard JDBC in Spring Boot JPA
- Required secret: `SUPABASE_PASSWORD`

### Google Fonts
- `Press Start 2P` font loaded from Google Fonts CDN for the retro pixel aesthetic

### Eruda (Development Debug Tool)
- Loaded from CDN in `index.html` — a mobile-friendly dev console
- Note: This is currently loaded in production builds too; should be removed or conditionally loaded for production

### Required Environment Variables / Secrets
| Variable | Used By | Purpose |
|---|---|---|
| `SUPABASE_PASSWORD` | Backend | PostgreSQL connection |
| `JWT_SECRET` | Backend | JWT token signing |
| `VITE_API_URL` | Frontend build | Backend API base URL |
| `VITE_APP_NAME` | Frontend build | App title |
| `VITE_SESSION_TIMEOUT` | Frontend build | Session timeout duration |
| `VITE_JWT_TOKEN_KEY` | Frontend build | Storage key name |