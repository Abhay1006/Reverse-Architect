import { defineConfig, devices } from '@playwright/test';
import os from 'os';
import path from 'path';

// Dedicated ports and cache so the smoke test never touches a dev server
// or the cache you use day to day.
const API_PORT = 4100;
const WEB_PORT = 3100;

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${WEB_PORT}`, trace: 'retain-on-failure', ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
  webServer: [
    {
      command: 'npm run dev -w backend',
      cwd: '..',
      url: `http://localhost:${API_PORT}/api/health`,
      env: { PORT: String(API_PORT), ATLAS_DB_PATH: path.join(os.tmpdir(), `atlas-e2e-${process.pid}.db`) },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npx next dev -p ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      env: { BACKEND_URL: `http://localhost:${API_PORT}`, NEXT_PUBLIC_BACKEND_URL: `http://localhost:${API_PORT}`, NEXT_PUBLIC_USE_PROXY: 'true' },
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
