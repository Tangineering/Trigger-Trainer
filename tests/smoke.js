// Headless state-machine test: simulated multi-touch (CDP) + synthetic DeviceMotionEvents.
// Proves the logic, not real sensors. Run: npm test
const { chromium } = require('playwright');
const path = require('path');

const W = 844, H = 390;                       // landscape phone viewport
const { ZONES } = require('../engine.js');
const mid = z => [(z.x + z.w / 2) * W, (z.y + z.h / 2) * H];
const REST = [...mid(ZONES.rest), 1];         // centre of the frame strip (right-handed)
const TRG = [...mid(ZONES.trigger), 2];       // centre of the trigger zone

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
  let s0; const st = () => page.evaluate(() => window.__tdt());
  // Start screen: loud-sound warning and hold-to-test button.
  check('start screen warns about loud sounds', /loud/i.test(await page.textContent('.loud')));
  const tb = await page.$('#testSoundStart'); await tb.scrollIntoViewIfNeeded(); const bb = await tb.boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down(); await page.waitForTimeout(100);
  s0 = await st(); check('holding Test sound plays the alarm', s0.alarmSound === 'move', s0);
  // Volume on the start screen: same control as Settings, same stored value.
  await page.$eval('#s_slidersStart_volume', el => { el.value = '0.35'; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); });
  check('start-screen volume slider sets the app volume',
    await page.evaluate(() => JSON.parse(localStorage.getItem('tdt.settings.v1')).volume) === 0.35);
  check('settings volume slider shows the same value',
    await page.$eval('#s_sliders4_volume', el => +el.value) === 0.35);
  await page.mouse.up(); await page.waitForTimeout(50);
  s0 = await st(); check('releasing Test sound stops it', s0.alarmSound === null && !s0.running, s0);

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
  // Shake back and forth: high rotation rate, little net change in where the muzzle points.
  const wobble = async (rate, n = 15) => {
    for (let i = 0; i < n; i++) {
      const r = i % 2 ? rate : -rate;
      await page.evaluate(r => window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
        rotationRate: { alpha: r, beta: r, gamma: 0 }, acceleration: { x: 0, y: 0, z: 0 }, interval: 16 })), r);
      await page.waitForTimeout(16);
    }
  };
  let s;

  s = await st(); check('starts unarmed', !s.armed, s);

  await touch('touchStart', [REST]); await motion(0, 0, 5);
  s = await st(); check('finger on frame arms and is safe', s.armed && s.onRest, s);

  await wobble(80);
  s = await st(); check('moving with finger on frame: no alarm', !s.alarmActive, s);

  await motion(0, 0, 20); await touch('touchEnd', []); await motion(0, 0, 30);
  s = await st(); check('finger off, phone still: no alarm', !s.onRest && !s.alarmActive, s);

  await wobble(80);
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

  let v = s.violations;
  await motion(150, 60, 6);                                  // short hard jerk right after the break
  s = await st(); check('short hard jerk during the press: no alarm', !s.alarmActive && s.violations === v, s);

  await motion(0, 0, 40);                                    // press window closes 0.5 s after the break
  await wobble(80);                                          // finger still resting on the trigger, phone swings
  s = await st(); check('moving with the finger resting on the trigger: alarm', s.alarmActive && s.violations === v + 1, s);

  await touch('touchEnd', []); await touch('touchStart', [REST]); await motion(0, 0, 8);
  s = await st(); check('back on the frame clears it', s.onRest && !s.alarmActive, s);

  v = s.violations;
  await touch('touchEnd', []); await motion(0, 0, 25);
  await touch('touchStart', [TRG]); await motion(0, 0, 3);
  await touch('touchMove', [[TRG[0] - 20, TRG[1], 2]]); await motion(0, 0, 2);   // press started, not broken
  await wobble(60, 12);
  s = await st(); check('brief movement during a press: no alarm', !s.alarmActive, s);
  await wobble(60, 60);
  s = await st(); check('movement sustained during a press: alarm', s.alarmActive && s.violations === v + 1, s);

  await touch('touchEnd', []); await motion(0, 0, 3);
  await touch('touchStart', [REST]); await motion(0, 0, 5);
  s = await st(); check('return to frame after shots is safe', s.onRest && !s.alarmActive && !s.trig, s);

  // 180 rule: finger stays on the frame; swing the muzzle (yaw) until past the limit, then back.
  const swingUntil = async (beta, cond, max = 200) => {
    for (let i = 0; i < max; i++) {
      await page.evaluate(b => window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
        rotationRate: { alpha: 0, beta: b, gamma: 0 }, acceleration: { x: 0, y: 0, z: 0 }, interval: 16 })), beta);
      await page.waitForTimeout(16);
      if (cond(await st())) return true;
    }
    return false;
  };
  s = await st(); check('180 check starts off (downrange not set)', !s.refSet, s);
  const h0 = s.aimH;
  await swingUntil(-120, x => Math.abs(x.aimH - h0) > 110);
  s = await st(); check('before Set downrange, swinging past 90°: no 180 alarm', !s.alarmActive && s.breaks180 === 0, s);
  await swingUntil(120, x => Math.abs(x.aimH - h0) < 5);
  await page.click('#downrangeBtn'); await motion(0, 0, 3);
  s = await st(); check('Set downrange turns the 180 check on', s.refSet && s.dev180 < 2, s);
  check('the button now reads Reset downrange', (await page.textContent('#downrangeBtn')) === 'Reset downrange');

  await swingUntil(-120, x => x.dev180 > 65);
  s = await st(); check('swing to ~65° with finger on the frame: no alarm', !s.alarmActive && s.onRest, s);
  await swingUntil(-120, x => x.dev180 > 95);
  s = await st(); check('swing past 90° with finger on the frame: 180 alarm', s.alarmActive && s.alarmReason === '180' && s.breaks180 === 1, s);
  await swingUntil(120, x => x.dev180 < 30);
  await motion(0, 0, 5);
  s = await st(); check('back downrange with finger on the frame: 180 alarm clears', !s.alarmActive && s.onRest, s);

  // Finish (Settings) → session summary; New session clears it and returns to the start screen.
  const shotsSoFar = (await st()).shots;
  await page.click('#gear'); await page.click('#finishBtn'); await page.waitForTimeout(50);
  s = await st(); check('Finish opens the session summary with the session totals',
    s.summaryOpen && s.summary.shots === shotsSoFar && s.summary.breaks180 === 1 && s.summary.moveAlarms === s.violations, s);
  check('summary lists the shot count', (await page.textContent('#sumRows')).includes('Shots' + shotsSoFar));
  await motion(200, 200, 10);
  s = await st(); check('trainer is paused while the summary is open', !s.alarmActive && s.summaryOpen, s);
  await page.click('#sumNew'); await page.waitForTimeout(50);
  s = await st(); check('New session resets the stats and shows the start screen',
    !s.summaryOpen && !s.running && s.summary.shots === 0 && s.violations === 0 &&
    await page.evaluate(() => document.getElementById('startOv').classList.contains('show')), s);

  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log(failures ? `\n${failures} failed` : '\nall passed');
  process.exit(failures ? 1 : 0);
})();
