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
  await page.click('#downrangeBtn'); await motion(0, 0, 3);    // Set downrange mid-recording
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
  check('log has motion, touch, pause, frame and downrange rows', ['m', 't', 'p', 'f', 'd'].every(k => rec.log.some(r => r[0] === k)));
  check('live run recorded the downrange event', rec.observed.some(o => o[1] === 'downrange'));
  check('live run had an alarm and a shot', live.violations >= 1 && live.shots >= 1, live);

  const res = TDT.replay(rec);
  const a = JSON.stringify(rec.observed), b = JSON.stringify(res.packed);
  check(`replay reproduces the live events exactly (${rec.observed.length} events)`, a === b, { live: rec.observed, replay: res.packed });
  check('recording stopped after save', !(await page.evaluate(() => window.__tdt().recording)));
  check('the page says where the file went', /Downloaded .*Downloads/.test(await page.textContent('#warnLine')));

  // Android Chrome: canShare refuses .json but accepts text/plain → share sheet gets a .txt copy.
  await page.evaluate(() => {
    window.__shared = null;
    navigator.canShare = d => d.files.every(f => f.type === 'text/plain');
    navigator.share = d => { window.__shared = { name: d.files[0].name, type: d.files[0].type }; return Promise.resolve(); };
  });
  await page.click('#gear'); await page.click('#recSave'); await page.waitForTimeout(50);
  const shared = await page.evaluate(() => window.__shared);
  check('Save last recording shares a .txt copy when .json is refused', shared && /^tdt-off-frame-move-.*\.txt$/.test(shared.name), shared);
  check('Settings confirms the share', /Shared tdt-/.test(await page.textContent('#recInfo')));
  // A share that fails (not cancelled) falls back to a download instead of failing silently.
  await page.evaluate(() => { navigator.share = () => Promise.reject(new DOMException('no', 'NotAllowedError')); });
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#recSave')]);
  check('failed share falls back to a download', /\.json$/.test(dl2.suggestedFilename()), dl2.suggestedFilename());
  await page.evaluate(() => { navigator.share = () => Promise.reject(new DOMException('x', 'AbortError')); });
  await page.click('#recSave'); await page.waitForTimeout(50);
  check('cancelled share says it was not saved', /Not saved/.test(await page.textContent('#recInfo')));
  // Download button: always a plain download, even where sharing works.
  await page.evaluate(() => { window.__shared = null; navigator.canShare = () => true; });
  const [dl3] = await Promise.all([page.waitForEvent('download'), page.click('#recDownload')]);
  const rec3 = JSON.parse(fs.readFileSync(await dl3.path(), 'utf8'));
  check('Download last recording downloads the .json without sharing',
    /\.json$/.test(dl3.suggestedFilename()) && rec3.format === 'tdt-recording' && !(await page.evaluate(() => window.__shared)));
  check('no page errors', errors.length === 0, errors);

  await browser.close();
  console.log(failures ? `\n${failures} failed` : '\nall passed');
  process.exit(failures ? 1 : 0);
})();
