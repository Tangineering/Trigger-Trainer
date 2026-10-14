// Headless state-machine test: simulated multi-touch (CDP) + synthetic DeviceMotionEvents.
// Proves the logic, not real sensors. Run: npm test
const { chromium } = require('playwright');
const path = require('path');

const W = 844, H = 390;                       // landscape phone viewport
const REST = [0.6 * W, 0.48 * H, 1];          // inside ZONES.rest (right-handed)
const TRG = [0.33 * W, 0.75 * H, 2];          // inside ZONES.trigger

let failures = 0;
const check = (name, cond, state) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) { failures++; console.log('      state:', JSON.stringify(state)); }
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.click('#startBtn');
  await page.waitForTimeout(150);

  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, radiusX: 25, radiusY: 25 })) });
  const motion = async (alpha, beta = alpha, n = 15) => {
    for (let i = 0; i < n; i++) {
      await page.evaluate(([a, b]) => window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
        rotationRate: { alpha: a, beta: b, gamma: 0 }, acceleration: { x: 0, y: 0, z: 0 }, interval: 16 })), [alpha, beta]);
      await page.waitForTimeout(16);
    }
  };
  const st = () => page.evaluate(() => window.__tdt());
  let s;

  s = await st(); check('starts unarmed', !s.armed, s);

  await touch('touchStart', [REST]); await motion(0, 0, 5);
  s = await st(); check('finger on frame arms and is safe', s.armed && s.onRest, s);

  await motion(80);
  s = await st(); check('moving with finger on frame: no alarm', !s.alarmActive, s);

  await motion(0, 0, 20); await touch('touchEnd', []); await motion(0, 0, 30);
  s = await st(); check('finger off, phone still: no alarm', !s.onRest && !s.alarmActive, s);

  await motion(80);
  s = await st(); check('finger off, phone moving: alarm', s.alarmActive && s.violations === 1, s);

  await motion(0, 0, 10);
  s = await st(); check('alarm latches after motion stops', s.alarmActive, s);

  await touch('touchStart', [REST]); await motion(0, 0, 8);
  s = await st(); check('finger back on frame clears alarm', s.onRest && !s.alarmActive, s);

  await touch('touchEnd', []); await motion(0, 0, 25);
  await touch('touchStart', [TRG]); await motion(0, 0, 5);
  s = await st(); check('trigger contact engages', s.trig && !s.trig.fired, s);

  await touch('touchMove', [[TRG[0] - 20, TRG[1], 2]]); await motion(0, 0, 3);
  s = await st(); check('partial pull does not fire', s.shots === 0, s);

  await touch('touchMove', [[TRG[0] - 45, TRG[1], 2]]); await motion(0, 0, 3);
  s = await st(); check('full pull while still fires a clean shot', s.shots === 1 && s.lastGrade === 'Clean', s);

  await touch('touchMove', [[TRG[0] - 10, TRG[1], 2]]); await motion(0, 0, 3);
  await motion(-15, 0, 6);                                   // muzzle dips ~1.4 deg during the press
  await touch('touchMove', [[TRG[0] - 50, TRG[1], 2]]); await page.waitForTimeout(50);
  s = await st(); check('trigger reset allows follow-up; drift graded as moved', s.shots === 2 && s.lastGrade === 'Moved', s);

  await touch('touchEnd', []); await motion(0, 0, 3);
  await touch('touchStart', [REST]); await motion(0, 0, 5);
  s = await st(); check('return to frame after shots is safe', s.onRest && !s.alarmActive && !s.trig, s);

  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log(failures ? `\n${failures} failed` : '\nall passed');
  process.exit(failures ? 1 : 0);
})();
