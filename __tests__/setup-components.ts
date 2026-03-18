// ================================================================
// Test setup for component tests (.tsx) — extends vitest with DOM matchers
// ================================================================
// This file runs before every test. For .tsx tests, vitest uses jsdom
// environment (configured via environmentMatchGlobs in vitest.config.ts).

import '@testing-library/jest-dom/vitest';
