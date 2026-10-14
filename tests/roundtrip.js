// Records a session in the real page (headless Chromium, simulated touch + motion), saves it
// through the page's own Save path, then replays the file through engine.js in Node and
// requires the replayed events to equal the events the page produced live.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const TDT = require('../engine.js');

const W = 844, H = 390;
const { ZONES } = require('../engine.js');
const mid = z => [(z.x + z.w / 2) * W, (z.y + z.h / 2) * H];
const REST = [...mid(ZONES.rest), 1];         // centre of the frame strip (right-handed)
const TRG = [...mid(ZONES.trigger), 2];       // centre of the trigger zone

let failures = 0;
const check = (name, cond, extra) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) { failures++; if (extra !== undefined) console.log('      ', JSON.stringify(extra).slice(0, 400)); }
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.evaluate(() => { navigator.canShare = undefined; });   // force the download path

  // Start a recording from Settings, the way a user would.
  await page.click('#startSettingsBtn');
  await page.selectOption('#recLabel', 'off-frame-move');
  await page.fill('#recNotes', 'roundtrip test');
  await page.click('#recStart');
  await page.waitForTimeout(100);
  check('recording started and settings closed', await page.evaluate(() => window.__tdt().recording && !document.getElementById('settingsOv').classList.contains('show')));

  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, radiusX: 22, radiusY: 22 })) });
  // Alternate sign each sample: high rotation rate, little net turn (keeps clear of the 180 limit).
  const motion = async (alpha, beta = alpha, n = 15) => {
    for (let i = 0; i < n; i++) {
      const sg = i % 2 ? -1 : 1;
      await page.evaluate(([a, b]) => window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
        rotationRate: { alpha: a, beta: b, gamma: 0 }, acceleration: { x: 0, y: 0, z: 0 },
        accelerationIncludingGravity: { x: 0, y: 0, z: 9.81 }, interval: 16 })), [alpha * sg, beta * sg]);
      await page.waitForTimeout(16);
    }
  };

  await touch('touchStart', [REST]); await motion(0, 0, 10);
  await motion(70, 20, 15);                                  // move while safe
  await motion(0, 0, 20); await touch('touchEnd', []); await motion(0, 0, 25);
  await motion(80, -30, 15);                                 // move off-frame -> alarm
  await touch('touchStart', [REST]); await motion(0, 0, 10); // back -> ok
  await touch('touchEnd', []); await motion(0, 0, 25);
  await touch('touchStart', [TRG]); await motion(0, 0, 5);
  for (let dx = 5; dx <= 45; dx += 5) { await touch('touchMove', [[TRG[0] - dx, TRG[1], 2]]); await motion(0.5, 0, 1); }
  await touch('touchEnd', []); await motion(0, 0, 5);
  await touch('touchStart', [REST]); await motion(0, 0, 10);

  const live = await page.evaluate(() => window.__tdt());
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#recPill')]);
  const file = await download.path();
  const rec = JSON.parse(fs.readFileSync(file, 'utf8'));

  check('saved file is a tdt recording with the chosen label', rec.format === 'tdt-recording' && rec.label === 'off-frame-move' && rec.notes === 'roundtrip test');
  check('file name carries the label', /^tdt-off-frame-move-.*\.json$/.test(download.suggestedFilename()), download.suggestedFilename());
  check('log has motion, touch, pause and frame rows', ['m', 't', 'p', 'f'].every(k => rec.log.some(r => r[0] === k)));
  check('live run had an alarm and a shot', live.violations >= 1 && live.shots >= 1, live);

  const res = TDT.replay(rec);
  const a = JSON.stringify(rec.observed), b = JSON.stringify(res.packed);
  check(`replay reproduces the live events exactly (${rec.observed.length} events)`, a === b, { live: rec.observed, replay: res.packed });
  check('recording stopped after save', !(await page.evaluate(() => window.__tdt().recording)));
  check('no page errors', errors.length === 0, errors);

  await browser.close();
  console.log(failures ? `\n${failures} failed` : '\nall passed');
  process.exit(failures ? 1 : 0);
})();
