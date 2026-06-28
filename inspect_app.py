import os, sys
os.environ['PYTHONIOENCODING'] = 'utf-8'
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page()
    pg.set_viewport_size({'width': 1400, 'height': 900})

    console_msgs = []
    pg.on('console', lambda msg: console_msgs.append(f'[{msg.type}] {msg.text}'))

    pg.goto('http://localhost:5173')
    pg.wait_for_timeout(2500)

    # Check theme applied
    theme = pg.eval_on_selector('html', 'el => el.getAttribute("data-theme")')
    bg_color = pg.eval_on_selector('body', 'el => window.getComputedStyle(el).backgroundColor')
    print(f'Theme attr: {theme}')
    print(f'Body bg color: {bg_color}')

    # Check if settings modal exists in DOM
    settings_modal = pg.query_selector('.modal-overlay')
    print(f'Modal overlay in DOM (initially): {settings_modal is not None}')

    # Click settings button
    pg.click('button[title="Settings"]')
    pg.wait_for_timeout(800)

    modal_overlay = pg.query_selector('.modal-overlay')
    print(f'Modal overlay after settings click: {modal_overlay is not None}')

    if modal_overlay:
        modal_visible = pg.eval_on_selector('.modal-overlay', 'el => window.getComputedStyle(el).display')
        print(f'Modal display: {modal_visible}')
        pg.screenshot(path='screenshot-settings-actual.png')
    else:
        pg.screenshot(path='screenshot-settings-no-modal.png')

    pg.keyboard.press('Escape')
    pg.wait_for_timeout(300)

    # Check what's in the left sidebar footer
    footer_html = pg.eval_on_selector('.sidebar-footer', 'el => el.innerHTML.slice(0, 500)')
    print(f'Footer HTML snippet: {footer_html[:200]}')

    # Check output size select
    select_val = pg.eval_on_selector('.output-size-select', 'el => el.value')
    print(f'Output size select value: {select_val}')

    # Add blank and then check the canvas
    pg.click('.add-blank-btn')
    pg.wait_for_timeout(600)

    # Check Device tab
    pg.click('.tab[data-tab="screenshot"]')
    pg.wait_for_timeout(400)
    pg.screenshot(path='screenshot-device-tab.png')

    # Check Text tab
    pg.click('.tab[data-tab="text"]')
    pg.wait_for_timeout(400)
    pg.screenshot(path='screenshot-text-tab.png')

    # Check Elements tab
    pg.click('.tab[data-tab="elements"]')
    pg.wait_for_timeout(400)
    pg.screenshot(path='screenshot-elements-tab.png')

    # Check Project dropdown
    pg.click('.project-trigger')
    pg.wait_for_timeout(400)
    pg.screenshot(path='screenshot-project-dropdown.png')
    pg.keyboard.press('Escape')

    # Check language menu
    pg.click('.language-btn')
    pg.wait_for_timeout(400)
    pg.screenshot(path='screenshot-language-menu.png')
    pg.keyboard.press('Escape')

    print('\\nConsole messages:')
    for m in console_msgs[:20]:
        print(m)

    b.close()
print('Done')
