const { chromium } = await import(process.env.PW_PATH || 'playwright');
const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
const ok = (n, v) => console.log((v ? '✓' : '✗ FAIL'), n);

await p.goto('http://localhost:8899/'); await p.waitForTimeout(900);
ok('3D core renders', await p.evaluate(() => !!document.querySelector('.core-cube') && document.querySelectorAll('.core-face').length === 6));
ok('rings + sats', await p.evaluate(() => document.querySelectorAll('.core-ring').length === 3 && document.querySelectorAll('.core-sat').length === 3));
ok('particle canvas', await p.evaluate(() => !!document.querySelector('.fx-particles canvas')));
await p.mouse.move(400, 300); await p.waitForTimeout(300);
ok('mouse tilt applied', await p.evaluate(() => document.querySelector('.core-scene').style.getPropertyValue('--tiltY') !== ''));
await p.evaluate(() => document.getElementById('how').scrollIntoView()); await p.waitForTimeout(700);
ok('scroll reveals fire', await p.evaluate(() => document.querySelectorAll('.fx-reveal.in').length >= 4));
await p.screenshot({ path: '/tmp/n-landing.png' });

// sign in + run research for source map
await p.goto('http://localhost:8899/#/signin'); await p.waitForTimeout(300);
await p.locator('.auth-form label:nth-child(1) input').fill('Hemanth');
await p.locator('.auth-form label:nth-child(2) input').fill('h@v.ai');
await p.click('.auth-form button[type=submit]'); await p.waitForTimeout(400);
await p.goto('http://localhost:8899/#/app/research'); await p.waitForTimeout(250);
await p.fill('.ask-input', 'What is CRISPR and how does it work?');
await p.keyboard.press('Enter'); await p.waitForTimeout(800);
await p.screenshot({ path: '/tmp/n-progress.png' });
ok('progress meters or instant report', await p.evaluate(() => (!!document.getElementById('prog-clock') && !!document.getElementById('prog-src')) || location.hash.startsWith('#/app/report/')));
await p.waitForTimeout(2800);
ok('report after run', await p.evaluate(() => !!document.querySelector('.rep-title')));
await p.screenshot({ path: '/tmp/n-report.png' });

await p.click('.rep-tab:has-text("Sources")'); await p.waitForTimeout(600);
ok('source map canvas', await p.evaluate(() => !!document.querySelector('.smap canvas')));
// hover center-right where a node likely is; use keyboard instead for determinism
await p.focus('.smap canvas');
await p.keyboard.press('ArrowRight'); await p.waitForTimeout(200);
await p.keyboard.press('Enter'); await p.waitForTimeout(500);
ok('node select scrolls+flashes', await p.evaluate(() => !!document.querySelector('.src-flash') || Math.abs(document.getElementById('src-1').getBoundingClientRect().top) < innerHeight));
await p.screenshot({ path: '/tmp/n-sourcemap.png' });
await p.click('#smap-b2'); await p.waitForTimeout(250);
ok('toggle to list hides map', await p.evaluate(() => document.querySelector('.smap').style.display === 'none'));
await p.click('#smap-b1'); await p.waitForTimeout(250);
ok('toggle back to map', await p.evaluate(() => document.querySelector('.smap').style.display === ''));

console.log('ERRORS:', errs.length ? errs.join(' | ') : 'none');
await b.close();
