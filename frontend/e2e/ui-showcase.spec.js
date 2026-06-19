import { test, expect } from '@playwright/test';

/**
 * UI Showcase screenshots for GitHub README.
 * Captures key features: 3D Modeler (CarCustomizer in PreRaceSetup with different weathers),
 * and other main UI panels.
 *
 * Run with: cd frontend && npx playwright test e2e/ui-showcase.spec.js --headed (or without for headless)
 * Screenshots saved to frontend/screenshots/
 */

test.describe('StratBot UI Showcase', () => {
  test.beforeEach(async ({ page }) => {
    // Start at root, boot sequence will auto-complete to SETUP
    await page.goto('/');
    // Wait for boot to finish and PreRaceSetup to be visible (the 3D car customizer section)
    await page.waitForSelector('text=Customize Your Driver\'s Car', { timeout: 30000 });
    // Give time for 3D canvas to render and models to load
    await page.waitForTimeout(3000);
  });

  test('3D Modeler - Clear weather (showcase car customizer)', async ({ page }) => {
    // Default is clear
    await page.screenshot({
      path: 'screenshots/3d-modeler-clear.png',
      fullPage: true,
    });
  });

  test('3D Modeler - Rainy weather (brighter car against custom dark BG)', async ({ page }) => {
    // Select rainy weather in the setup
    // Look for weather cards or buttons
    const rainyButton = page.locator('button, div', { hasText: /Rainy|rainy/ }).first();
    if (await rainyButton.isVisible()) {
      await rainyButton.click();
      await page.waitForTimeout(1500); // allow weather change to update 3D lights/BG
    }
    await page.screenshot({
      path: 'screenshots/3d-modeler-rainy.png',
      fullPage: true,
    });
  });

  test('3D Modeler - Overcast weather', async ({ page }) => {
    const overcastButton = page.locator('button, div', { hasText: /Overcast|overcast/ }).first();
    if (await overcastButton.isVisible()) {
      await overcastButton.click();
      await page.waitForTimeout(1500);
    }
    await page.screenshot({
      path: 'screenshots/3d-modeler-overcast.png',
      fullPage: true,
    });
  });

  test('PreRaceSetup full - with 3D viewer and controls', async ({ page }) => {
    await page.screenshot({
      path: 'screenshots/pre-race-setup.png',
      fullPage: true,
    });
  });

  test('Main App - Boot to Setup transition', async ({ page }) => {
    // This captures the boot sequence UI if still visible, or current setup
    await page.goto('/');
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: 'screenshots/app-boot-setup.png',
      fullPage: true,
    });
  });
});