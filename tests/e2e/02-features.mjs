const { chromium } = await import(process.env.PW_PATH || 'playwright');
const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
p.on('console', m => { if (m.type()==='error' && !/favicon|net::/.test(m.text())) errs.push('CONSOLE: '+m.text()); });
const ok = (name, v) => console.log((v ? '✓' : '✗ FAIL'), name);
p.on('dialog', d => d.accept('Renamed Project'));

await p.goto('http://localhost:8899/#/signin'); await p.waitForTimeout(400);
await p.locator('.auth-form label:nth-child(1) input').fill('Hemanth');
await p.locator('.auth-form label:nth-child(2) input').fill('h@v.ai');
await p.click('.auth-form button[type=submit]'); await p.waitForTimeout(400);

// run one research to have data
await p.goto('http://localhost:8899/#/app/research'); await p.waitForTimeout(300);
await p.fill('.ask-input', 'What is CRISPR and how does it work?');
await p.keyboard.press('Enter'); await p.waitForTimeout(3300);
ok('report saved', await p.evaluate(() => location.hash.startsWith('#/app/report/')));

// follow-up ask
await p.click('.rep-actions .v-iconbtn[title="More"]'); await p.waitForTimeout(250);
await p.click('.v-pop-item:has-text("Ask a follow-up")'); await p.waitForTimeout(300);
await p.fill('.ask-sendrow input', 'When was it first used?');
await p.keyboard.press('Enter'); await p.waitForTimeout(800);
ok('followup answered', await p.evaluate(() => document.querySelectorAll('.ask-msg.ai:not(.err)').length >= 1));
await p.keyboard.press('Escape'); await p.waitForTimeout(250);

// share copy
await p.click('.rep-actions .v-btn.primary.sm:has-text("Share")'); await p.waitForTimeout(300);
await p.click('.v-modal-foot .v-btn.primary'); await p.waitForTimeout(300);
ok('share copied toast', await p.evaluate(() => [...document.querySelectorAll('.v-toast')].some(t => /copied/i.test(t.textContent))));
await p.keyboard.press('Escape'); await p.waitForTimeout(200);

// add to project (creates new via prompt)
await p.click('.rep-actions .v-btn.ghost.sm:first-child'); await p.waitForTimeout(250);
await p.click('.v-pop-item:has-text("New project")'); await p.waitForTimeout(400);
ok('added to project', await p.evaluate(() => [...document.querySelectorAll('.rep-actions button')].some(x => /Renamed Project/.test(x.textContent))));

// projects page
await p.goto('http://localhost:8899/#/app/projects'); await p.waitForTimeout(350);
ok('project card shows', await p.evaluate(() => document.querySelectorAll('.proj-card').length === 1 && /1 report/.test(document.querySelector('.proj-card').textContent)));
await p.screenshot({ path: '/tmp/v-projects.png' });
// new project modal
await p.click('.page-head .v-btn.primary'); await p.waitForTimeout(250);
await p.fill('.v-modal input', 'EV Market Research');
await p.click('.v-modal-foot .v-btn.primary'); await p.waitForTimeout(300);
ok('second project created', await p.evaluate(() => document.querySelectorAll('.proj-card').length === 2));
// project detail
await p.click('.proj-card:has-text("Renamed Project")'); await p.waitForTimeout(350);
ok('project detail lists report', await p.evaluate(() => document.querySelectorAll('.list-row').length === 1));

