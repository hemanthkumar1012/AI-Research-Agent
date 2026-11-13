const { chromium } = await import(process.env.PW_PATH || 'playwright');
const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const ok = (n, v) => console.log((v ? '✓' : '✗ FAIL'), n);

/* ── error paths against a 500 backend ── */
let p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:8898/#/signin'); await p.waitForTimeout(400);
await p.locator('.auth-form label:nth-child(1) input').fill('H');
await p.locator('.auth-form label:nth-child(2) input').fill('h@v.ai');
await p.click('.auth-form button[type=submit]'); await p.waitForTimeout(400);
await p.goto('http://localhost:8898/#/app/research'); await p.waitForTimeout(250);

// client-side validation: too-short question never leaves the page
await p.fill('.ask-input', 'short'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
ok('short question blocked with toast', await p.evaluate(() =>
  location.hash === '#/app/research' && !!document.querySelector('.v-toast.error')));

// server 500: clean error card with working retry + back
await p.fill('.ask-input', 'What is CRISPR and how does it work?'); await p.keyboard.press('Enter');
await p.waitForTimeout(1200);
ok('500 shows error card, no crash', await p.evaluate(() =>
  !!document.querySelector('.prog-error') && /HTTP 500|service error/i.test(document.querySelector('.prog-error p').textContent)));
ok('retry button present', await p.evaluate(() => !!document.querySelector('.prog-err-actions .v-btn.primary')));
await p.click('.prog-err-actions .v-btn.ghost'); await p.waitForTimeout(400);
ok('back to research works', await p.evaluate(() => location.hash === '#/app/research'));

// deep link to a nonexistent report id → graceful message
await p.goto('http://localhost:8898/#/app/report/doesnotexist'); await p.waitForTimeout(400);
ok('missing report handled gracefully', await p.evaluate(() =>
  /not found/i.test(document.querySelector('.app-main').textContent)));
console.log('ERRORS(500 suite):', errs.length ? errs.join(' | ') : 'none');
await p.close();

/* ── export formats + citation click against the real backend ── */
p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs2 = []; p.on('pageerror', e => errs2.push(e.message));
await p.goto('http://localhost:8899/#/signin'); await p.waitForTimeout(400);
await p.locator('.auth-form label:nth-child(1) input').fill('H');
await p.locator('.auth-form label:nth-child(2) input').fill('h@v.ai');
await p.click('.auth-form button[type=submit]'); await p.waitForTimeout(400);
await p.goto('http://localhost:8899/#/app/research'); await p.waitForTimeout(250);
await p.fill('.ask-input', 'What is CRISPR and how does it work?'); await p.keyboard.press('Enter');
await p.waitForTimeout(2200);
ok('real-backend report rendered', await p.evaluate(() => !!document.querySelector('.rep-title')));

// clicking an inline citation jumps to the source card
const citeOk = await p.evaluate(() => !!document.querySelector('sup.cite[data-cite]'));
if (citeOk) { await p.click('sup.cite[data-cite]'); await p.waitForTimeout(700); }
ok('citation click opens Sources', !citeOk || await p.evaluate(() => !!document.querySelector('.src-card')));

for (const fmt of ['HTML', 'Word (.doc)']) {
  await p.click('.rep-actions .v-btn.ghost.sm:has-text("Export")'); await p.waitForTimeout(300);
  await p.click(`.exp-card:has-text("${fmt}")`);
  const dl = p.waitForEvent('download', { timeout: 5000 }).catch(() => null);
  await p.click('.v-modal-foot .v-btn.primary');
  ok(`${fmt} download fires`, !!(await dl));
  await p.waitForTimeout(300);
}
// follow-up against real /api/ask
await p.click('.rep-actions .v-iconbtn[title="More"]'); await p.waitForTimeout(250);
await p.click('.v-pop-item:has-text("Ask a follow-up")'); await p.waitForTimeout(300);
await p.fill('.ask-sendrow input', 'Tell me more'); await p.keyboard.press('Enter'); await p.waitForTimeout(1500);
ok('real follow-up answers', await p.evaluate(() => document.querySelectorAll('.ask-msg.ai:not(.err)').length >= 1));
console.log('ERRORS(real suite):', errs2.length ? errs2.join(' | ') : 'none');
await b.close();
