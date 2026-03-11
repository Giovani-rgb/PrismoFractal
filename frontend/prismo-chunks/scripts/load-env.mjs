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
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(line => {
        const index = line.indexOf('=');
        if (index === -1) return [line, ''];
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      })
  );
}

// Carrega .env
const envFilePath = resolve(__dirname, '../.env');
const localEnv = parseEnvFile(envFilePath);

// Mescla no process.env para garantir que o script acesse
for (const [key, value] of Object.entries(localEnv)) {
  if (!process.env[key]) process.env[key] = value;
}

// Pega o valor do .env e converte para boolean real
// Se for "true" (string), vira true (boolean). Qualquer outra coisa vira false.
const isProd = process.env.VITE_PRODUCTION === 'true';

const env = {
  production:        isProd,
  appName:           process.env.VITE_APP_NAME            || 'Prismo',
  appId:             process.env.VITE_APP_ID              || 'prismo-app',
  appVersion:        process.env.VITE_APP_VERSION         || '0.0.1',
  appSessionSecret:  process.env.VITE_APP_SESSION_SECRET  || '',
  // URL relativa quando localhost — Spring Boot serve Angular e API na mesma origem
  apiUrl: (() => {
    const raw = process.env.VITE_API_URL || '';
    return raw.includes('localhost') || raw.includes('127.0.0.1') ? '' : raw;
  })(),
  sessionTimeout:    process.env.VITE_SESSION_TIMEOUT     || '1800000',
  jwtTokenKey:       process.env.VITE_JWT_TOKEN_KEY       || 'prismo_jwt_token',
};

const envContent = `export const environment = {
  production: ${env.production},
  appName: '${env.appName}',
  appId: '${env.appId}',
  appVersion: '${env.appVersion}',
  appSessionSecret: '${env.appSessionSecret}',
  apiUrl: '${env.apiUrl}',
  sessionTimeout: ${env.sessionTimeout},
  jwtTokenKey: '${env.jwtTokenKey}',
};
`;

// Caminhos dos arquivos
const envTsPath = resolve(__dirname, '../src/environments/environment.ts');
const prodTsPath = resolve(__dirname, '../src/environments/environment.prod.ts');

// Salva em ambos para garantir que o Angular encontre os arquivos
writeFileSync(envTsPath, envContent, 'utf-8');
writeFileSync(prodTsPath, envContent, 'utf-8');

console.log(`🚀 Environment gerado com production: ${env.production}`);
