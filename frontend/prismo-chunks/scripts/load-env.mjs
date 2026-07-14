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

// Carrega .env local (não sobrescreve Replit Secrets já em process.env)
const envFilePath = resolve(__dirname, '../.env');
const localEnv = parseEnvFile(envFilePath);
for (const [key, value] of Object.entries(localEnv)) {
  if (!process.env[key]) process.env[key] = value;
}

const isProd = process.env.VITE_PRODUCTION === 'true';

// URL relativa quando localhost — Spring Boot serve Angular e API na mesma origem
const rawApiUrl = process.env.VITE_API_URL || '';
const apiUrl = rawApiUrl.includes('localhost') || rawApiUrl.includes('127.0.0.1') ? '' : rawApiUrl;

const env = {
  production:        isProd,
  appName:           process.env.VITE_APP_NAME            || 'Prismo',
  appId:             process.env.VITE_APP_ID              || 'prismo-app',
  appVersion:        process.env.VITE_APP_VERSION         || '0.0.1',
  sandbox:
process.env.VITE_SANDBOX  === true,
  appSessionSecret:  process.env.VITE_APP_SESSION_SECRET  || '',
  apiUrl,
  sessionTimeout:    process.env.VITE_SESSION_TIMEOUT     || '1800000',
  nameSessionKey:       process.env.VITE_NAME_SESSION_KEY       || 'name_session_key',
  vaultPassword: process.env.VITE_VAULT_PASSWORD ||
  'password_vault',
  firebase: {
    apiKey:            process.env.VITE_FIREBASE_API_KEY             || '',
    authDomain:        process.env.VITE_FIREBASE_AUTH_DOMAIN         || '',
    projectId:         process.env.VITE_FIREBASE_PROJECT_ID         || '',
    storageBucket:     process.env.VITE_FIREBASE_STORAGE_BUCKET     || '',
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId:             process.env.VITE_FIREBASE_APP_ID             || '',
    measurementId:     process.env.VITE_FIREBASE_MEASUREMENT_ID     || '',
  },
};

const envContent = `export const environment = {
  production: ${env.production},
  appName: '${env.appName}',
  appId: '${env.appId}',
  appVersion: '${env.appVersion}',
  appSessionSecret: '${env.appSessionSecret}',
  apiUrl: '${env.apiUrl}',
  sessionTimeout: ${env.sessionTimeout},
  nameSessionKey: '${env.nameSessionKey}',
  vaultPassword: '${env.vaultPassword}',
  firebase: {
    apiKey: '${env.firebase.apiKey}',
    authDomain: '${env.firebase.authDomain}',
    projectId: '${env.firebase.projectId}',
    storageBucket: '${env.firebase.storageBucket}',
    messagingSenderId: '${env.firebase.messagingSenderId}',
    appId: '${env.firebase.appId}',
    measurementId: '${env.firebase.measurementId}',
  },
};
`;

const envTsPath = resolve(__dirname, '../src/environments/environment.ts');
const prodTsPath = resolve(__dirname, '../src/environments/environment.prod.ts');

writeFileSync(envTsPath, envContent, 'utf-8');
writeFileSync(prodTsPath, envContent, 'utf-8');

console.log(`Environment gerado com production: ${env.production}`);
console.log(`  firebase.projectId: ${env.firebase.projectId}`);
console.log(`  firebase.apiKey: ${env.firebase.apiKey ? '***' : '(não definido — adicione VITE_FIREBASE_API_KEY nos Secrets)'}`);
