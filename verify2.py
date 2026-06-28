import os
os.environ['PYTHONIOENCODING'] = 'utf-8'
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page()
    pg.set_viewport_size({'width': 1400, 'height': 900})
    pg.goto('http://localhost:5173')
    pg.wait_for_timeout(2500)

    # Add 3 blank screens to test side previews
    for i in range(3):
        pg.click('.add-blank-btn')
        pg.wait_for_timeout(300)

    pg.wait_for_timeout(500)
    pg.screenshot(path='v2-01-multiple-screens.png')
    print('Multiple screens screenshot taken')

    # Click the second screenshot
    items = pg.query_selector_all('.screenshot-item')
    if len(items) >= 2:
        items[1].click()
        pg.wait_for_timeout(400)
        pg.screenshot(path='v2-02-second-selected.png')
        print(f'Second screenshot selected, {len(items)} items total')

    # Check side previews are visible
    left_hidden = pg.eval_on_selector('#side-preview-left', 'el => el.classList.contains("hidden")')
    right_hidden = pg.eval_on_selector('#side-preview-right', 'el => el.classList.contains("hidden")')
    left_style = pg.eval_on_selector('#side-preview-left', 'el => el.style.right')
    right_style = pg.eval_on_selector('#side-preview-right', 'el => el.style.left')
    print(f'Left preview hidden: {left_hidden}, style.right: {left_style}')
    print(f'Right preview hidden: {right_hidden}, style.left: {right_style}')

    # Device tab with 3D mode
    pg.click('.tab[data-tab="screenshot"]')
    pg.wait_for_timeout(300)
    pg.screenshot(path='v2-03-device-tab-2d.png')

    # Switch to 3D
    pg.click('button:has-text("3D")')
    pg.wait_for_timeout(500)
    pg.screenshot(path='v2-04-device-tab-3d.png')
    print('3D tab screenshot taken')

    # Check 3D controls visible
    scale_visible = pg.query_selector('label:has-text("Screenshot Scale")')
    frame_colors = pg.query_selector_all('[style*="border-radius: 6px"][style*="cursor: pointer"]')
    print(f'Screenshot Scale label visible: {scale_visible is not None}')
    print(f'Frame color swatches count: {len(frame_colors)}')

    # Screenshot list with device info
    device_info = pg.eval_on_selector_all('.screenshot-device', 'els => els.map(e => e.textContent.trim())')
    print(f'Device info in screenshot items: {device_info[:3]}')

    b.close()
print('Done!')
