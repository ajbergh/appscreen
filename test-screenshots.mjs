import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto('http://localhost:5173');
await page.waitForTimeout(2000);
await page.screenshot({ path: 'screenshot-full.png' });

// Try settings
const settingsBtn = await page.$('button[title="Settings"]');
if (settingsBtn) {
  await settingsBtn.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'screenshot-settings.png' });
  await page.keyboard.press('Escape');
}

// Try About
const aboutBtn = await page.$('button[title="About"]');
if (aboutBtn) {
  await aboutBtn.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'screenshot-about.png' });
  await page.keyboard.press('Escape');
}

// Check sidebar buttons
const buttons = await page.$$eval('button', btns => btns.map(b => ({ text: b.textContent?.trim().slice(0,40), title: b.title, disabled: b.disabled })));
console.log('Buttons found:', JSON.stringify(buttons.slice(0, 30), null, 2));

await browser.close();
