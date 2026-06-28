import os
os.environ['PYTHONIOENCODING'] = 'utf-8'
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page()
    pg.set_viewport_size({'width': 1400, 'height': 900})
    pg.goto('http://localhost:5173')
    pg.wait_for_timeout(2500)

    theme = pg.eval_on_selector('html', 'el => el.getAttribute("data-theme")')
    bg = pg.eval_on_selector('body', 'el => window.getComputedStyle(el).backgroundColor')
    print(f'Theme: {theme}  Body bg: {bg}')
    pg.screenshot(path='v01-dark-initial.png')

    # Settings modal - open and close
    pg.click('button[title="Settings"]')
    pg.wait_for_timeout(600)
    pg.screenshot(path='v02-settings-open.png')
    pg.keyboard.press('Escape')
    pg.wait_for_timeout(400)
    pg.screenshot(path='v03-after-escape.png')
    print('Settings modal opened and closed OK')

    # About modal
    pg.click('button[title="About"]')
    pg.wait_for_timeout(600)
    pg.screenshot(path='v04-about-open.png')
    pg.keyboard.press('Escape')
    pg.wait_for_timeout(400)
    print('About modal opened and closed OK')

    # Add blank screen
    pg.click('.add-blank-btn')
    pg.wait_for_timeout(600)
    pg.screenshot(path='v05-blank-added.png')
    print('Blank screen added')

    # Background tab controls
    pg.click('.tab[data-tab="background"]')
    pg.wait_for_timeout(300)
    pg.screenshot(path='v06-background-tab.png')

    # Image type - check overlay shows
    pg.click('button:has-text("Image")')
    pg.wait_for_timeout(300)
    pg.screenshot(path='v07-image-bg.png')
    pg.click('button:has-text("Gradient")')
    pg.wait_for_timeout(200)

    # Gradient presets
    pg.click('.preset-dropdown-trigger')
    pg.wait_for_timeout(300)
    pg.screenshot(path='v08-gradient-presets.png')
    pg.keyboard.press('Escape')
    pg.wait_for_timeout(200)

    # Device tab
    pg.click('.tab[data-tab="screenshot"]')
    pg.wait_for_timeout(300)
    pg.screenshot(path='v09-device-tab.png')

    # 3D mode
    pg.click('button:has-text("3D")')
    pg.wait_for_timeout(400)
    pg.screenshot(path='v10-3d-mode.png')
    pg.click('button:has-text("2D")')
    pg.wait_for_timeout(300)

    # Text tab
    pg.click('.tab[data-tab="text"]')
    pg.wait_for_timeout(300)
    pg.screenshot(path='v11-text-tab.png')

    # Elements tab - emoji picker
    pg.click('.tab[data-tab="elements"]')
    pg.wait_for_timeout(300)
    emoji_btn = pg.query_selector('button.add-btn-small:has-text("Emoji")')
    if emoji_btn:
        emoji_btn.click()
        pg.wait_for_timeout(600)
        pg.screenshot(path='v12-emoji-picker.png')
        pg.keyboard.press('Escape')
        pg.wait_for_timeout(300)
        print('Emoji picker opened OK')

    # Icon picker
    icon_btn = pg.query_selector('button.add-btn-small:has-text("Icon")')
    if icon_btn:
        icon_btn.click()
        pg.wait_for_timeout(600)
        pg.screenshot(path='v13-icon-picker.png')
        pg.keyboard.press('Escape')
        pg.wait_for_timeout(300)
        print('Icon picker opened OK')

    # Popouts tab
    pg.click('.tab[data-tab="popouts"]')
    pg.wait_for_timeout(300)
    pg.screenshot(path='v14-popouts-tab.png')

    # Language menu
    pg.click('.language-btn')
    pg.wait_for_timeout(400)
    pg.screenshot(path='v15-language-menu.png')
    pg.keyboard.press('Escape')
    pg.wait_for_timeout(300)

    # Project dropdown
    pg.click('.project-trigger')
    pg.wait_for_timeout(400)
    pg.screenshot(path='v16-project-dropdown.png')
    pg.keyboard.press('Escape')
    pg.wait_for_timeout(300)

    # New project modal
    pg.click('button[title="New Project"]')
    pg.wait_for_timeout(400)
    pg.screenshot(path='v17-new-project-modal.png')
    pg.keyboard.press('Escape')
    pg.wait_for_timeout(300)

    # Right-click context menu on screenshot item
    screenshot_items = pg.query_selector_all('.screenshot-item')
    if screenshot_items:
        screenshot_items[0].click(button='right')
        pg.wait_for_timeout(400)
        pg.screenshot(path='v18-context-menu.png')
        pg.keyboard.press('Escape')
        pg.wait_for_timeout(300)
        print('Context menu opened OK')

    b.close()
print('All verification screenshots taken!')