// KB upload (txt + csv), search, preview, delete
await p.goto('http://localhost:8899/#/app/kb'); await p.waitForTimeout(300);
await p.setInputFiles('input[type=file]', [
  { name: 'india_ai_notes.md', mimeType: 'text/markdown', buffer: Buffer.from('# India AI notes\nGenerative AI adoption in Indian IT services is accelerating. NASSCOM projects workforce shifts.') },
  { name: 'ev_sales.csv', mimeType: 'text/csv', buffer: Buffer.from('year,sales\n2024,91000\n2025,152000') },
]); await p.waitForTimeout(600);
ok('kb two files', await p.evaluate(() => document.querySelectorAll('.kb-row').length === 2));
await p.screenshot({ path: '/tmp/v-kb.png' });
await p.fill('#page-search', 'NASSCOM'); await p.waitForTimeout(500);
ok('kb content search', await p.evaluate(() => document.querySelectorAll('.kb-row').length === 1 && /india_ai/.test(document.querySelector('.kb-row').textContent)));
await p.fill('#page-search', ''); await p.waitForTimeout(400);
await p.click('.kb-chip:has-text("Datasets")'); await p.waitForTimeout(300);
ok('kb filter datasets', await p.evaluate(() => document.querySelectorAll('.kb-row').length === 1 && /ev_sales/.test(document.querySelector('.kb-row').textContent)));
await p.click('.kb-chip:has-text("All")'); await p.waitForTimeout(250);
await p.click('.kb-row:has-text("ev_sales") .v-iconbtn'); await p.waitForTimeout(200);
await p.click('.v-pop-item:has-text("Preview")'); await p.waitForTimeout(350);
ok('kb preview shows csv', await p.evaluate(() => /2024,91000/.test(document.querySelector('.kb-preview-text')?.textContent || '')));
await p.keyboard.press('Escape'); await p.waitForTimeout(200);

// research with KB context (Files picker)
await p.goto('http://localhost:8899/#/app/research'); await p.waitForTimeout(300);
await p.click('.ask-row-left .pill-btn:nth-of-type(2)'); await p.waitForTimeout(250);
await p.click('.v-pop-item:has-text("india_ai_notes")'); await p.waitForTimeout(200);
ok('file picked for context', await p.evaluate(() => /Files \(1\)/.test(document.querySelector('.ask-row-left').textContent)));

// analytics with data
await p.goto('http://localhost:8899/#/app/analytics'); await p.waitForTimeout(400);
ok('analytics stats', await p.evaluate(() => document.querySelectorAll('.stat-big').length === 4 && /1/.test(document.querySelector('.stat-big strong').textContent)));
ok('activity chart', await p.evaluate(() => !!document.querySelector('.v-chart .line')));
await p.click('.page-head .pill-btn'); await p.waitForTimeout(200);
await p.click('.v-pop-item:has-text("Last 7 days")'); await p.waitForTimeout(350);
ok('range switch', await p.evaluate(() => /Last 7 Days/.test(document.querySelector('.page-head .pill-btn').textContent)));
await p.screenshot({ path: '/tmp/v-analytics.png' });

// notifications
await p.click('.bell'); await p.waitForTimeout(250);
ok('notification listed', await p.evaluate(() => document.querySelectorAll('.notif-item').length >= 1));
await p.click('.notif-item'); await p.waitForTimeout(350);
ok('notif → report', await p.evaluate(() => location.hash.startsWith('#/app/report/')));

// workspace create + switch
await p.click('.ws-btn'); await p.waitForTimeout(200);
await p.click('.v-pop-item:has-text("New workspace")'); await p.waitForTimeout(250);
await p.fill('.v-modal input', 'Client Research');
await p.click('.v-modal-foot .v-btn.primary'); await p.waitForTimeout(400);
ok('workspace switched', await p.evaluate(() => /Client Research/.test(document.querySelector('.ws-btn').textContent)));
ok('new ws is empty', await p.evaluate(() => document.querySelectorAll('.list-row').length === 0));
await p.click('.ws-btn'); await p.waitForTimeout(200);
await p.click('.v-pop-item:has-text("Personal Workspace")'); await p.waitForTimeout(350);

// settings
await p.goto('http://localhost:8899/#/app/settings'); await p.waitForTimeout(300);
ok('settings workspaces listed', await p.evaluate(() => document.querySelectorAll('.list-row').length === 2));
await p.screenshot({ path: '/tmp/v-settings.png' });

// keyboard shortcut N
await p.keyboard.press('n'); await p.waitForTimeout(300);
ok('shortcut N → research', await p.evaluate(() => location.hash === '#/app/research'));

// sign out
await p.click('.avatar'); await p.waitForTimeout(200);
await p.click('.v-pop-item:has-text("Sign out")'); await p.waitForTimeout(350);
ok('signed out to landing', await p.evaluate(() => (location.hash === '#/' ) && !!document.querySelector('.hero')));

console.log('ERRORS:', errs.length ? errs.join(' | ') : 'none');
await b.close();
