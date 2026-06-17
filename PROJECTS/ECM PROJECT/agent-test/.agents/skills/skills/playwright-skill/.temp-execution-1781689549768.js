const { chromium } = require('playwright');
const path = require('path');

const TARGET_URL = process.env.TARGET_URL || 'https://www.saucedemo.com/';
const TRACE_PATH = '/tmp/saucedemo-trace.zip';
const SCREENSHOT_PATH = '/tmp/saucedemo-cart.png';

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();

  const checks = [];
  const check = async (name, fn) => {
    try {
      await fn();
      checks.push({ name, status: 'PASS' });
      console.log(`PASS ${name}`);
    } catch (error) {
      checks.push({ name, status: 'FAIL', error: error.message });
      console.log(`FAIL ${name}: ${error.message}`);
      throw error;
    }
  };

  try {
    await check('open login page', async () => {
      await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
      await page.locator('[data-test="username"]').waitFor({ timeout: 10000 });
    });

    await check('login standard_user', async () => {
      await page.locator('[data-test="username"]').fill('standard_user');
      await page.locator('[data-test="password"]').fill('secret_sauce');
      await page.locator('[data-test="login-button"]').click();
      await page.waitForURL('**/inventory.html', { timeout: 10000 });
      await page.locator('[data-test="title"]').filter({ hasText: 'Products' }).waitFor();
    });

    await check('add backpack to cart', async () => {
      await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
      await page.locator('[data-test="shopping-cart-badge"]').filter({ hasText: '1' }).waitFor();
    });

    await check('open cart and verify item', async () => {
      await page.locator('[data-test="shopping-cart-link"]').click();
      await page.waitForURL('**/cart.html', { timeout: 10000 });
      await page.locator('[data-test="inventory-item-name"]').filter({ hasText: 'Sauce Labs Backpack' }).waitFor();
      await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
    });
  } finally {
    await context.tracing.stop({ path: TRACE_PATH });
    await browser.close();
    console.log(`TRACE ${TRACE_PATH}`);
    console.log(`SCREENSHOT ${SCREENSHOT_PATH}`);
    console.log(`RESULTS ${JSON.stringify(checks)}`);
  }
})();
