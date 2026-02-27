# PRISMO - Music Composition Tool

PRISMO é uma ferramenta criativa para gerenciar letras de música e estrutura musical usando conceitos de games (chunks, world, DNA). Construída com Angular (frontend) e Spring Boot (backend).

## 🚀 Estrutura do Projeto

O projeto é organizado em uma arquitetura modular para facilitar a manutenção e escalabilidade.

```text
.
├── frontend/prismo-chunks/    # Aplicação Angular (Interface do Usuário)
│   ├── src/app/               # Componentes, Serviços e Páginas
│   └── ...
├── src/main/java/com/prismo/  # Backend Spring Boot (API e Lógica)
│   ├── config/                # Configurações de Segurança e App
│   ├── controller/            # Controllers Gerais (View, etc)
│   ├── modules/               # Módulos de Feature (Modularização)
│   │   └── session/           # Módulo de Sessão (Exemplo de modularização)
│   │       ├── controller/    # SessionController
│   │       ├── model/         # Session Entity
│   │       ├── repository/    # SessionRepository e Queries
│   │       └── service/       # ServiceSession
│   └── ...
├── src/main/resources/        # Recursos e Estáticos
│   ├── static/                # Build do Frontend (Angular)
│   └── application.properties # Configurações Globais
└── LICENSE                    # Licença Apache 2.0
```

## 🛠️ Tecnologias

- **Backend:** Java 17, Spring Boot 3.2, JPA, Spring Security (JWT).
- **Frontend:** Angular 21, TypeScript, SCSS
- **Banco de Dados:** PostgreSQL (Supabase)
- **Licença:** Apache 2.0

## ⚙️ Configuração e Constantes

Para configurar o projeto localmente ou no Replit, consulte o arquivo [constants.example.md](./constants.example.md). Ele contém todos os segredos e constantes necessários.

### Variáveis Críticas:
- `SUPABASE_PASSWORD`: Senha do banco de dados.
- `JWT_SECRET`: Chave para assinatura dos tokens.

## 🚀 Como Rodar

### Rodar o Projeto Completo (Recomendado)
O backend está configurado para servir o frontend na porta 5000.
```bash
mvn clean spring-boot:run
```

### Rodar Frontend em Desenvolvimento
```bash
cd frontend/prismo-chunks && npm run serve
```

## ⚖️ Licença

Este projeto está licenciado sob a **Apache License 2.0**. Veja o arquivo [LICENSE](./LICENSE) para mais detalhes.
