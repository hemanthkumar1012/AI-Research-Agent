const { chromium } = await import(process.env.PW_PATH || 'playwright');
const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:8899/'); await p.waitForTimeout(700);
console.log('reduced: reveals visible immediately:', await p.evaluate(() => [...document.querySelectorAll('.fx-reveal')].every(e => e.classList.contains('in'))));
console.log('reduced: no particle canvas:', await p.evaluate(() => !document.querySelector('.fx-particles canvas')));
console.log('ERRORS:', errs.length ? errs.join('|') : 'none');
await b.close();
