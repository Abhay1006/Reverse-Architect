import { defineConfig } from 'vitest/config';

// Unit and component tests only; e2e/ belongs to Playwright.
export default defineConfig({
  test: { include: ['test/**/*.test.{ts,tsx}'] },
});
