import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig({
  plugins:  [
    angular()
  ],
  test: {
    globals: true, // 👈 Ativa o describe, it, expect globais para o TypeScript encontrar
    environment: 'jsdom', // Emula o ambiente de navegador/DOM para o Angular
    include: ['src/**/*.spec.ts'], // Mapeia onde estão suas esteiras de teste
    setupFiles: ['./vitest.setup.ts'],
  },
});
