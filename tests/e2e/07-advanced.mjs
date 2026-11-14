const { chromium } = await import(process.env.PW_PATH || 'playwright');
const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
const ok = (n, v) => console.log((v ? '✓' : '✗ FAIL'), n);

await p.goto('http://localhost:8899/#/signin'); await p.waitForTimeout(400);
await p.locator('.auth-form label:nth-child(1) input').fill('H');
await p.locator('.auth-form label:nth-child(2) input').fill('h@v.ai');
await p.click('.auth-form button[type=submit]'); await p.waitForTimeout(400);

// command palette
await p.keyboard.press('Control+k'); await p.waitForTimeout(300);
ok('palette opens (Ctrl+K)', await p.evaluate(() => !!document.querySelector('.pal-card')));
await p.keyboard.type('analyt'); await p.waitForTimeout(250);
await p.keyboard.press('Enter'); await p.waitForTimeout(400);
ok('palette fuzzy-navigates', await p.evaluate(() => location.hash === '#/app/analytics'));
await p.keyboard.press('Control+k'); await p.waitForTimeout(250);
await p.keyboard.press('Escape'); await p.waitForTimeout(250);
ok('palette escape closes', await p.evaluate(() => !document.querySelector('.pal-card')));

// KB drag & drop
await p.goto('http://localhost:8899/#/app/kb'); await p.waitForTimeout(300);
ok('dropzone visible', await p.evaluate(() => !!document.querySelector('.kb-dropzone')));
await p.evaluate(() => {
  const dt = new DataTransfer();
  dt.items.add(new File(['x,y\n1,2'], 'dropped.csv', { type: 'text/csv' }));
  document.querySelector('.kb-page').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
});
await p.waitForTimeout(600);
ok('drop ingests file', await p.evaluate(() => /dropped\.csv/.test(document.body.textContent)));

// templates + research run 1
await p.goto('http://localhost:8899/#/app/research'); await p.waitForTimeout(300);
await p.click('.ask-row-left .pill-btn:nth-of-type(2)'); await p.waitForTimeout(250);
await p.click('.v-pop-item:has-text("Technology deep-dive")'); await p.waitForTimeout(200);
ok('template inserts', await p.evaluate(() => document.querySelector('.ask-input').value.includes('technology')));
await p.fill('.ask-input', 'What is CRISPR and how does it work?');
await p.keyboard.press('Enter'); await p.waitForTimeout(2500);
ok('report 1', await p.evaluate(() => !!document.querySelector('.rep-title')));
const rep1 = await p.evaluate(() => location.hash);

// meta bar + TOC + scrollspy target
ok('read-time chips', await p.evaluate(() => /min read/.test(document.querySelector('.rep-meta-bar')?.textContent || '')));
ok('TOC links', await p.evaluate(() => document.querySelectorAll('.toc-link').length >= 2));

// star it
await p.click('.star-btn'); await p.waitForTimeout(300);
ok('star toggles', await p.evaluate(() => document.querySelector('.star-btn').getAttribute('aria-pressed') === 'true'));

// ask dock: send + persist
await p.click('.ask-dock-head'); await p.waitForTimeout(350);
await p.fill('.ask-dock input', 'Why does this matter?'); await p.keyboard.press('Enter'); await p.waitForTimeout(1500);
ok('dock answered', await p.evaluate(() => document.querySelectorAll('.ask-dock .ask-msg.ai:not(.err)').length >= 1));
await p.reload(); await p.waitForTimeout(1000);
ok('dock thread persists', await p.evaluate(() => document.querySelectorAll('.ask-dock .ask-msg').length >= 2));

// source map filters incl. empty state
await p.click('.rep-tab:has-text("Sources")'); await p.waitForTimeout(600);
await p.click('.cred-chip.medium'); await p.waitForTimeout(400);
ok('filter off → empty-state or canvas', await p.evaluate(() =>
  document.querySelector('.cred-chip.medium').getAttribute('aria-pressed') === 'false' &&
  (!!document.querySelector('.smap-none') || !!document.querySelector('.smap canvas'))));
await p.click('.cred-chip.medium'); await p.waitForTimeout(400);
ok('filter on → map returns', await p.evaluate(() => !!document.querySelector('.smap canvas')));

// run 2 then compare
await p.goto('http://localhost:8899/#/app/research'); await p.waitForTimeout(250);
await p.fill('.ask-input', 'How large is the rooftop solar market?');
await p.keyboard.press('Enter'); await p.waitForTimeout(2500);
ok('report 2', await p.evaluate(() => !!document.querySelector('.rep-title')));
await p.click('.rep-actions .v-iconbtn[title="More"]'); await p.waitForTimeout(250);
await p.click('.v-pop-item:has-text("Compare with")'); await p.waitForTimeout(300);
await p.click('.v-pop-item:has-text("What is CRISPR")'); await p.waitForTimeout(600);
ok('compare view renders', await p.evaluate(() =>
  location.hash.startsWith('#/app/compare/') && document.querySelectorAll('.cmp-col').length === 2));
ok('compare highlights shared domains', await p.evaluate(() =>
  document.querySelectorAll('.rep-meta-chip.shared').length >= 1 || /different sources/.test(document.body.textContent)));

// starred filter on reports page
await p.goto('http://localhost:8899/#/app/reports'); await p.waitForTimeout(350);
await p.click('.kb-chip:has-text("Starred")'); await p.waitForTimeout(300);
ok('starred filter shows 1', await p.evaluate(() => document.querySelectorAll('.list-row').length === 1));

// analytics heatmap
await p.goto('http://localhost:8899/#/app/analytics'); await p.waitForTimeout(500);
ok('heatmap renders with activity', await p.evaluate(() =>
  document.querySelectorAll('.heat-cell').length > 60 &&
  document.querySelectorAll('.heat-cell.l1,.heat-cell.l2,.heat-cell.l3,.heat-cell.l4').length >= 1));

console.log('ERRORS:', errs.length ? errs.join(' | ') : 'none');
await b.close();
if (errs.length) process.exit(1);
