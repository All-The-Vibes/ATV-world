// Keep the name field, every portrait, and both sets of actions inside the character picker.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const shots = process.env.CHARACTER_PICKER_SCREENSHOTS;
if (shots) mkdirSync(shots, { recursive: true });
const server = await createServer({
    cacheDir: mkdtempSync(join(tmpdir(), 'atv-character-picker-vite-')),
    server: { host: '127.0.0.1', port: 0, strictPort: true, fs: { allow: [process.cwd(), realpathSync('node_modules')] } },
});

async function checkBounds(page, label) {
    const layout = await page.locator('.name-card').evaluate(card => {
        const box = card.getBoundingClientRect();
        return {
            inViewport: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight,
            width: card.clientWidth,
            contentWidth: card.scrollWidth,
            overflowing: [...card.querySelectorAll('h2, p, input, button, canvas')].filter(child => {
                const rect = child.getBoundingClientRect();
                return rect.left < box.left || rect.right > box.right;
            }).map(child => child.getAttribute('aria-label') || child.tagName),
        };
    });
    assert.ok(layout.inViewport, `${label}: dialog stays inside the viewport`);
    assert.ok(layout.contentWidth <= layout.width + 1, `${label}: content spills out of the dialog: ${JSON.stringify(layout)}`);
    assert.deepEqual(layout.overflowing, [], `${label}: every control and portrait fits inside the dialog`);
}

let browser;
try {
    await server.listen();
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
    for (const [width, height] of [[1103, 969], [1280, 800], [768, 1024], [375, 812], [320, 568], [667, 375], [375, 320]]) {
        const label = `${width}x${height}`;
        const context = await browser.newContext({ viewport: { width, height }, hasTouch: width <= 768 });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/api/health', route => route.fulfill({ json: { state: 'unknown', message: 'AWAITING CI' } }));
        await page.route('**/api/negotiate**', route => route.fulfill({ json: { url: null } }));
        // App normally skips onboarding for webdriver. Exercise the actual first-visit dialog.
        await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
        await page.goto(origin);
        const dialog = page.getByRole('dialog', { name: 'Pick your name and character' });
        await dialog.waitFor();
        await page.evaluate(() => document.fonts.ready);
        if (shots) await page.screenshot({ path: join(shots, `${label}-initial.png`) });
        await checkBounds(page, label);

        const enter = page.getByRole('button', { name: 'ENTER THE WORLD', exact: true });
        assert.equal(await enter.isDisabled(), true, `${label}: a name and character are required`);
        await page.getByRole('textbox', { name: 'Your name' }).fill('Ada');
        const picks = page.getByRole('radio');
        assert.equal(await picks.count(), 12, `${label}: all character choices are present`);
        for (const pick of await picks.all()) {
            await pick.scrollIntoViewIfNeeded();
            const reachable = await pick.evaluate(button => {
                const box = button.getBoundingClientRect();
                const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
                return box.width >= 44 && box.height >= 44 && button.contains(hit);
            });
            assert.ok(reachable, `${label}: ${await pick.getAttribute('aria-label')} is reachable without horizontal scrolling`);
            await pick.click();
            assert.equal(await pick.getAttribute('aria-checked'), 'true');
        }
        await checkBounds(page, `${label} after selection`);
        if (shots) await page.screenshot({ path: join(shots, `${label}-selected.png`) });
        await enter.click();
        await dialog.waitFor({ state: 'detached' });
        assert.equal(await page.evaluate(() => localStorage.getItem('atv-world-name')), 'Ada');

        await page.getByRole('button', { name: 'CHANGE NAME / CHARACTER', exact: true }).click();
        await dialog.waitFor();
        await checkBounds(page, `${label} edit dialog`);
        await page.getByRole('button', { name: 'SAVE', exact: true }).scrollIntoViewIfNeeded();
        await page.getByRole('button', { name: 'CANCEL', exact: true }).click();
        await dialog.waitFor({ state: 'detached' });
        assert.deepEqual(errors, [], `${label}: no browser exceptions`);
        await context.close();
        console.log(`PASS ${label}: contained controls, all portraits selectable, entry and edit/cancel work.`);
    }
} finally {
    await browser?.close();
    await server.close();
}
