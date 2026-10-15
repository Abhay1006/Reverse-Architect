import { test, expect, type Page } from '@playwright/test';
import AdmZip from 'adm-zip';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Upload a small labelled project as a zip and check the graph renders with
// its analysis. This exercises browser → Next proxy → Express → LSP → back.
const corpus = path.resolve(__dirname, '../../bench/corpus/ts-shop');

/**
 * The header "Analyze" button opens the upload dialog; the landing hero has
 * its own GitHub "Analyze" button, so click until a file input appears.
 */
async function openUpload(page: Page) {
  const fileInput = page.locator('input[type="file"]');
  for (const button of await page.getByRole('button', { name: 'Analyze', exact: true }).all()) {
    if (await fileInput.count()) return;
    await button.click({ timeout: 5_000 }).catch(() => {});
  }
}

test('uploading a zip renders the architecture graph', async ({ page }) => {
  const zipPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-e2e-')), 'ts-shop.zip');
  const zip = new AdmZip();
  zip.addLocalFolder(corpus, 'ts-shop');
  zip.writeZip(zipPath);

  await page.goto('/');
  await openUpload(page);
  await page.locator('input[type="file"]').setInputFiles(zipPath);

  // A React Flow node per file/class: wait for the canvas to fill in.
  await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 90_000 });
  expect(await page.locator('.react-flow__node').count()).toBeGreaterThan(5);

  await page.getByRole('tab', { name: 'Graph' }).click();
  await page.getByRole('button', { name: 'Analysis', exact: true }).click();
  // ts-shop is labelled with one cycle and six design patterns.
  await expect(page.getByRole('button', { name: 'Circular Deps 1' })).toBeVisible();
  // Pattern matches carry the evidence behind them, not just a label.
  await page.getByRole('button', { name: 'Patterns 6' }).click();
  await expect(page.getByText(/has method "getInstance"/)).toBeVisible();
});

// Regenerates the README screenshot: Atlas analysing its own backend.
// Run with UPDATE_SCREENSHOT=1 npm run test:e2e -w frontend
test('README screenshot', async ({ page }) => {
  test.skip(!process.env.UPDATE_SCREENSHOT, 'only when regenerating docs/assets/screenshot.png');
  const backend = path.resolve(__dirname, '../../backend');
  const zipPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-shot-')), 'backend.zip');
  const zip = new AdmZip();
  zip.addLocalFolder(path.join(backend, 'src'), 'backend/src');
  zip.addLocalFile(path.join(backend, 'package.json'), 'backend');
  zip.writeZip(zipPath);

  await page.goto('/');
  await openUpload(page);
  await page.locator('input[type="file"]').setInputFiles(zipPath);
  await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 90_000 });

  await page.getByRole('tab', { name: 'Graph' }).click();
  // The guided tour pops up shortly after the graph loads.
  const tour = page.getByRole('button', { name: 'Got it, thanks!' });
  await tour.waitFor({ timeout: 10_000 }).then(() => tour.click(), () => {});
  // The entry file starts selected, which dims everything else.
  await page.locator('.react-flow__pane').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Fit View' }).click();
  await page.waitForTimeout(1500); // let the layout animation settle
  await page.screenshot({ path: path.resolve(__dirname, '../../docs/assets/screenshot.png') });
});
