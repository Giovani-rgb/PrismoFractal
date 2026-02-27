# Configuração de Constantes e Variáveis de Ambiente

Este arquivo serve como exemplo para as constantes e segredos necessários no projeto PRISMO.
Copie as informações abaixo para o seu arquivo de configuração local ou configure as variáveis de ambiente no Replit.

## Variáveis de Ambiente (Replit Secrets / .env)

```env
# Database Supabase
SUPABASE_PASSWORD=sua_senha_aqui

# JWT Security
JWT_SECRET=minha-chave-secreta-muito-segura-e-longa-para-jwt-256-bits
JWT_EXPIRATION=86400000

# Server Config
PORT=5000
```

## application.properties (Spring Boot)

As constantes globais são injetadas via `${VAR_NAME:default_value}` no arquivo `src/main/resources/application.properties`.

```properties
# Exemplo de configuração de banco de dados
spring.datasource.url=jdbc:postgresql://aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&prepareThreshold=0
spring.datasource.username=postgres.wvanppmquhwiiucuqquo
spring.datasource.password=${SUPABASE_PASSWORD}

# Exemplo de configuração JWT
jwt.secret=${JWT_SECRET}
jwt.expiration=${JWT_EXPIRATION}
```

## Constantes Globais de Negócio

Configuradas em `src/main/resources/application.properties`:

```properties
app.admin.username=admin
app.admin.password=admin123
app.admin.role=ROLE_ADMIN
application.version=0.0.1-SNAPSHOT
app.environment=DEV
```
