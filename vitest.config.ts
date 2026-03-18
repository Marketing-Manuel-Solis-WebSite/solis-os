import { defineConfig } from 'vitest/config';
import path from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx', 'tests/**/*.test.ts'],
    exclude: ['node_modules', '.next'],
    setupFiles: ['__tests__/setup-components.ts'],
    // Component tests use inline `// @vitest-environment jsdom` directive per file
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      thresholds: {
        lines: 50,
        branches: 30,
        functions: 40,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
