# PRISMO

<p align="center">
  <img src="https://img.shields.io/badge/Java--ED8B00?style=for-the-badge&logo=openjdk&logoColor=white"/>
  <img src="https://img.shields.io/badge/Spring_Boot-3.2.0-6DB33F?style=for-the-badge&logo=springboot&logoColor=white"/>
  <img src="https://img.shields.io/badge/Spring_Security-6.2-6DB33F?style=for-the-badge&logo=springsecurity&logoColor=white"/>
  <img src="https://img.shields.io/badge/Angular-21-DD0031?style=for-the-badge&logo=angular&logoColor=white"/>
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white"/>
  <img src="https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?style=for-the-badge&logo=postgresql&logoColor=white"/>
  <img src="https://img.shields.io/badge/Firebase-19.2-FFCA28?style=for-the-badge&logo=firebase&logoColor=black"/>
  <img src="https://img.shields.io/badge/RxJS-7.8-B7178C?style=for-the-badge&logo=reactivex&logoColor=white"/>
  <img src="https://img.shields.io/badge/Maven-3-C71A36?style=for-the-badge&logo=apachemaven&logoColor=white"/>
</p>



## Conceitos do Domínio

| Conceito | Descrição |
|---|---|
| **World** | Projeto musical — nome, template de estrutura, BPM e fórmula de compasso |
| **Melody DNA** | Identidade musical — estilo, harmonia e padrões rítmicos |
| **Chunks** | Frases e letras organizadas em estrofes e seções |
| **Sessions** | Sessões anônimas protegidas por pipeline criptográfico anti-bot |

---



---

## Fluxo de Sessão Anti-Bot

Pipeline criptográfico em 3 etapas que garante que apenas clientes legítimos criem sessões:

```
 Cliente (Angular)                          Servidor (Spring Boot)
 ─────────────────                          ──────────────────────

 POST /api/sessions/public ───────────────► Gera p, g, A (Diffie-Hellman 2048-bit)
                            ◄──────────────  windowToken + minWait (segundos)

   ⏳  Web Worker computa B = g^b mod p
   ⏳  Aguarda o minWait (janela de comportamento humano)

 POST /api/sessions/public ───────────────► Valida timing + computa S = B^a mod p
  { clientPublicKey: B }                    Armazena S em RAM (keyed by windowToken)
  X-Window-Token: <token>   ◄──────────────  anonymousToken (uso único · TTL 15s)

 POST /api/sessions/anonymous ────────────► Consume anonymousToken · recupera S da RAM
  X-Anonymous-Token: <token>               Persiste sessão (UUID + JWT + GeoIP)
                            ◄──────────────  { iv, ciphertext } — AES-GCM com chave derivada
```

**Derivação de chave — client e server alinhados:**

| Lado | Operação |
|---|---|
| Frontend | `SHA-256( UTF-8(secretHex) )` → `importKey('raw', hash, 'AES-GCM')` |
| Backend | `MessageDigest("SHA-256").digest( secretHex.getBytes(UTF_8) )` → `SecretKeySpec(32 bytes, "AES")` |

---

## Stack

### Backend

| Tecnologia | Versão | Uso |
|---|---|---|
| Java | 17 | Runtime |
| Spring Boot | 3.2.0 | Framework principal |
| Spring Security | 6.2 | Filtros de autenticação e autorização |
| jjwt | 0.11.5 | Geração e validação de JWT |
| Spring Data JPA + Hibernate | 6.3 | ORM / persistência |
| PostgreSQL via Supabase | — | Banco de dados cloud |
| MaxMind GeoIP2 | 4.2.0 | Geolocalização por IP |
| Maven | 3 | Build e dependências |

### Frontend

| Tecnologia | Versão | Uso |
|---|---|---|
| Angular | 21 | SPA com standalone components |
| TypeScript | 5.9 | Linguagem principal (strict mode) |
| RxJS | 7.8 | BehaviorSubject — estado global de sessão |
| Angular Signals | — | Estado reativo de projeto |
| Web Workers + SubtleCrypto | — | DH key exchange e AES-GCM off-thread |
| @angular/fire | 19.2 | Firebase Analytics e Auth |
| SCSS | — | Estilo global pixel-art / retro |

---



## Como Rodar

```bash
# 1. Build do frontend → gera os estáticos em src/main/resources/static/
cd frontend/prismo-chunks && npm run build

# 2. Sobe o backend na porta 5000 (serve a API + o Angular)
mvn clean spring-boot:run
```

> **Frontend isolado (dev):** `cd frontend/prismo-chunks && npm start`

---

## Licença

[Apache License 2.0](./LICENSE)
