const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshot-full.png', fullPage: false });
  
  // Click settings button and take screenshot
  await page.click('button[title="Settings"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshot-settings.png' });
  await page.keyboard.press('Escape');
  
  // Upload a test screenshot image
  // First take screenshot of export area
  await page.screenshot({ path: 'screenshot-export-area.png' });

  await browser.close();
})();
