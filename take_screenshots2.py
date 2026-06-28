import os
os.environ['PYTHONIOENCODING'] = 'utf-8'
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page()
    pg.set_viewport_size({'width': 1400, 'height': 900})

    pg.goto('http://localhost:5173')
    pg.wait_for_timeout(2500)

    # Check theme
    theme = pg.eval_on_selector('html', 'el => el.getAttribute("data-theme")')
    bg = pg.eval_on_selector('body', 'el => window.getComputedStyle(el).backgroundColor')
    print(f'Theme: {theme}, Body bg: {bg}')

    pg.screenshot(path='s01-initial.png')

    # Settings modal
    pg.click('button[title="Settings"]')
    pg.wait_for_timeout(700)
    pg.screenshot(path='s02-settings.png')

    modal_visible = pg.eval_on_selector('.modal-overlay', 'el => window.getComputedStyle(el).opacity')
    modal_display = pg.eval_on_selector('.modal-overlay', 'el => window.getComputedStyle(el).display')
    print(f'Settings modal opacity: {modal_visible}, display: {modal_display}')

    pg.keyboard.press('Escape')
    pg.wait_for_timeout(300)

    # About modal
    pg.click('button[title="About"]')
    pg.wait_for_timeout(600)
    pg.screenshot(path='s03-about.png')
    pg.keyboard.press('Escape')
    pg.wait_for_timeout(300)

    # Add blank screen
    pg.click('.add-blank-btn')
    pg.wait_for_timeout(600)
    pg.screenshot(path='s04-with-content.png')

    # Elements tab and add emoji
    pg.click('.tab[data-tab="elements"]')
    pg.wait_for_timeout(400)
    pg.screenshot(path='s05-elements.png')

    # Click emoji button (should open picker)
    emoji_btn = pg.query_selector('button:has-text("Emoji")')
    if emoji_btn:
        emoji_btn.click()
        pg.wait_for_timeout(600)
        pg.screenshot(path='s06-emoji-picker.png')
        pg.keyboard.press('Escape')
        pg.wait_for_timeout(300)

    b.close()
print('Done')
