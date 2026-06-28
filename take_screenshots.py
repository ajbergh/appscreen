import os, sys
os.environ['PYTHONIOENCODING'] = 'utf-8'
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page()
    pg.set_viewport_size({'width': 1400, 'height': 900})

    # Capture console errors
    console_errors = []
    pg.on('console', lambda msg: console_errors.append(msg.text) if msg.type == 'error' else None)

    pg.goto('http://localhost:5173')
    pg.wait_for_timeout(2500)
    pg.screenshot(path='screenshot-01-initial.png')

    # Click Settings button
    try:
        pg.click('button[title="Settings"]')
        pg.wait_for_timeout(700)
        pg.screenshot(path='screenshot-02-settings.png')
        pg.keyboard.press('Escape')
        pg.wait_for_timeout(300)
    except Exception as e:
        print('Settings error:', e)

    # Click About button
    try:
        pg.click('button[title="About"]')
        pg.wait_for_timeout(700)
        pg.screenshot(path='screenshot-03-about.png')
        pg.keyboard.press('Escape')
        pg.wait_for_timeout(300)
    except Exception as e:
        print('About error:', e)

    # Add a blank screen
    try:
        pg.click('.add-blank-btn')
        pg.wait_for_timeout(600)
        pg.screenshot(path='screenshot-04-with-blank.png')
    except Exception as e:
        print('Add blank error:', e)

    # Click the Background tab
    try:
        pg.click('.tab[data-tab="background"]')
        pg.wait_for_timeout(400)
        pg.screenshot(path='screenshot-05-background-tab.png')
    except Exception as e:
        print('Background tab error:', e)

    # Export current
    try:
        pg.click('button[title="Export current"]')
        pg.wait_for_timeout(600)
        pg.screenshot(path='screenshot-06-export.png')
    except Exception as e:
        print('Export error:', e)

    print('Console errors:', console_errors[:5])
    print('Done - screenshots taken')
    b.close()
