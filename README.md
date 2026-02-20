# PRISMO - Music Composition Tool

## Estrutura do Projeto

O projeto é dividido em dois grandes blocos: **Frontend** (Angular) e **Backend** (Spring Boot).

```text
.
├── frontend/prismo-chunks/    # Aplicação Angular (Interface do Usuário)
│   ├── src/app/               # Componentes, Serviços e Páginas
│   └── ...
├── src/main/java/com/prismo/  # Backend Spring Boot (API e Lógica)
│   ├── controller/            # Endpoints da API (AuthController, MusicController)
│   ├── domain/                # Entidades e Modelos (User, Music, Session)
│   ├── repository/            # Interfaces de acesso ao Banco de Dados (JPA)
│   ├── security/              # Configurações de Segurança e JWT
│   └── service/               # Lógica de negócio
└── src/main/resources/        # Configurações do sistema (application.properties)
```

## Como Construir com esta Estrutura

### 1. Backend (Java / Spring Boot)
O backend segue o padrão **MVC (Model-View-Controller)** e utiliza **Spring Security** com **JWT** para proteção das rotas.

- **Para criar novos recursos:**
  1. Defina a Entidade em `domain/`.
  2. Crie a interface em `repository/` estendendo `JpaRepository`.
  3. Implemente a lógica em `service/`.
  4. Exponha os endpoints em `controller/`.
- **Segurança:** Todas as rotas (exceto `/api/auth/**`) exigem um token JWT no Header (`Authorization: Bearer <token>`).

### 2. Frontend (Angular)
A interface é construída de forma modular, focada em "chunks" (pedaços de música).

- **Para criar novas telas:**
  1. Crie o componente em `frontend/prismo-chunks/src/app/pages/`.
  2. Adicione a rota no arquivo de roteamento da aplicação.
  3. Use os **Serviços** (`ProjectService`, `SessionService`) para buscar dados do Backend.

### 3. Banco de Dados (Supabase)
As configurações de conexão direta estão em `src/main/resources/application.properties`. Certifique-se de configurar a Secret `SUPABASE_PASSWORD` no Replit.

## Comandos Úteis

- **Rodar Backend:** `mvn clean spring-boot:run`
- **Rodar Frontend:** `cd frontend/prismo-chunks && npm run serve`
