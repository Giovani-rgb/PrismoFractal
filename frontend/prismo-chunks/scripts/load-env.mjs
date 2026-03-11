import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const content = readFileSync(filePath, 'utf-8');
  return Object.fromEntries(
    content
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .map(line => {
        const [key, ...rest] = line.split('=');
        return [key.trim(), rest.join('=').trim()];
      })
  );
}

// Carrega .env local (não sobrescreve o que já está em process.env)
const envFilePath = resolve(__dirname, '../.env');
const localEnv = parseEnvFile(envFilePath);

for (const [key, value] of Object.entries(localEnv)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

// Lê variáveis - prioridade: Replit Secrets (process.env) > .env > default
const env = {
  appName:           process.env.VITE_APP_NAME            || 'Prismo',
  appId:             process.env.VITE_APP_ID              || 'prismo-app',
  appVersion:        process.env.VITE_APP_VERSION         || '0.0.1',
  appSessionSecret:  process.env.VITE_APP_SESSION_SECRET  || '',
  apiUrl:            process.env.VITE_API_URL             || 'http://localhost:8080',
  sessionTimeout:    process.env.VITE_SESSION_TIMEOUT     || '1800000',
  jwtTokenKey:       process.env.VITE_JWT_TOKEN_KEY       || 'prismo_jwt_token',
};

// Gera environment.ts
const envContent = `export const environment = {
  production: false,
  appName: '${env.appName}',
  appId: '${env.appId}',
  appVersion: '${env.appVersion}',
  appSessionSecret: '${env.appSessionSecret}',
  apiUrl: '${env.apiUrl}',
  sessionTimeout: ${env.sessionTimeout},
  jwtTokenKey: '${env.jwtTokenKey}',
};
`;

const envTsPath = resolve(__dirname, '../src/environments/environment.ts');
writeFileSync(envTsPath, envContent, 'utf-8');

console.log('Environment gerado a partir de VITE_* secrets');
console.log(`  VITE_APP_NAME: ${env.appName}`);
console.log(`  VITE_APP_ID: ${env.appId}`);
console.log(`  VITE_APP_SESSION_SECRET: ${env.appSessionSecret ? '***' : '(não definido)'}`);
console.log(`  VITE_API_URL: ${env.apiUrl}`);
