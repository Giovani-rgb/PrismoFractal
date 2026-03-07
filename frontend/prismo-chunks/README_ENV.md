# Variáveis de Ambiente - Frontend (VITE)

O frontend agora carrega variáveis de ambiente prefixadas com `VITE_` automaticamente.

## 📝 Arquivo `.env`

Crie um arquivo `.env` na raiz de `frontend/prismo-chunks/`:

```env
VITE_APP_NAME=Prismo
VITE_APP_VERSION=0.0.1
VITE_API_URL=http://localhost:8080
VITE_SESSION_TIMEOUT=1800000
VITE_JWT_TOKEN_KEY=prismo_jwt_token
```

## 🔄 Como Funciona

1. **Script Automático**: Antes de `npm run serve` ou `npm run build`, o script `load-env.js` é executado automaticamente
2. **Arquivo Gerado**: As variáveis são lidas do `.env` e injetadas em `src/environments/environment.ts`
3. **TypeScript**: Seu código TypeScript pode importar e usar normalmente:

```typescript
import { environment } from '../../environments/environment';

console.log(environment.appName);     // Prismo
console.log(environment.apiUrl);      // http://localhost:8080
```

## 🚀 Uso

```bash
# Em desenvolvimento (lê .env)
npm run serve

# Em produção (lê .env e faz build)
npm run build
```

## 🔐 Segurança

- **`.env`** → Adicione ao `.gitignore` (já está configurado)
- **`.env.example`** → Compartilhe com o repositório como template
- **Secrets do Replit** → Configure as variáveis sensíveis como Secrets no Replit

## 📦 Secrets do Replit

Se você colocou `VITE_APP_NAME` como Secret, o script lerá automaticamente de `process.env.VITE_*`.
