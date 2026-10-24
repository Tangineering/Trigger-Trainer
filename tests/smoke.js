// Headless state-machine test: simulated multi-touch (CDP) + synthetic DeviceMotionEvents.
// Proves the logic, not real sensors. Run: npm test
const { chromium } = require('playwright');
const path = require('path');

const W = 844, H = 390;                       // landscape phone viewport
const { ZONES, zoneFor } = require('../engine.js');
const mid = z => [(z.x + z.w / 2) * W, (z.y + z.h / 2) * H];
const REST = [...mid(ZONES.rest), 1];         // centre of the frame strip (right-handed)
const TRG = [...mid(zoneFor('trigger', W)), 2];   // centre of the drawn trigger zone (px offset, D-72)

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
  // Off-frame drift limit (D-56); localStorage is cleared above, so the page runs on DEFAULTS.
  const LIM = await page.evaluate(() => window.TDT.DEFAULTS.offFrameDeg);
  // Start screen: loud-sound warning and hold-to-test button.
  check('start screen warns about loud sounds', /loud/i.test(await page.textContent('.loud')));
  const tb = await page.$('#testSoundStart'); await tb.scrollIntoViewIfNeeded(); const bb = await tb.boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down(); await page.waitForTimeout(100);
  s0 = await st(); check('holding Test sound plays the alarm', s0.alarmSound === 'move', s0);
  // Volume on the start screen: same control as Settings, same stored value.
  await page.$eval('#s_slidersStart_volume', el => { el.value = '0.35'; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); });
  check('start-screen volume slider sets the app volume',
    await page.evaluate(() => localStorage.getItem('tdt.settings.v2')) === JSON.stringify({ volume: 0.35 }));
  check('settings volume slider shows the same value',
    await page.$eval('#s_sliders4_volume', el => +el.value) === 0.35);
  check('180 limit slider goes down to 30° (D-84)',
    await page.$eval('#s_sliders180_limit180Deg', el => el.min) === '30');
  await page.mouse.up(); await page.waitForTimeout(50);
  s0 = await st(); check('releasing Test sound stops it', s0.alarmSound === null && !s0.running, s0);

  // Settings persistence (D-64): only changed settings are stored, under tdt.settings.v2.
  const stored = () => page.evaluate(() => localStorage.getItem('tdt.settings.v2'));
  const setVol = v => page.$eval('#s_slidersStart_volume', (el, v) => { el.value = v; el.dispatchEvent(new Event('input')); }, v);
  await page.reload();
  check('reload keeps the changed volume', await page.$eval('#s_slidersStart_volume', el => +el.value) === 0.35);
  const defVol = String(require('../engine.js').DEFAULTS.volume);
  await setVol(defVol);
  check('volume back to its default removes the stored key', await stored() === null);
  await page.evaluate(() => { localStorage.removeItem('tdt.settings.v2');
    localStorage.setItem('tdt.settings.v1', JSON.stringify({ jerkMs: 500, volume: 0.35, requireFlat: true })); });
  await page.reload();
  check('v1 save migrates to the changed settings only',
    await stored() === JSON.stringify({ volume: 0.35 }) && await page.evaluate(() => localStorage.getItem('tdt.settings.v1')) === null);
  await page.$eval('#resetDefaults', el => el.click());
  check('Restore defaults removes the stored key', await stored() === null);
  await page.reload();
  check('after Restore defaults a reload keeps the default volume', await page.$eval('#s_slidersStart_volume', el => el.value) === defVol);
  await setVol('0.35');                       // leave the page as before these checks

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

  await touch('touchMove', [[TRG[0] - 70, TRG[1], 2]]); await motion(0, 0, 3);
  s = await st(); check('full pull while still fires a clean shot', s.shots === 1 && s.lastGrade === 'Clean', s);

  await touch('touchMove', [[TRG[0] - 10, TRG[1], 2]]); await motion(0, 0, 3);
  await motion(-15, 0, 6);                                   // muzzle dips ~1.4 deg during the press
  await touch('touchMove', [[TRG[0] - 75, TRG[1], 2]]); await page.waitForTimeout(50);
  s = await st(); check('trigger reset allows follow-up; drift graded as moved', s.shots === 2 && s.lastGrade === 'Moved', s);

  let v = s.violations;
  // Short hard jerk right after the break that recoils: fast, but the muzzle stays within
  // offFrameDeg of where it pointed when the finger left the frame (D-34 allowance, D-56 limit).
  await motion(60, 0, 3); await motion(-60, 0, 3);
  s = await st(); check('short hard jerk during the press: no alarm', !s.alarmActive && s.violations === v && s.devOff < LIM, s);

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
  // D-45 (WQ-007): finish the pull while the alarm sounds. The shot counts but is not graded in the summary.
  await touch('touchMove', [[TRG[0] - 70, TRG[1], 2]]); await motion(0, 0, 3);
  s = await st(); check('full pull during an alarm fires a third shot, marked as fired during an alarm',
    s.shots === 3 && s.summary.unsafeShots === 1 && s.summary.graded === 2, s);

  await touch('touchEnd', []); await motion(0, 0, 3);
  await touch('touchStart', [REST]); await motion(0, 0, 5);
  s = await st(); check('return to frame after shots is safe', s.onRest && !s.alarmActive && !s.trig, s);

  // 180 rule: finger stays on the frame; swing the muzzle (yaw) until past the limit, then back.
  // Yaw is rotation about device x. axisMode 'auto' reads rotationRate in x/y/z order on every
  // platform, so x is 'alpha' whatever the page detects the platform to be.
  const swingUntil = async (rate, cond, max = 200) => {
    for (let i = 0; i < max; i++) {
      await page.evaluate(r => window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
        rotationRate: { alpha: r, beta: 0, gamma: 0 }, acceleration: { x: 0, y: 0, z: 0 }, interval: 16 })), rate);
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

  // D-56: off the frame the muzzle may drift at most offFrameDeg (LIM, 5° by default (D-81; was 3° under D-77)) from where
  // it pointed when the finger left, however slowly. 8°/s is well under the rate limit (moveDps 25°/s).
  const offFrame = async () => { await touch('touchEnd', []); await motion(0, 0, 25); };
  const backOnFrame = async () => { await touch('touchStart', [REST]); await motion(0, 0, 8); };
  v = (await st()).violations;
  await offFrame();
  await swingUntil(8, x => x.devOff > LIM - 0.8 || x.alarmActive);
  s = await st(); check(`slow drift off the frame to just under ${LIM}°: no alarm`, !s.alarmActive && s.devOff > LIM - 0.8 && s.devOff < LIM && s.rotEMA < 25, s);
  await swingUntil(8, x => x.alarmActive || x.devOff > LIM + 2);
  s = await st(); check(`slow drift off the frame past ${LIM}°: move alarm`, s.alarmActive && s.alarmReason === 'move' &&
    s.violations === v + 1 && s.devOff > LIM && s.devOff < LIM + 1.5 && s.rotEMA < 25, s);
  await motion(0, 0, 10);
  s = await st(); check('drift alarm latches after the muzzle stops', s.alarmActive, s);
  await backOnFrame();
  s = await st(); check('finger back on the frame clears the drift alarm', s.onRest && !s.alarmActive && s.devOff === 0, s);

  await offFrame();
  await swingUntil(-8, x => x.devOff > LIM - 0.8 || x.alarmActive);
  await motion(0, 0, 40);
  s = await st(); check(`slow drift off the frame to just under ${LIM}°, then still: no alarm`, !s.alarmActive && s.devOff > LIM - 1.3 && s.devOff < LIM, s);
  await backOnFrame();

  await offFrame();
  await motion(0, 20, 45);                                   // twist about the barrel axis (device y) only
  s = await st(); check('twist about the barrel axis off the frame: no alarm', !s.alarmActive && s.devOff < 1, s);
  await backOnFrame();

  v = (await st()).violations;
  await offFrame();
  await touch('touchStart', [TRG]); await motion(0, 0, 3);
  await touch('touchMove', [[TRG[0] - 20, TRG[1], 2]]); await motion(0, 0, 2);   // press started, not broken
  await swingUntil(8, x => x.alarmActive || x.devOff > LIM + 2);
  s = await st(); check(`slow drift past ${LIM}° during a press: move alarm`, s.alarmActive && s.alarmReason === 'move' &&
    s.inPress && s.violations === v + 1 && s.devOff > LIM && s.devOff < LIM + 1.5, s);
  await touch('touchEnd', []); await backOnFrame();
  s = await st(); check('back on the frame after the press clears it', s.onRest && !s.alarmActive && !s.trig, s);

  // D-60 (WQ-013): a brief portrait report during a swing must not pause or disarm; portrait that
  // persists for PORTRAIT_HOLD_MS (3 s) does, as before. Only innerWidth/innerHeight change here.
  const stillFor = async ms => { const t0 = Date.now(); while (Date.now() - t0 < ms) await motion(0, 0, 5); };
  const rotateShown = () => page.$eval('#rotateOv', el => getComputedStyle(el).display !== 'none');
  // Start requested fullscreen (D-53); the window must be restored before it can be resized.
  await page.evaluate(() => document.fullscreenElement && document.exitFullscreen().catch(() => {}));
  await page.waitForTimeout(100);
  await page.setViewportSize({ width: H, height: W });
  await touch('touchMove', [[H / 2, W / 2, 1]]);             // finger still down; portrait coordinates
  await stillFor(1500);
  s = await st(); check('portrait for 1.5 s: still running, armed and safe, engine not paused',
    s.running && s.armed && s.onRest && !s.paused && !s.portraitHeld, s);
  check('portrait for 1.5 s: rotate overlay hidden', !(await rotateShown()));
  await page.setViewportSize({ width: W, height: H });
  await touch('touchMove', [REST]); await motion(0, 0, 8);
  s = await st(); check('back to landscape after 1.5 s: still armed and safe', s.armed && s.onRest && !s.paused, s);
  await page.setViewportSize({ width: H, height: W });
  await stillFor(3500);
  s = await st(); check('portrait for 3.5 s: engine paused and disarmed', s.paused && !s.armed && s.portraitHeld, s);
  check('portrait for 3.5 s: rotate overlay shown', await rotateShown());
  await touch('touchEnd', []);
  await page.setViewportSize({ width: W, height: H }); await motion(0, 0, 8);
  s = await st(); check('back to landscape: unpaused but not armed until the finger is on the frame',
    !s.paused && !s.armed && !(await rotateShown()), s);
  await backOnFrame();
  s = await st(); check('finger back on the frame re-arms', s.armed && s.onRest, s);

  // WQ-016 (D-71, D-72): the drawn trigger and rest zones are where the engine hit-tests them, in both hands;
  // the trigger zone carries a fixed TRIGGER_FWD_PX offset toward the muzzle.
  for (const hand of ['right', 'left']) {
    await page.$eval('#hand', (el, h) => { el.value = h; el.dispatchEvent(new Event('change')); }, hand);
    const centre = id => page.$eval(id, el => { const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    const tc = await centre('#trigZone'), rc = await centre('#restZone');
    const z = zoneFor('trigger', W), ex = (hand === 'left' ? 1 - z.x - z.w / 2 : z.x + z.w / 2) * W;
    check(`${hand}-handed: trigger drawn ${require('../engine.js').K.TRIGGER_FWD_PX} px toward the muzzle`,
      Math.abs(tc[0] - ex) < 0.5, { tc, ex });
    await offFrame();
    await touch('touchStart', [[tc[0], tc[1], 3]]); await motion(0, 0, 3);
    s = await st(); check(`${hand}-handed: touch at the drawn trigger centre engages the trigger`, !!s.trig && !s.alarmActive, s);
    await touch('touchEnd', []); await motion(0, 0, 3);
    await touch('touchStart', [[rc[0], rc[1], 1]]); await motion(0, 0, 8);
    s = await st(); check(`${hand}-handed: touch at the drawn rest centre is on the frame`, s.armed && s.onRest && !s.trig, s);
    // D-87 (WQ-024): the trigger zone reaches the guard's front edge. A touch 10 px behind it, 20 px below the zone
    // top (inside the strip the old .22·W zone left out) engages the trigger (s.trig is set exactly when the
    // engine emits trigOn).
    const gr = await page.$eval('.z.guard', el => { const r = el.getBoundingClientRect(); return [r.left, r.right]; });
    const zt = await page.$eval('#trigZone', el => el.getBoundingClientRect().top);
    const sx = hand === 'left' ? gr[0] + 10 : gr[1] - 10;
    const oldFront = (0.50 * W + require('../engine.js').K.TRIGGER_FWD_PX), oldX = hand === 'left' ? W - oldFront : oldFront;
    await offFrame();
    await touch('touchStart', [[sx, zt + 20, 3]]); await motion(0, 0, 3);
    s = await st(); check(`${hand}-handed: touch 10 px behind the guard's front edge engages the trigger (trigOn)`,
      !!s.trig && !s.alarmActive && (hand === 'left' ? sx < oldX : sx > oldX), { s, sx, oldX });
    await touch('touchEnd', []); await motion(0, 0, 3);
    await touch('touchStart', [[rc[0], rc[1], 1]]); await motion(0, 0, 8);
  }
  // D-87 (WQ-024): the TRIGGER label sits strictly between the blade's front face and the guard bar's inner edge,
  // centred (±1 px), at 852 × 393 and 667 × 375 in both hands.
  for (const [vw, vh] of [[852, 393], [667, 375]]) {
    await page.setViewportSize({ width: vw, height: vh }); await page.waitForTimeout(50);
    for (const hand of ['right', 'left']) {
      await page.$eval('#hand', (el, h) => { el.value = h; el.dispatchEvent(new Event('change')); }, hand);
      const m = await page.evaluate(() => {
        const r = q => { const b = document.querySelector(q).getBoundingClientRect(); return [b.left, b.right]; };
        return { bl: r('#blade'), lb: r('#trigZone .label'), g: r('.z.guard') };
      });
      const bar = 7, lh = hand === 'left';
      const face = lh ? m.bl[0] : m.bl[1], inner = lh ? m.g[0] + bar : m.g[1] - bar;
      const lo = Math.min(face, inner), hi = Math.max(face, inner);
      const mid = (m.lb[0] + m.lb[1]) / 2;
      check(`${vw}×${vh} ${hand}-handed: TRIGGER label centred between the blade face and the guard bar, touching neither`,
        m.lb[0] > lo && m.lb[1] < hi && Math.abs(mid - (lo + hi) / 2) <= 1, { m, face, inner });
    }
  }
  await page.setViewportSize({ width: W, height: H }); await page.waitForTimeout(50);
  await page.$eval('#hand', el => { el.value = 'right'; el.dispatchEvent(new Event('change')); });

  // D-75: a touch that engaged the trigger stays on the trigger until it lifts, wherever it slides;
  // it never counts as frame contact, so sliding it into the frame strip neither arms nor clears an alarm.
  await offFrame();
  await touch('touchStart', [TRG]); await motion(0, 0, 3);
  await wobble(80);                                          // resting on the trigger, phone swings: alarm
  await motion(0, 0, 10);
  s = await st(); check('D-75: moving while resting on the trigger alarms', s.alarmActive && !!s.trig, s);
  await touch('touchMove', [[REST[0], REST[1], 2]]); await motion(0, 0, 10);
  s = await st(); check('D-75: trigger finger slid into the frame strip stays on the trigger, not on the frame',
    !!s.trig && !s.onRest && s.alarmActive, s);
  await touch('touchEnd', []); await motion(0, 0, 3);
  await touch('touchStart', [REST]); await motion(0, 0, 8);
  s = await st(); check('D-75: lifting it and placing a finger on the strip arms and clears the alarm',
    !s.trig && s.onRest && !s.alarmActive, s);

  // Finish (Settings) → session summary; New session clears it and returns to the start screen.
  const shotsSoFar = (await st()).shots;
  await page.click('#gear'); await page.click('#finishBtn'); await page.waitForTimeout(50);
  s = await st(); check('Finish opens the session summary with the session totals',
    s.summaryOpen && s.summary.shots === shotsSoFar && s.summary.breaks180 === 1 && s.summary.moveAlarms === s.violations, s);
  check('summary lists the shot count', (await page.textContent('#sumRows')).includes('Shots' + shotsSoFar));
  // D-45: one clean and one moved shot with no alarm, one shot during an alarm.
  check('summary grades only the shots with no alarm',
    s.summary.shots === 3 && s.summary.unsafeShots === 1 && s.summary.graded === 2 && s.summary.clean === 1 &&
    s.summary.moved === 1 && s.summary.jerked === 0 && s.summary.cleanPct === 50 && s.summary.bestDev !== null, s.summary);
  { const t = await page.textContent('#sumRows');
    check('summary percentages say they cover the 2 shots with no alarm',
      t.includes('Clean, of 2 shots with no alarm1 (50%)') && t.includes('Moved, of 2 shots with no alarm1 (50%)') &&
      t.includes('Shots fired during an alarm (not graded below)1'), t); }
  await motion(200, 200, 10);
  s = await st(); check('trainer is paused while the summary is open', !s.alarmActive && s.summaryOpen, s);
  await page.click('#sumNew'); await page.waitForTimeout(50);
  s = await st(); check('New session resets the stats and shows the start screen',
    !s.summaryOpen && !s.running && s.summary.shots === 0 && s.violations === 0 &&
    await page.evaluate(() => document.getElementById('startOv').classList.contains('show')), s);

  // WQ-023: the debug readout shows the last navigator.vibrate result. Fresh page with vibrate stubbed to
  // return false (what Chrome does without user activation) and the readout on.
  {
    const p2 = await ctx.newPage();
    p2.on('pageerror', e => errors.push(e.message));
    await p2.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value: () => false });
      try { localStorage.setItem('tdt.settings.v2', JSON.stringify({ debug: true })); } catch (e) {}
    });
    await p2.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
    await p2.click('#startBtn'); await p2.waitForTimeout(150);
    const cdp2 = await ctx.newCDPSession(p2);
    const touch2 = (type, pts) => cdp2.send('Input.dispatchTouchEvent', {
      type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, radiusX: 25, radiusY: 25 })) });
    const still = async n => { for (let i = 0; i < n; i++) {
      await p2.evaluate(() => window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
        rotationRate: { alpha: 0, beta: 0, gamma: 0 }, acceleration: { x: 0, y: 0, z: 0 }, interval: 16 })));
      await p2.waitForTimeout(16); } };
    await touch2('touchStart', [REST]); await still(5);
    await touch2('touchEnd', []); await still(25);
    await touch2('touchStart', [TRG]); await still(5);
    await touch2('touchMove', [[TRG[0] - 70, TRG[1], 2]]); await still(5);
    const s2 = await p2.evaluate(() => window.__tdt());
    const dbg = await p2.textContent('#debug');
    check('debug readout shows vib: false (pattern 45) after a shot with vibrate refused',
      s2.shots === 1 && /^vib: false \(pattern 45\)$/m.test(dbg), dbg);
    await p2.close();
  }

  // WQ-026 (D-91): Overall sensitivity presets write values into moveDps, moveAcc, offFrameDeg; sliding shows Custom.
  {
    const p3 = await ctx.newPage();
    p3.on('pageerror', e => errors.push(e.message));
    await p3.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
    await p3.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await p3.reload();
    const stored3 = () => p3.evaluate(() => localStorage.getItem('tdt.settings.v2'));
    const setSens = v => p3.$eval('#sensitivity', (el, v) => { el.value = v; el.dispatchEvent(new Event('change')); }, v);
    const sens = () => p3.$eval('#sensitivity', el => el.value);
    const val = k => p3.$eval(`#s_sliders1_${k}`, el => +el.value);
    const slide = (k, v) => p3.$eval(`#s_sliders1_${k}`, (el, v) => { el.value = v; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); }, v);
    const out = k => p3.$eval(`#s_sliders1_${k}`, el => el.parentElement.querySelector('output').textContent);
    const order = await p3.$$eval('#sliders1 input[type=range]', els => els.map(el => el.dataset.k).join(','));
    check('WQ-026: Movement alarm slider order is moveDps, moveAcc, offFrameDeg, graceMs, jerkMs',
      order === 'moveDps,moveAcc,offFrameDeg,graceMs,jerkMs', order);
    check('WQ-026: Overall sensitivity drop-down sits above the Movement alarm sliders, on Default',
      await p3.evaluate(() => { const sel = document.getElementById('sensitivity');
        return sel.value === 'default' && !!(sel.compareDocumentPosition(document.getElementById('sliders1')) & Node.DOCUMENT_POSITION_FOLLOWING); }));
    await setSens('low');
    const lowVals = [await val('moveDps'), await val('moveAcc'), await val('offFrameDeg')];
    check('WQ-026: selecting Low sets the sliders to 32.5 / 1.95 / 6.5', lowVals.join('/') === '32.5/1.95/6.5', lowVals);
    check('WQ-026: under Low the outputs read 32.5 °/s, 1.95 m/s², 6.5 °',
      await out('moveDps') === '32.5 °/s' && await out('moveAcc') === '1.95 m/s²' && await out('offFrameDeg') === '6.5 °' && await out('graceMs') === '300 ms',
      [await out('moveDps'), await out('moveAcc'), await out('offFrameDeg')]);
    check('WQ-026: under Low localStorage holds exactly the three slider keys, no preset key',
      await stored3() === JSON.stringify({ moveDps: 32.5, moveAcc: 1.95, offFrameDeg: 6.5 }), await stored3());
    await setSens('default');
    check('WQ-026: selecting Default drops the three keys (D-64)', await stored3() === null, await stored3());
    check('WQ-026: under Default the outputs read 25 °/s, 1.5 m/s², 5 °',
      await out('moveDps') === '25 °/s' && await out('moveAcc') === '1.5 m/s²' && await out('offFrameDeg') === '5 °',
      [await out('moveDps'), await out('moveAcc'), await out('offFrameDeg')]);
    await setSens('high');
    const highVals = [await val('moveDps'), await val('moveAcc'), await val('offFrameDeg')];
    check('WQ-026: selecting High sets the sliders to 17.5 / 1.05 / 3.5', highVals.join('/') === '17.5/1.05/3.5' && await sens() === 'high', highVals);
    await slide('moveDps', 20);
    check('WQ-026: High, then sliding moveDps to 20 shows Custom', await sens() === 'custom' && await out('moveDps') === '20 °/s', [await sens(), await out('moveDps')]);
    await slide('moveDps', 17.5);
    check('WQ-026: sliding moveDps back to 17.5 shows High again', await sens() === 'high', await sens());
    await p3.$eval('#resetDefaults', el => el.click());
    check('WQ-026: Restore defaults returns the drop-down to Default', await sens() === 'default' &&
      await out('moveDps') === '25 °/s' && await stored3() === null, [await sens(), await stored3()]);
    check('WQ-026: the engine has no sensitivity setting or limitsFor',
      await p3.evaluate(() => window.TDT.DEFAULTS.sensitivity === undefined && window.TDT.limitsFor === undefined && window.TDT.SENSITIVITY === undefined));
    // A 20 °/s back-and-forth burst off the frame: between High's moveDps (17.5) and Default's (25), little net drift.
    await p3.click('#startBtn'); await p3.waitForTimeout(150);
    const cdp3 = await ctx.newCDPSession(p3);
    const touch3 = (type, pts) => cdp3.send('Input.dispatchTouchEvent', {
      type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, radiusX: 25, radiusY: 25 })) });
    const rot3 = async (rate, n) => { for (let i = 0; i < n; i++) {
      const r = i % 2 ? rate : -rate;
      await p3.evaluate(r => window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
        rotationRate: { alpha: r, beta: 0, gamma: 0 }, acceleration: { x: 0, y: 0, z: 0 }, interval: 16 })), r);
      await p3.waitForTimeout(16); } };
    const st3 = () => p3.evaluate(() => window.__tdt());
    await touch3('touchStart', [REST]); await rot3(0, 5);
    await touch3('touchEnd', []); await rot3(0, 30);
    await rot3(20, 25);
    let s3 = await st3();
    check('WQ-026: Default: a 20 °/s burst off the frame does not alarm', s3.armed && !s3.onRest && !s3.alarmActive && s3.rotEMA > 17.5, s3);
    await touch3('touchStart', [REST]); await rot3(0, 8);
    await setSens('high');
    await touch3('touchEnd', []); await rot3(0, 30);
    s3 = await st3(); check('WQ-026: High: off the frame and still, no alarm before the burst', !s3.onRest && !s3.alarmActive, s3);
    await rot3(20, 25);
    s3 = await st3();
    check('WQ-026: High (17.5 °/s): the same 20 °/s burst off the frame alarms', s3.alarmActive && s3.alarmReason === 'move' && s3.devOff < 3.5, s3);
    await p3.close();
  }

  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log(failures ? `\n${failures} failed` : '\nall passed');
  process.exit(failures ? 1 : 0);
})();
