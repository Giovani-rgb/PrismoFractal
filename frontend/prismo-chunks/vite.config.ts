import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // 👈 Ativa o describe, it, expect globais para o TypeScript encontrar
    environment: 'jsdom', // Emula o ambiente de navegador/DOM para o Angular
    include: ['src/**/*.spec.ts'], // Mapeia onde estão suas esteiras de teste
  },
});
