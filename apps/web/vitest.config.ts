import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.tsx', 'src/**/*.test.ts', 'test/**/*.test.tsx', 'test/**/*.test.ts'],
    globals: false,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@operscale-calendar/agent': fileURLToPath(new URL('../agent/src', import.meta.url)),
    },
  },
});
