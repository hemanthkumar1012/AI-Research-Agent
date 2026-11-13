const { chromium } = await import(process.env.PW_PATH || 'playwright');
const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
p.on('console', m => { if (m.type()==='error' && !/favicon|net::/.test(m.text())) errs.push('CONSOLE: '+m.text()); });
const ok = (name, v) => console.log((v ? '✓' : '✗ FAIL'), name);

await p.goto('http://localhost:8899/'); await p.waitForTimeout(600);
ok('landing renders', await p.evaluate(() => !!document.querySelector('.hero h1')));
await p.screenshot({ path: '/tmp/v-landing.png', fullPage: false });

// landing nav scroll + CTA
await p.click('.land-nav-link:nth-child(3)'); // Pricing (smooth scroll)
let priceVis = false;
for (let i = 0; i < 12 && !priceVis; i++) { await p.waitForTimeout(250);
  priceVis = await p.evaluate(() => Math.abs(document.getElementById('pricing').getBoundingClientRect().top) < 420); }
ok('pricing visible', priceVis);
await p.click('.land-cta .v-btn.primary'); await p.waitForTimeout(400);
ok('signin page', await p.evaluate(() => !!document.querySelector('.auth-card')));

// validation: empty name
await p.click('.auth-form button[type=submit]'); await p.waitForTimeout(300);
ok('signin validation toast', await p.evaluate(() => !!document.querySelector('.v-toast.error')));
await p.fill('.auth-form input:nth-of-type(1)', '');
await p.locator('.auth-form label:nth-child(1) input').fill('Hemanth Kumar');
await p.locator('.auth-form label:nth-child(2) input').fill('hemanth@verity.ai');
await p.locator('.auth-form label:nth-child(3) input').fill('Personal Workspace');
await p.click('.auth-form button[type=submit]'); await p.waitForTimeout(600);
ok('app home after signin', await p.evaluate(() => location.hash === '#/app' && !!document.querySelector('.side')));
await p.screenshot({ path: '/tmp/v-home-empty.png' });

// sidebar nav through all pages
for (const [sel, hash] of [['Projects','#/app/projects'],['Reports','#/app/reports'],['Knowledge Base','#/app/kb'],['Analytics','#/app/analytics'],['Settings','#/app/settings']]) {
  await p.click(`.side-link:has-text("${sel}")`); await p.waitForTimeout(350);
  ok('nav ' + sel, await p.evaluate(h => location.hash === h, hash));
}

// collapse sidebar
await p.click('.side-collapse'); await p.waitForTimeout(350);
ok('sidebar collapsed', await p.evaluate(() => document.querySelector('.app').classList.contains('side-min')));
await p.click('.side-collapse'); await p.waitForTimeout(300);

// research flow
await p.click('.side-new'); await p.waitForTimeout(400);
ok('research page', await p.evaluate(() => !!document.querySelector('.ask-card')));
await p.screenshot({ path: '/tmp/v-research.png' });
await p.click('.ask-sugs .sug:nth-child(1)'); // fills textarea
await p.click('.send-btn'); await p.waitForTimeout(500);
ok('progress or instant report', await p.evaluate(() => !!document.querySelector('.prog-steps') || location.hash.startsWith('#/app/report/')));
await p.screenshot({ path: '/tmp/v-progress.png' });
await p.waitForTimeout(2800); // mock stream completes
ok('report page', await p.evaluate(() => location.hash.startsWith('#/app/report/') && !!document.querySelector('.rep-title')));
await p.screenshot({ path: '/tmp/v-report.png' });

// tabs
for (const t of ['Key Findings','Analysis','Sources','Overview']) {
  await p.click(`.rep-tab:has-text("${t}")`); await p.waitForTimeout(300);
}
ok('findings tab content', await (async()=>{ await p.click('.rep-tab:has-text("Key Findings")'); await p.waitForTimeout(250); return p.evaluate(()=>document.querySelectorAll('.find-card').length >= 1); })());
await p.click('.rep-tab:has-text("Sources")'); await p.waitForTimeout(250);
ok('sources tab', await p.evaluate(() => document.querySelectorAll('.src-card').length >= 1));
await p.screenshot({ path: '/tmp/v-sources.png' });

// export modal
await p.click('.rep-actions .v-btn.ghost.sm:has-text("Export")'); await p.waitForTimeout(350);
ok('export modal', await p.evaluate(() => !!document.querySelector('.exp-grid')));
await p.click('.exp-card:has-text("Markdown")');
const dl = p.waitForEvent('download', { timeout: 5000 }).catch(() => null);
await p.click('.v-modal-foot .v-btn.primary'); 
ok('md download fired', !!(await dl));
await p.waitForTimeout(400);
await p.screenshot({ path: '/tmp/v-after-export.png' });
console.log('ERRORS:', errs.length ? errs.join(' | ') : 'none');
await b.close();
