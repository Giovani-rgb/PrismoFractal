#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Carrega variáveis do .env
const envPath = path.join(__dirname, '../.env');
const config = dotenv.config({ path: envPath });

const env = {
  appName: process.env.VITE_APP_NAME || 'Prismo',
  appVersion: process.env.VITE_APP_VERSION || '0.0.1',
  apiUrl: process.env.VITE_API_URL || 'http://localhost:8080',
  sessionTimeout: process.env.VITE_SESSION_TIMEOUT || '1800000',
  jwtTokenKey: process.env.VITE_JWT_TOKEN_KEY || 'prismo_jwt_token',
};

// Gera conteúdo do environment.ts
const envContent = `export const environment = {
  production: false,
  appName: '${env.appName}',
  appVersion: '${env.appVersion}',
  apiUrl: '${env.apiUrl}',
  sessionTimeout: ${env.sessionTimeout},
  jwtTokenKey: '${env.jwtTokenKey}',
};
`;

const envPath2 = path.join(__dirname, '../src/environments/environment.ts');
fs.writeFileSync(envPath2, envContent, 'utf-8');

console.log('✅ Environment carregado das variáveis VITE_*');
console.log('📝 Arquivo gerado: src/environments/environment.ts');
