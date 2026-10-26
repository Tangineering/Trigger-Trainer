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
  // D-110: drill start beep pitch and length are settings, the last two sliders of the Other section.
  check('D-110: Other section ends with the start-beep pitch and length sliders at 1650 Hz / 350 ms',
    await page.$$eval('#sliders4 input[type=range]', els => els.map(e => e.dataset.k + (e.dataset.k === 'volume' ? '' : '=' + e.value)).join(',')) === 'volume,beepHz=1650,beepMs=350');
  await page.$eval('#s_sliders4_beepHz', el => { el.value = '1500'; el.dispatchEvent(new Event('input')); });
  check('D-110: a moved beep slider is stored under its own key only (D-64)', await stored() === JSON.stringify({ volume: 0.35, beepHz: 1500 }));
  await page.$eval('#s_sliders4_beepHz', el => { el.value = '1650'; el.dispatchEvent(new Event('input')); });
  check('D-110: back to the default drops the key', await stored() === JSON.stringify({ volume: 0.35 }));

  await page.click('#startBtn');
  await page.waitForTimeout(150);

  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, radiusX: 25, radiusY: 25 })) });
  // Test clock (WQ-036, D-126). The page stamps every input and tick with performance.now(), so samples sent
  // 16 ms apart in wall time can land 30-100 ms apart in a slow frame, and the same burst integrates to a
  // different angle. While the clock is held (holdClock), performance.now() in the page returns a virtual time
  // that only the motion helpers advance, 16 ms per sample, and each sample waits for one rendered frame so the
  // page's tick sees it: the engine then gets the same timestamps on every run. releaseClock() lets time run on
  // from where the virtual clock stopped (a fixed offset from the real clock, so time never jumps).
  // Test-only, injected from here: index.html and engine.js are unchanged.
  let held = false;
  const holdClock = () => page.evaluate(() => {
    const c = window.__testClock || (window.__testClock = { real: performance.now.bind(performance), off: 0 });
    c.vt = Math.ceil(c.real() - c.off); c.held = true;
    performance.now = () => (c.held ? c.vt : c.real() - c.off);
  }).then(() => { held = true; });
  const releaseClock = () => page.evaluate(() => { const c = window.__testClock; c.off = c.real() - c.vt; c.held = false; })
    .then(() => { held = false; });
  const frame = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
  const sample = async (a, b) => {
    await page.evaluate(([a, b]) => {
      if (window.__testClock && window.__testClock.held) window.__testClock.vt += 16;
      window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
        rotationRate: { alpha: a, beta: b, gamma: 0 }, acceleration: { x: 0, y: 0, z: 0 }, interval: 16 }));
    }, [a, b]);
    if (held) await frame(); else await page.waitForTimeout(16);
  };
  const motion = async (alpha, beta = alpha, n = 15) => { for (let i = 0; i < n; i++) await sample(alpha, beta); };
  // Shake back and forth: high rotation rate, little net change in where the muzzle points.
  const wobble = async (rate, n = 15) => { for (let i = 0; i < n; i++) { const r = i % 2 ? rate : -rate; await sample(r, r); } };
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

  // The press checks below depend on how far the muzzle turns and how long it moves: run them on the held clock.
  await holdClock();
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
  await releaseClock();

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

  // WQ-027: drills (D-93, D-97, D-98). Fresh context so localStorage and touches start clean.
  {
    const fs = require('fs');
    const shotDir = path.resolve(__dirname, '..', 'docs', 'screenshots', 'wq-027');
    if (process.env.WQ_SCREENSHOTS) fs.mkdirSync(shotDir, { recursive: true });
    const dctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true });
    const dp = await dctx.newPage();
    dp.on('pageerror', e => errors.push('drill page: ' + e.message));
    await dp.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
    await dp.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await dp.reload();
    const dst = () => dp.evaluate(() => window.__tdt());
    const dcdp = await dctx.newCDPSession(dp);
    const dtouch = (type, pts) => dcdp.send('Input.dispatchTouchEvent', {
      type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, radiusX: 25, radiusY: 25 })) });
    const dmotion = async (n = 1) => {
      for (let i = 0; i < n; i++) {
        await dp.evaluate(() => window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
          rotationRate: { alpha: 0, beta: 0, gamma: 0 }, acceleration: { x: 0, y: 0, z: 0 }, interval: 16 })));
        await dp.waitForTimeout(16);
      }
    };
    const lsDrill = () => dp.evaluate(() => { try { return localStorage.getItem('tdt.drill'); } catch (e) { return 'ERR'; } });
    const lineText = () => dp.textContent('#drillLine');
    // One full press: touch the trigger, pull 70 px back, lift. The phone stays still.
    const press = async () => {
      // WQ-031 (D-115): CDP keeps a point down until a touchEnd lists it, so touchStart [TRG] alone would add a second
      // finger beside the frame finger (ignored now); lift every point first (throws if none is down).
      await dtouch('touchEnd', []).catch(() => {});
      await dtouch('touchStart', [TRG]); await dmotion(3);
      for (let dx = 20; dx <= 70; dx += 25) { await dtouch('touchMove', [[TRG[0] - dx, TRG[1], 2]]); await dmotion(1); }
      await dmotion(2); await dtouch('touchEnd', []); await dmotion(3);
    };
    // Page-side frame observer: timestamps taken from performance.now() in the frame that first shows the state,
    // not from the engine's dueAt.
    const observe = () => dp.evaluate(() => {
      window.__obs = { armT: null, beepT: null, shotTs: [], restBackT: null, beeps: 0 };
      if (window.__obsOn) return; window.__obsOn = true;
      let wasRest = false;
      const f = () => {
        const s = window.__tdt(), n = performance.now(), o = window.__obs;
        if (s.armed && o.armT == null) o.armT = n;
        if (s.drill && s.drill.phase === 'live' && o.beepT == null) o.beepT = n;
        if (s.drill && s.drill.phase !== 'standby') while (o.shotTs.length < s.drill.shots) o.shotTs.push(n);   // frame that first shows each run shot
        if (s.onRest && !wasRest) o.restBackT = n;
        wasRest = s.onRest;
        requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    });
    const shoot = p => process.env.WQ_SCREENSHOTS ? dp.screenshot({ path: p }) : null;   // PNGs only on request: npm test leaves the tree clean
    const sleepMotion = async ms => { const t0 = Date.now(); while (Date.now() - t0 < ms) await dmotion(1); };
    const slowPress = async () => { await press(); await dmotion(30); };
    const wobbleD = async (rate, n) => { for (let i = 0; i < n; i++) {
      const r = i % 2 ? rate : -rate;
      await dp.evaluate(r => window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
        rotationRate: { alpha: r, beta: r, gamma: 0 }, acceleration: { x: 0, y: 0, z: 0 }, interval: 16 })), r);
      await dp.waitForTimeout(16); } };
    const swingD = async (rate, cond, max = 200) => {
      for (let i = 0; i < max; i++) {
        await dp.evaluate(r => window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
          rotationRate: { alpha: r, beta: 0, gamma: 0 }, acceleration: { x: 0, y: 0, z: 0 }, interval: 16 })), rate);
        await dp.waitForTimeout(16);
        if (cond(await dst())) return true;
      }
      return false;
    };
    const tableRows = () => dp.$$eval('#drillResRows tr', trs => trs.map(tr => [...tr.children].map(td => td.textContent)));
    const waitPhase = async (phase, maxMs) => {
      const t0 = Date.now(); let s;
      while (Date.now() - t0 < maxMs) { await dmotion(1); s = await dst(); if (s.drill && s.drill.phase === phase) return s; }
      return s;
    };
    // Bounding-box reachability: scrolled into view, fully inside the viewport, not clipped horizontally.
    const inView = async (sel, vw, vh) => {
      const h = await dp.$(sel); await h.scrollIntoViewIfNeeded();
      const b = await h.boundingBox();
      return b && b.width > 0 && b.height > 0 && b.x >= 0 && b.x + b.width <= vw + 0.5 && b.y >= 0 && b.y + b.height <= vh + 0.5 ? true : b;
    };

    // --- 1. start screen and picker
    check('WQ-027: Drill button reads Freestyle by default', /Freestyle/.test(await dp.textContent('#drillBtn')), await dp.textContent('#drillBtn'));
    check('WQ-027: no tdt.drill stored yet', await lsDrill() === null, await lsDrill());
    await dp.click('#drillBtn');
    check('WQ-027: tapping Drill opens the picker', (await dst()).pickerOpen === true);
    const ids = await dp.$$eval('#drillList .drillOpt', els => els.map(e => e.dataset.id));
    check("WQ-027: picker lists exactly ['freestyle','lowready','box','bill','transitions'] in D-93 + D-112 a order (Low Ready joined with WQ-028, Box Drill with WQ-029, Transitions with WQ-030)", JSON.stringify(ids) === '["freestyle","lowready","box","bill","transitions"]', ids);
    check('WQ-027: the picker highlights the current selection (Freestyle) and shows an <svg> diagram',
      await dp.$eval('#drillList .drillOpt.sel', e => e.dataset.id) === 'freestyle' && await dp.$eval('#drillDiagram', e => !!e.querySelector('svg')));
    await dp.click('#drillList .drillOpt[data-id="bill"]');
    check('WQ-027: highlighting Bill moves .sel and changes the how-to line',
      await dp.$eval('#drillList .drillOpt.sel', e => e.dataset.id) === 'bill' && /beep/i.test(await dp.textContent('#drillHow')), await dp.textContent('#drillHow'));
    const svgBill = await dp.$eval('#drillDiagram', e => e.innerHTML);
    await dp.click('#drillList .drillOpt[data-id="freestyle"]');
    check('WQ-027: the diagram differs between Freestyle and Bill', svgBill !== await dp.$eval('#drillDiagram', e => e.innerHTML));
    await dp.click('#drillList .drillOpt[data-id="bill"]');
    await dp.click('#drillCancelBtn');
    check('WQ-027: Cancel closes the picker, stores nothing and keeps Freestyle',
      !(await dst()).pickerOpen && await lsDrill() === null && /Freestyle/.test(await dp.textContent('#drillBtn')) && (await dst()).drillSel === 'freestyle', [await lsDrill(), await dp.textContent('#drillBtn')]);

    // --- 2. Freestyle run: no drill at all
    await dp.click('#startBtn'); await dp.waitForTimeout(150);
    await dtouch('touchStart', [REST]); await dmotion(5);
    let d = await dst();
    check('WQ-027: Freestyle run: drill is null, the drill line is empty and the page still arms', d.drill === null && d.armed && (await lineText()) === '', [d, await lineText()]);
    await dtouch('touchEnd', []); await dmotion(2);
    await dp.reload();

    // --- 3. choose Bill
    await dp.click('#drillBtn');
    check('WQ-027: reopening the picker after a reload highlights Freestyle', await dp.$eval('#drillList .drillOpt.sel', e => e.dataset.id) === 'freestyle');
    await dp.click('#drillList .drillOpt[data-id="bill"]');
    await dp.click('#drillChoose');
    check("WQ-027: Choose Bill stores tdt.drill === 'bill' and the button names Bill Drill",
      await lsDrill() === 'bill' && /Bill Drill/.test(await dp.textContent('#drillBtn')) && !(await dst()).pickerOpen, [await lsDrill(), await dp.textContent('#drillBtn')]);
    await dp.reload();
    check('WQ-027: the choice survives a reload', /Bill Drill/.test(await dp.textContent('#drillBtn')) && (await dst()).drillSel === 'bill');
    await dp.click('#drillBtn');
    check('WQ-027: reopened picker has Bill highlighted', await dp.$eval('#drillList .drillOpt.sel', e => e.dataset.id) === 'bill');
    await dp.click('#drillCancelBtn');

    // --- 4. Bill run end to end
    await dp.click('#startBtn'); await dp.waitForTimeout(150);
    await observe();
    d = await dst();
    check('WQ-027: Bill: after Start the drill is in standby with no shots', d.drill && d.drill.id === 'bill' && d.drill.phase === 'standby' && d.drill.shots === 0 && d.drillRuns === 0, d);
    const line0 = await lineText();
    check('WQ-027: Bill: the drill line names Bill Drill and the wait for the beep', /Bill Drill/.test(line0) && /beep/i.test(line0), line0);
    await sleepMotion(1300);                     // longer than the shortest possible delay (1000 ms), no finger on the frame
    d = await dst();
    check('WQ-027: Bill: 1.3 s with no finger on the frame: still standby, no beep, not armed (the delay has not started)',
      d.drill.phase === 'standby' && !d.armed && (await dp.evaluate(() => window.__obs)).beepT === null, d);
    await dtouch('touchStart', [REST]);
    d = await waitPhase('live', 4600);
    const obs = await dp.evaluate(() => window.__obs);
    check('WQ-027: Bill: the beep arrived (phase live) within 4.6 s of arming', d.drill && d.drill.phase === 'live', d);
    const gap = obs.beepT - obs.armT;
    check(`WQ-027: Bill: beep 1000-4000 ms (+ one frame) after THAT arming (first touch, after the 1.3 s wait), from page timestamps (${Math.round(gap)} ms)`,
      obs.armT != null && obs.beepT != null && gap >= 1000 - 17 && gap <= 4000 + 17, obs);
    const line1 = await lineText();
    check('WQ-027: Bill: the drill line changed at the beep ("Go")', line1 !== line0 && /go/i.test(line1), [line0, line1]);
    for (let i = 1; i <= 6; i++) {
      await press(); d = await dst();
      if (i < 6) check(`WQ-027: Bill: after press ${i} the drill has ${i} shot${i > 1 ? 's' : ''} and is live`, d.drill.phase === 'live' && d.drill.shots === i, d);
    }
    check('WQ-027: Bill: after the sixth shot the phase is finishing, no results yet', d.drill.phase === 'finishing' && d.drill.shots === 6 && !d.drillResOpen && !d.alarmActive, d);
    check('WQ-027: Bill: the drill line asks for the finger back on the frame', /finger/i.test(await lineText()), await lineText());
    await dtouch('touchStart', [REST]); await dmotion(4); d = await dst();
    check('WQ-027: Bill: finger back on the frame ends the run: results open, 1 run, engine paused',
      d.drillResOpen === true && d.drillRuns === 1 && d.paused === true && d.drill.phase === 'ended', d);
    const rows = await dp.$$eval('#drillResRows tr', trs => trs.map(tr => [...tr.children].map(td => td.textContent)));
    const rowOf = k => (rows.find(r => r[0] === k) || [])[1];
    check('WQ-027: results table has First shot, Splits and Total with 2-decimal seconds',
      /^\d+\.\d\d s$/.test(rowOf('First shot') || '') && /^\d*\.\d\d( · \d*\.\d\d){4} s$/.test(rowOf('Splits') || '') && /^\d+\.\d\d s$/.test(rowOf('Total') || ''), rows);
    check('WQ-027: results table has no Early or With alarm row after a clean run',
      !rows.some(r => /Early/.test(r[0])) && !rows.some(r => /alarm/i.test(r[0] === 'Shots' ? '' : r[0])), rows);
    const res = d.drill.result;
    const obsR = await dp.evaluate(() => window.__obs);
    const FR = 20;   // one frame (16.7 ms) plus timer jitter: shot times come from the touch event, the observer sees them at the next frame
    check(`WQ-027: result.first is within one frame of (frame that showed shot 1) - (frame that showed the beep): ${res.first} vs ${(obsR.shotTs[0] - obsR.beepT).toFixed(1)}`,
      obsR.shotTs.length === 6 && Math.abs(res.first - (obsR.shotTs[0] - obsR.beepT)) <= FR, [res, obsR]);
    check(`WQ-027: result.total is within one frame of the sixth shot's frame minus the beep's: ${res.total} vs ${(obsR.shotTs[5] - obsR.beepT).toFixed(1)}`,
      Math.abs(res.total - (obsR.shotTs[5] - obsR.beepT)) <= FR && res.splits.length === 5 && res.shots.length === 6, [res, obsR]);
    check('WQ-027: every split is within one frame of the gap between the observed shot frames',
      res.splits.every((x, i) => Math.abs(x - (obsR.shotTs[i + 1] - obsR.shotTs[i])) <= 2 * FR), [res.splits, obsR.shotTs]);
    check('WQ-027: the shown First shot / Total match the result in seconds',
      rowOf('First shot') === (res.first / 1000).toFixed(2) + ' s' && rowOf('Total') === (res.total / 1000).toFixed(2) + ' s', [rows, res.first, res.total]);
    check('WQ-027: the clean run has no early shot and is not marked with an alarm', res.first > 0 && res.early === 0 && res.withAlarm === false && res.alarms === 0, res);
    check('WQ-027: Best clean total this session equals this run (first clean run)', rowOf('Best clean total this session') === (res.total / 1000).toFixed(2) + ' s', rows);
    const landscapeResShot = path.join(shotDir, 'results-landscape.png');
    await shoot(landscapeResShot);
    for (const sel of ['#drillAgain', '#drillChange']) {
      const r = await inView(sel, W, H);
      check(`WQ-027: ${sel} is inside the 844x390 viewport on the results overlay`, r === true, r);
    }

    // --- 5. portrait screenshots of the results overlay, then landscape back
    await dp.evaluate(() => document.fullscreenElement ? document.exitFullscreen() : null); await dp.waitForTimeout(200);   // Start went fullscreen
    await dp.setViewportSize({ width: H, height: W }); await dp.waitForTimeout(250);
    for (const sel of ['#drillAgain', '#drillChange']) {
      const r = await inView(sel, H, W);
      check(`WQ-027: ${sel} is inside the 390x844 viewport on the results overlay`, r === true, r);
    }
    await dp.$eval('#drillResOv', e => { e.scrollTop = 0; });
    await shoot(path.join(shotDir, 'results-portrait.png'));
    await dp.setViewportSize({ width: W, height: H }); await dp.waitForTimeout(250);

    // --- 6. Again
    await dtouch('touchEnd', []);
    await dp.click('#drillAgain'); await dp.waitForTimeout(100);
    d = await dst();
    check('WQ-027: Again hides the results and starts a new run in standby; the run count stays 1',
      !d.drillResOpen && d.drill.phase === 'standby' && d.drill.shots === 0 && d.drillRuns === 1 && d.running, d);
    check('WQ-027: Again: the engine is no longer paused', (await dmotion(3), (await dst()).paused === false));
    // Pausing before the finger ever touched the frame: the delay never started, so nothing is cancelled (D-102/D-104).
    await dp.click('#gear'); await dp.waitForTimeout(120);
    await dp.click('#doneBtn'); await dp.waitForTimeout(100);
    d = await dst();
    check('WQ-027: gear before any touch: back in standby, and the status line does NOT say Cancelled',
      d.drill.phase === 'standby' && !/cancel/i.test(await lineText()) && /beep/i.test(await lineText()), [d.drill, await lineText()]);

    // --- 7. early shot: one press right after arming, before the beep
    await observe();
    await dtouch('touchStart', [REST]); await dmotion(2);
    await dtouch('touchEnd', []); await dmotion(1);
    const shots0 = (await dst()).shots;
    await press();
    d = await dst();
    const obsE = await dp.evaluate(() => window.__obs);
    const sinceArm = await dp.evaluate(a => performance.now() - a, obsE.armT);
    check(`WQ-027: early shot: a press ${Math.round(sinceArm)} ms after arming (before any possible beep) counts as early, not as a run shot`,
      sinceArm < 1000 && d.drill.phase === 'standby' && d.drill.early === 1 && d.drill.shots === 0 && d.shots === shots0 + 1, [sinceArm, d]);
    await dtouch('touchStart', [REST]);
    d = await waitPhase('live', 4600);
    check('WQ-027: early shot: the run still gets its beep afterwards and keeps early === 1', d.drill.phase === 'live' && d.drill.early === 1 && d.drill.shots === 0, d);
    for (let i = 0; i < 6; i++) await press();
    await dtouch('touchStart', [REST]); await dmotion(4); d = await dst();
    const rows2 = await dp.$$eval('#drillResRows tr', trs => trs.map(tr => [...tr.children].map(td => td.textContent)));
    check('WQ-027: early shot: the run ends with an Early row of 1 in the results',
      d.drillResOpen && d.drillRuns === 2 && d.drill.result.early === 1 && rows2.some(r => /Early/.test(r[0]) && r[1] === '1'), [d.drillRuns, rows2]);
    check('WQ-027: early shot: six run shots, the early one not counted', d.drill.result.shots.length === 6, d.drill.result);

    // --- 8. pause cancels: standby, then live
    await dtouch('touchEnd', []);
    await dp.click('#drillAgain'); await dp.waitForTimeout(100);
    await dtouch('touchStart', [REST]); await dmotion(6);       // delay started: finger on the frame >= 100 ms, beep not yet possible
    d = await dst();
    check('WQ-027: standby with the delay started (finger on the frame, no beep yet)', d.drill.phase === 'standby' && d.armed && d.onRest, d);
    await dp.click('#gear'); await dp.waitForTimeout(120);
    d = await dst();
    check('WQ-027: gear after the delay started: settings open, drill back in standby with no shots, engine paused',
      await dp.$eval('#settingsOv', e => e.classList.contains('show')) && d.drill.phase === 'standby' && d.drill.shots === 0 && d.paused, d);
    // The finger is still down through Resume, so the engine re-arms (and redraws the delay) at Resume, not at a later
    // touch: start the frame observer BEFORE Resume so armT is the first frame showing the new arming (in-page performance.now()).
    await observe();
    await dp.click('#doneBtn'); await dp.waitForTimeout(100);
    check('WQ-027: after Resume the status line says Cancelled and to restart',
      /^Cancelled/.test(await lineText()) && /restart/i.test(await lineText()), await lineText());
    d = await waitPhase('live', 4600);
    const obsC = await dp.evaluate(() => window.__obs), gapC = obsC.beepT - obsC.armT;
    check(`WQ-027: after a cancel the beep comes 1000-4000 ms (+ a frame) after the NEW arming (${Math.round(gapC)} ms): the delay was redrawn`,
      d.drill.phase === 'live' && gapC >= 1000 - 17 && gapC <= 4000 + 17, [obsC, d]);
    await press(); await press();
    d = await dst();
    check('WQ-027: live run with two shots fired before pausing', d.drill.shots === 2, d);
    await dtouch('touchStart', [REST]); await dmotion(2);
    await dp.click('#gear'); await dp.waitForTimeout(120);
    d = await dst();
    check('WQ-027: gear mid-run cancels it: standby, 0 shots, early 0, no result, run count unchanged',
      d.drill.phase === 'standby' && d.drill.shots === 0 && d.drill.early === 0 && d.drill.result === null && d.drillRuns === 2, d);
    await dp.click('#doneBtn'); await dp.waitForTimeout(100);
    check('WQ-027: the status line says Cancelled after Resume', /^Cancelled/.test(await lineText()), await lineText());
    await dtouch('touchStart', [REST]);
    d = await waitPhase('live', 4600);
    check('WQ-027: the beep clears the cancelled note ("Go")', /go/i.test(await lineText()) && !/cancel/i.test(await lineText()), await lineText());

    // --- 9. finish this run, then Change drill
    for (let i = 0; i < 6; i++) await press();
    await dtouch('touchStart', [REST]); await dmotion(4);
    d = await dst();
    check('WQ-027: third run ends with the results open', d.drillResOpen && d.drillRuns === 3, d);
    await dtouch('touchEnd', []);
    await dp.click('#drillChange'); await dp.waitForTimeout(100);
    d = await dst();
    check('WQ-027: Change drill: trainer stopped, start screen shown, results closed, drill is null',
      d.running === false && d.drill === null && !d.drillResOpen && await dp.$eval('#startOv', e => e.classList.contains('show')), d);
    check('WQ-027: Change drill keeps the stored selection', await lsDrill() === 'bill');
    // A Freestyle run after Bill: no drill, drill line empty.
    await dp.click('#drillBtn'); await dp.click('#drillList .drillOpt[data-id="freestyle"]'); await dp.click('#drillChoose');
    check('WQ-027: choosing Freestyle again stores tdt.drill === freestyle', await lsDrill() === 'freestyle', await lsDrill());
    await dp.click('#startBtn'); await dp.waitForTimeout(150); await dtouch('touchStart', [REST]); await dmotion(5);
    d = await dst();
    check('WQ-027: Freestyle after Bill: no drill, empty drill line, armed', d.drill === null && (await lineText()) === '' && d.armed, [d, await lineText()]);
    await dtouch('touchEnd', []);

    // --- 10. unknown drill ids are rejected by the engine (Box was the last not-ready id until WQ-029)
    const rej = await dp.evaluate(() => { const e = TDT.createEngine(TDT.DEFAULTS, {}); return [e.startDrill(0, 'nope', 1), e.startDrill(0, '', 1), e.startDrill(0, undefined, 1), e.state.drill]; });
    check("WQ-027: engine rejects unknown ids ('nope', '', undefined) and leaves state.drill null", JSON.stringify(rej) === '[false,false,false,null]', rej);
    const accBox = await dp.evaluate(() => { const e = TDT.createEngine(TDT.DEFAULTS, {}); return [e.startDrill(0, 'box', 7), e.state.drill.phase, e.state.drill.id]; });
    check("WQ-029: engine accepts box and starts in standby", JSON.stringify(accBox) === '[true,"standby","box"]', accBox);
    const accLr = await dp.evaluate(() => { const e = TDT.createEngine(TDT.DEFAULTS, {}); return [e.startDrill(0, 'lowready', 7), e.state.drill.phase, e.state.drill.id]; });
    check("WQ-028: engine accepts lowready and starts in standby", JSON.stringify(accLr) === '[true,"standby","lowready"]', accLr);
    const acc = await dp.evaluate(() => { const e = TDT.createEngine(TDT.DEFAULTS, {}); return [e.startDrill(0, 'bill', 7), e.state.drill.phase, e.state.drill.id]; });
    check("WQ-027: engine accepts bill and starts in standby", JSON.stringify(acc) === '[true,"standby","bill"]', acc);
    await dp.reload();
    await dp.evaluate(() => { try { localStorage.setItem('tdt.drill', 'nope'); } catch (e) {} });
    await dp.reload();
    check('WQ-027: a stored unknown drill id falls back to Freestyle', (await dst()).drillSel === 'freestyle' && /Freestyle/.test(await dp.textContent('#drillBtn')));
    await dp.click('#drillBtn');
    const idsBox = await dp.$$eval('#drillList .drillOpt', els => els.map(e => e.dataset.id));
    check("WQ-027: with tdt.drill = 'nope' stored the picker lists freestyle, lowready, box, bill and transitions, Freestyle highlighted",
      JSON.stringify(idsBox) === '["freestyle","lowready","box","bill","transitions"]' && await dp.$eval('#drillList .drillOpt.sel', e => e.dataset.id) === 'freestyle', idsBox);
    await dp.click('#drillCancelBtn');
    await dp.evaluate(() => { try { localStorage.setItem('tdt.drill', 'box'); } catch (e) {} });
    await dp.reload();
    check("WQ-029: a stored tdt.drill = 'box' now selects Box Drill (the button names it)", (await dst()).drillSel === 'box' && /Box Drill/.test(await dp.textContent('#drillBtn')), [(await dst()).drillSel, await dp.textContent('#drillBtn')]);
    await dp.click('#drillBtn');
    check("WQ-029: with tdt.drill = 'box' stored the picker highlights Box Drill", await dp.$eval('#drillList .drillOpt.sel', e => e.dataset.id) === 'box');
    await dp.click('#drillCancelBtn');
    await dp.evaluate(() => { try { localStorage.setItem('tdt.drill', 'bill'); } catch (e) {} });
    await dp.reload();


    // --- 10b. a run with an alarm, in a fresh session (the run count starts at 0)
    await dp.click('#startBtn'); await dp.waitForTimeout(150);
    await observe();
    await dtouch('touchStart', [REST]);
    d = await waitPhase('live', 4600);
    check('WQ-027: alarm run: the beep came', d.drill && d.drill.phase === 'live', d);
    await dtouch('touchEnd', []); await dmotion(30);
    await wobbleD(80, 15); d = await dst();
    check('WQ-027: alarm run: moving off the frame after the beep alarms', d.alarmActive && d.alarmReason === 'move' && d.drill.phase === 'live', d);
    for (let i = 0; i < 6; i++) await press();
    d = await dst();
    check('WQ-027: alarm run: six shots fired in the alarm still count; the alarm is still on', d.drill.phase === 'finishing' && d.drill.shots === 6 && d.alarmActive, d);
    await dtouch('touchStart', [REST]); await dmotion(4); d = await dst();
    const alarmRes = d.drill.result, alarmRows = await tableRows();
    check('WQ-027: alarm run: results open, withAlarm true, one alarm episode', d.drillResOpen && alarmRes.withAlarm === true && alarmRes.alarms === 1, d);
    check('WQ-027: alarm run: the table has a With alarm row, and every shot fired in the alarm reads alarm',
      alarmRows.some(r => r[0] === 'With alarm') && (alarmRows.find(r => r[0] === 'Shots') || [])[1] === 'alarm · alarm · alarm · alarm · alarm · alarm', alarmRows);
    check('WQ-027: alarm run: Best clean total is a dash when the only run had an alarm', (alarmRows.find(r => /^Best clean/.test(r[0])) || [])[1] === '—', alarmRows);

    // --- 10c. deferred beep: finger off the frame past the longest delay, then back
    await dtouch('touchEnd', []);
    await dp.click('#drillAgain'); await dp.waitForTimeout(100);
    await observe();
    await dtouch('touchStart', [REST]); await dmotion(3);
    await dtouch('touchEnd', []);
    await sleepMotion(4400);                      // longer than the longest delay (4000 ms): the beep is due, the finger is off
    d = await dst();
    check('WQ-027: deferred beep: finger off the frame past the due time: no beep, still standby, no alarm', d.drill.phase === 'standby' && !d.alarmActive && (await dp.evaluate(() => window.__obs.beepT)) === null, d);
    await dtouch('touchStart', [REST]);
    for (let i = 0; i < 30 && (await dp.evaluate(() => window.__obs.beepT)) === null; i++) await dmotion(1);
    const obsD = await dp.evaluate(() => window.__obs), holdD = obsD.beepT - obsD.restBackT;
    check(`WQ-027: deferred beep: it plays 350 ms after the finger returns (${Math.round(holdD)} ms), never in the first 333 ms`,
      obsD.beepT !== null && obsD.restBackT !== null && holdD >= 350 - 17 && holdD <= 350 + 100, obsD);
    for (let i = 0; i < 6; i++) await slowPress();
    await dtouch('touchStart', [REST]); await dmotion(4); d = await dst();
    const cleanRes = d.drill.result, cleanRows = await tableRows();
    check('WQ-027: clean run after an alarm run: not withAlarm, 2 runs', d.drillResOpen && d.drillRuns === 2 && !cleanRes.withAlarm && cleanRes.alarms === 0, d);
    check(`WQ-027: Best clean total is this clean run (${cleanRes.total}), not the faster alarm run (${alarmRes.total})`,
      alarmRes.total < cleanRes.total && (cleanRows.find(r => /^Best clean/.test(r[0])) || [])[1] === (cleanRes.total / 1000).toFixed(2) + ' s', [cleanRows, alarmRes.total, cleanRes.total]);

    // --- 10d. a 180 alarm already sounding at the beep marks the run (D-104)
    await dtouch('touchEnd', []);
    await dp.click('#drillAgain'); await dp.waitForTimeout(100);
    await dmotion(3);
    await dp.click('#downrangeBtn'); await dmotion(3);
    check('WQ-027: 180 run: Set downrange took', (await dst()).refSet === true);
    check('WQ-027: 180 run: swung past 90 degrees with no finger on the frame (unarmed: no alarm yet)',
      await swingD(-120, x => x.dev180 > 95) && !(await dst()).alarmActive);
    await observe();
    await dtouch('touchStart', [REST]);
    d = await waitPhase('live', 4600);
    check('WQ-027: 180 run: the beep came with the 180 alarm sounding', d.drill.phase === 'live' && d.alarmActive && d.alarmReason === '180', d);
    await swingD(120, x => x.dev180 < 30); await dmotion(5); d = await dst();
    check('WQ-027: 180 run: back downrange with the finger on the frame clears the alarm', !d.alarmActive && d.onRest && d.drill.phase === 'live', d);
    for (let i = 0; i < 6; i++) await press();
    await dtouch('touchStart', [REST]); await dmotion(4); d = await dst();
    const r180 = d.drill.result;
    check('WQ-027: 180 run: result.withAlarm is true with one alarm (counted at the beep), shots graded normally',
      d.drillResOpen && r180.withAlarm === true && r180.alarms === 1 && r180.shots.every(x => !x.unsafe), r180);
    check('WQ-027: 180 run: the table has a With alarm row', (await tableRows()).some(r => r[0] === 'With alarm'));
    await dtouch('touchEnd', []);
    await dp.reload();
    await dp.evaluate(() => { try { localStorage.setItem('tdt.drill', 'bill'); } catch (e) {} });
    await dp.reload();

    // --- 11. screenshots and reachability: start screen and picker, both orientations
    for (const [name, vw, vh] of [['landscape', W, H], ['portrait', H, W]]) {
      await dp.setViewportSize({ width: vw, height: vh }); await dp.waitForTimeout(250);
      await dp.$eval('#startOv', e => { e.scrollTop = 0; e.querySelector('.inner').scrollTop = 0; });
      await shoot(path.join(shotDir, `start-${name}.png`));
      const startReach = await inView('#startBtn', vw, vh);
      const drillBtnReach = await inView('#drillBtn', vw, vh);
      check(`WQ-027: ${vw}x${vh}: #startBtn and #drillBtn are fully inside the viewport`, startReach === true && drillBtnReach === true, [startReach, drillBtnReach]);
      await dp.$eval('#startOv', e => { e.scrollTop = 0; });
      await dp.click('#drillBtn'); await dp.waitForTimeout(150);
      check(`WQ-027: ${vw}x${vh}: picker open with Bill highlighted`, (await dst()).pickerOpen && await dp.$eval('#drillList .drillOpt.sel', e => e.dataset.id) === 'bill');
      await dp.$eval('#drillOv', e => { e.scrollTop = 0; });
      await shoot(path.join(shotDir, `picker-${name}.png`));
      const reach = [];
      for (const sel of ['#drillChoose', '#drillCancelBtn']) reach.push(await inView(sel, vw, vh));
      check(`WQ-027: ${vw}x${vh}: #drillChoose and #drillCancelBtn are reachable and not clipped`, reach.every(r => r === true), reach);
      const noHScroll = await dp.evaluate(() => { const o = document.getElementById('drillOv'); return o.scrollWidth <= o.clientWidth + 1; });
      check(`WQ-027: ${vw}x${vh}: the picker has no horizontal overflow`, noHScroll);
      await dp.click('#drillCancelBtn');
    }
    await dp.setViewportSize({ width: W, height: H });
    await dp.close(); await dctx.close();
  }

  // WQ-028: Low Ready (D-96, D-98, D-105, D-106). Fresh context so localStorage and touches start clean.
  {
    const fs = require('fs');
    const shotDir = path.resolve(__dirname, '..', 'docs', 'screenshots', 'wq-028');
    if (process.env.WQ_SCREENSHOTS) fs.mkdirSync(shotDir, { recursive: true });
    const lctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true });
    const lp = await lctx.newPage();
    lp.on('pageerror', e => errors.push('low ready page: ' + e.message));
    await lp.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
    await lp.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await lp.reload();
    const lst = () => lp.evaluate(() => window.__tdt());
    const lcdp = await lctx.newCDPSession(lp);
    const ltouch = (type, pts) => lcdp.send('Input.dispatchTouchEvent', {
      type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, radiusX: 25, radiusY: 25 })) });
    const lmotion = async (n = 1) => {
      for (let i = 0; i < n; i++) {
        await lp.evaluate(() => window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
          rotationRate: { alpha: 0, beta: 0, gamma: 0 }, acceleration: { x: 0, y: 0, z: 0 }, interval: 16 })));
        await lp.waitForTimeout(16);
      }
    };
    const lsleep = async ms => { const t0 = Date.now(); while (Date.now() - t0 < ms) await lmotion(1); };
    const lwobble = async (rate, n) => { for (let i = 0; i < n; i++) {
      const r = i % 2 ? rate : -rate;
      await lp.evaluate(r => window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
        rotationRate: { alpha: r, beta: r, gamma: 0 }, acceleration: { x: 0, y: 0, z: 0 }, interval: 16 })), r);
      await lp.waitForTimeout(16); } };
    const lpress = async () => {                  // one full press: touch the trigger, pull 70 px back, lift; the phone stays still
      // WQ-031 (D-115): CDP keeps a point down until a touchEnd lists it, so touchStart [TRG] alone would add a second
      // finger beside the frame finger (ignored now); lift every point first (throws if none is down).
      await ltouch('touchEnd', []).catch(() => {});
      await ltouch('touchStart', [TRG]); await lmotion(3);
      for (let dx = 20; dx <= 70; dx += 25) { await ltouch('touchMove', [[TRG[0] - dx, TRG[1], 2]]); await lmotion(1); }
      await lmotion(2); await ltouch('touchEnd', []); await lmotion(3);
    };
    const perf = () => lp.evaluate(() => performance.now());
    const lline = () => lp.textContent('#drillLine');
    const lrows = () => lp.$$eval('#drillResRows tr', trs => trs.map(tr => [...tr.children].map(td => td.textContent)));
    const waitS = async (cond, maxMs) => {
      const t0 = Date.now(); let s;
      while (Date.now() - t0 < maxMs) { await lmotion(1); s = await lst(); if (cond(s)) return s; }
      return s;
    };
    const shoot = p => process.env.WQ_SCREENSHOTS ? lp.screenshot({ path: p }) : null;   // PNGs only on request: npm test leaves the tree clean
    const inView = async (sel, vw, vh) => {
      const h = await lp.$(sel); await h.scrollIntoViewIfNeeded();
      const b = await h.boundingBox();
      return b && b.width > 0 && b.height > 0 && b.x >= 0 && b.x + b.width <= vw + 0.5 && b.y >= 0 && b.y + b.height <= vh + 0.5 ? true : b;
    };
    // Page-side frame observer (timestamps from performance.now() of the frame that first shows each change): the beep
    // (rep up), each cue (reps done up; after rep 5 this is the end), each rep shot, the finger coming onto the frame,
    // the results overlay opening, and every distinct drill line text. Independent of the engine's own event times.
    const observeL = () => lp.evaluate(() => {
      window.__lo = { ev: [], lines: [] };
      if (window.__loOn) return; window.__loOn = true;
      let rep = 0, done = 0, cur = 0, rest = false, res = false, line = null;
      const f = () => {
        const s = window.__tdt(), n = performance.now(), o = window.__lo, d = s.drill;
        if (d) {
          if (d.rep > rep) o.ev.push({ k: 'beep', rep: d.rep, n });
          rep = d.rep;
          if (d.repsDone > done) o.ev.push({ k: 'cue', rep: d.repsDone, n });
          done = d.repsDone;
          for (; cur < d.curShots; cur++) o.ev.push({ k: 'shot', rep: d.rep, i: cur + 1, n });
          if (d.curShots < cur) cur = d.curShots;
        } else { rep = done = cur = 0; }
        if (s.onRest && !rest) o.ev.push({ k: 'rest', n });
        rest = s.onRest;
        if (s.drillResOpen && !res) o.ev.push({ k: 'res', n });
        res = s.drillResOpen;
        const l = document.getElementById('drillLine').textContent;
        if (l !== line) { o.lines.push({ l, n }); line = l; }
        requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    });
    const LO = () => lp.evaluate(() => window.__lo);
    const pick = (ev, k, pred = () => true) => ev.find(e => e.k === k && pred(e));
    const pickLast = (ev, k, pred = () => true) => [...ev].reverse().find(e => e.k === k && pred(e));
    const FRM = 17;
    // Finger back on the frame: the stamps around the touch dispatch (a before, b after).
    const fingerBack = async () => { const a = await perf(); await ltouch('touchStart', [REST]); const b = await perf(); return { a, b }; };
    const waitBeep = rep => waitS(x => x.drill && x.drill.rep === rep && x.drill.phase === 'live', 6500);
    const fireTwo = async lag => { if (lag) await lsleep(lag); await lpress(); await lpress(); };
    // The cue (or, after rep 5, the results overlay) must come 750 ms after the finger's last return, measured on the
    // frames the page showed, and not before 750 ms after the touch call returned (20-40 ms browser tolerance).
    const checkCue = async (rep, back, label) => {
      const s = await waitS(x => rep === 5 ? x.drillResOpen : x.drill.repsDone >= rep, 3000);
      const lo = await LO();
      const cue = pickLast(lo.ev, 'cue', e => e.rep === rep), rest = cue && pickLast(lo.ev, 'rest', e => e.n <= cue.n);
      const frames = cue && rest ? cue.n - rest.n : NaN, fromTouch = cue ? cue.n - back.b : NaN, fromBefore = cue ? cue.n - back.a : NaN;
      check(`WQ-028: ${label}: ${rep === 5 ? 'the results open' : 'the cue arrives'} 750 ms (+ one frame) after the last frame showing the finger on the frame (${frames.toFixed(1)} ms; tolerance -1 frame / +max(2 frames, 100 ms) for CPU load)`,
        !!cue && frames >= 750 - FRM && frames <= 750 + Math.max(2 * FRM, 100), [lo.ev.slice(-8), s.drill]);
      check(`WQ-028: ${label}: ... and never earlier than 750 ms (- one frame) after the moment just before the touch call (${fromBefore.toFixed(1)} ms)`,
        !!cue && fromBefore >= 750 - FRM, [back, cue]);
      return { cue, rest, s };
    };
    const startOv = () => lp.$eval('#startOv', e => e.classList.contains('show'));

    // --- 1. picker: order, diagram, remembered choice
    await lp.click('#drillBtn');
    const lids = await lp.$$eval('#drillList .drillOpt', els => els.map(e => e.dataset.id));
    check("WQ-028: picker lists exactly ['freestyle','lowready','box','bill','transitions'] in that order (Transitions joined with WQ-030)", JSON.stringify(lids) === '["freestyle","lowready","box","bill","transitions"]', lids);
    const lnames = await lp.$$eval('#drillList .drillOpt', els => els.map(e => e.textContent));
    check('WQ-028: the Low Ready entry is named Low Ready and carries its subtitle', /Low Ready/.test(lnames[1]) && /Five reps/.test(lnames[1]), lnames);
    const svgFree = await lp.$eval('#drillDiagram', e => e.innerHTML);
    await lp.click('#drillList .drillOpt[data-id="bill"]');
    const svgBillL = await lp.$eval('#drillDiagram', e => e.innerHTML);
    await lp.click('#drillList .drillOpt[data-id="lowready"]');
    const svgLr = await lp.$eval('#drillDiagram', e => e.innerHTML);
    check('WQ-028: highlighting Low Ready moves .sel, shows an <svg> that differs from Freestyle and Bill, and a how-to with the three-beep cue',
      await lp.$eval('#drillList .drillOpt.sel', e => e.dataset.id) === 'lowready' && /^<svg/.test(svgLr.trim()) && svgLr !== svgFree && svgLr !== svgBillL &&
      /three beeps/i.test(await lp.textContent('#drillHow')) && /five reps/i.test(await lp.textContent('#drillHow')), await lp.textContent('#drillHow'));
    check('WQ-028: Low Ready is selectable (not disabled) and Box Drill (WQ-029) is listed and selectable too',
      !(await lp.$eval('#drillList .drillOpt[data-id="lowready"]', e => e.disabled || e.classList.contains('disabled'))) &&
      !!(await lp.$('#drillList .drillOpt[data-id="box"]')) && !(await lp.$eval('#drillList .drillOpt[data-id="box"]', e => e.disabled || e.classList.contains('disabled'))));
    await lp.$eval('#drillOv', e => { e.scrollTop = 0; });
    await shoot(path.join(shotDir, 'picker-landscape.png'));
    for (const sel of ['#drillChoose', '#drillCancelBtn']) { const r = await inView(sel, W, H); check(`WQ-028: ${sel} is inside the 844x390 viewport on the picker`, r === true, r); }
    await lp.setViewportSize({ width: H, height: W }); await lp.waitForTimeout(250);
    await lp.$eval('#drillOv', e => { e.scrollTop = 0; });
    await shoot(path.join(shotDir, 'picker-portrait.png'));
    for (const sel of ['#drillChoose', '#drillCancelBtn']) { const r = await inView(sel, H, W); check(`WQ-028: ${sel} is inside the 390x844 viewport on the picker`, r === true, r); }
    await lp.setViewportSize({ width: W, height: H }); await lp.waitForTimeout(250);
    await lp.click('#drillChoose');
    const lsGet = () => lp.evaluate(() => { try { return localStorage.getItem('tdt.drill'); } catch (e) { return 'ERR'; } });
    check("WQ-028: Choose stores tdt.drill === 'lowready' and the button names Low Ready", await lsGet() === 'lowready' && /Low Ready/.test(await lp.textContent('#drillBtn')) && (await lst()).drillSel === 'lowready');
    await lp.reload();
    check('WQ-028: the Low Ready choice survives a reload', (await lst()).drillSel === 'lowready' && /Low Ready/.test(await lp.textContent('#drillBtn')));

    // --- 2. run 1: five reps. Rep 1 plain, rep 2 finger lifted during the 750 ms, rep 3 finger back after one shot, rep 4 with an alarm, rep 5 plain.
    await lp.click('#startBtn'); await lp.waitForTimeout(150);
    await observeL();
    let d = await lst();
    check('WQ-028: after Start the Low Ready run is in standby: rep 0, nothing done, no shots, no cue pending',
      d.drill && d.drill.id === 'lowready' && d.drill.phase === 'standby' && d.drill.rep === 0 && d.drill.repsDone === 0 && d.drill.curShots === 0 && d.drill.cuePending === false && d.drillRuns === 0, d);
    check('WQ-028: before any touch the line says "Rep 1 of 5 · finger on the frame" and the delay has not started (dueSet false)',
      await lline() === 'Rep 1 of 5 · finger on the frame' && d.drill.dueSet === false, [await lline(), d.drill]);
    await ltouch('touchStart', [REST]); await lmotion(4); d = await lst();
    check('WQ-028: finger on the frame starts the delay: dueSet true, line "Rep 1 of 5 · wait for the beep"',
      d.drill.dueSet === true && d.drill.phase === 'standby' && await lline() === 'Rep 1 of 5 · wait for the beep', [await lline(), d.drill]);
    d = await waitBeep(1);
    let lo = await LO();
    const arm = await lp.evaluate(() => performance.now());   // upper bound only; the observer's first 'rest' frame is the arming frame
    const rest1 = pick(lo.ev, 'rest'), beep1 = pick(lo.ev, 'beep', e => e.rep === 1);
    check(`WQ-028: rep 1: the beep came and the line says "Go — raise and fire two"`, d.drill.phase === 'live' && d.drill.rep === 1 && await lline() === 'Go — raise and fire two', [d.drill, await lline()]);
    check(`WQ-028: rep 1: the beep came 2000-5000 ms (+ one frame) after the finger came onto the frame (${beep1 && rest1 ? (beep1.n - rest1.n).toFixed(0) : '?'} ms)`,
      !!beep1 && !!rest1 && beep1.n - rest1.n >= 2000 - FRM && beep1.n - rest1.n <= 5000 + 2 * FRM, lo.ev);
    // rep 1
    await lsleep(1500);                                         // slow on purpose: the alarm rep (4) must be the fastest
    await lpress(); d = await lst();
    check('WQ-028: rep 1: after one shot the rep is still live with 1 shot, and the line says "Shot 1 of 2 — fire again"',
      d.drill.phase === 'live' && d.drill.curShots === 1 && d.drill.repsDone === 0 && await lline() === 'Shot 1 of 2 — fire again', [d.drill, await lline()]);
    await lpress(); d = await lst();
    check('WQ-028: rep 1: after the second shot the phase is finishing, no cue yet, the line asks for the finger back on the frame',
      d.drill.phase === 'finishing' && d.drill.curShots === 2 && d.drill.cuePending === false && d.drill.repsDone === 0 && await lline() === 'Finger back on the frame', [d.drill, await lline()]);
    let back = await fingerBack(); await lmotion(4); d = await lst();
    check('WQ-028: rep 1: finger on the frame: the cue timer runs ("Hold…")', d.drill.phase === 'finishing' && d.drill.cuePending === true && await lline() === 'Hold…', [d.drill, await lline()]);
    let c = await checkCue(1, back, 'rep 1');
    d = await lst();
    check('WQ-028: after cue 1: standby, rep 1 played, one rep done, line "Rep 2 of 5 · wait for the beep", the run is not over',
      d.drill.phase === 'standby' && d.drill.rep === 1 && d.drill.repsDone === 1 && d.drill.cuePending === false && !d.drillResOpen && d.drillRuns === 0 &&
      await lline() === 'Rep 2 of 5 · wait for the beep', [d.drill, await lline()]);
    // rep 2: restart
    d = await waitBeep(2); lo = await LO();
    let cue1 = pick(lo.ev, 'cue', e => e.rep === 1), beep2 = pick(lo.ev, 'beep', e => e.rep === 2);
    check(`WQ-028: rep 2: the beep came 2000-5000 ms (+ one frame) after cue 1 (${beep2 && cue1 ? (beep2.n - cue1.n).toFixed(0) : '?'} ms)`,
      !!beep2 && !!cue1 && beep2.n - cue1.n >= 2000 - FRM && beep2.n - cue1.n <= 5000 + 2 * FRM, lo.ev);
    await fireTwo(1500);
    const back2a = await fingerBack(); await lsleep(400);       // 400 ms into the 750 ms ...
    await ltouch('touchEnd', []); await lsleep(150);            // ... lift the finger (past the 60 ms contact debounce)
    d = await lst();
    check('WQ-028: rep 2: lifting the finger at ~400 ms clears the cue timer (finishing, nothing pending, no cue)',
      d.drill.phase === 'finishing' && d.drill.cuePending === false && d.drill.repsDone === 1 && await lline() === 'Finger back on the frame', [d.drill, await lline()]);
    const back2 = await fingerBack();
    c = await checkCue(2, back2, 'rep 2 (restarted)');
    lo = await LO();
    const firstRest2 = pickLast(lo.ev, 'rest', e => e.n <= back2a.b + 40), cue2 = pick(lo.ev, 'cue', e => e.rep === 2);
    const secondRest2 = cue2 && pickLast(lo.ev, 'rest', e => e.n <= cue2.n);
    check(`WQ-028: rep 2: no cue between the first return and the lift; the cue is >= 750 ms (- one frame) after the SECOND return frame (${cue2 && secondRest2 ? (cue2.n - secondRest2.n).toFixed(0) : '?'} ms), which is >= 400 ms after the first (${secondRest2 && firstRest2 ? (secondRest2.n - firstRest2.n).toFixed(0) : '?'} ms)`,
      !!cue2 && !!firstRest2 && !!secondRest2 && secondRest2.n - firstRest2.n >= 400 && cue2.n - secondRest2.n >= 750 - FRM &&
      !lo.ev.some(e => e.k === 'cue' && e.rep === 2 && e.n < secondRest2.n), [firstRest2, secondRest2, cue2]);
    // alarm BETWEEN reps (after cue 2, before beep 3): lift the finger and wobble; it clears when the finger returns
    await ltouch('touchEnd', []); await lmotion(18);
    await lwobble(80, 15); d = await lst();
    check('WQ-028: between reps: moving off the frame after cue 2 alarms (standby, rep 2 played, delay running)',
      d.alarmActive && d.alarmReason === 'move' && d.drill.phase === 'standby' && d.drill.rep === 2 && d.drill.dueSet === true, d);
    await fingerBack(); await lmotion(4); d = await lst();
    check('WQ-028: between reps: the alarm clears when the finger returns, before beep 3', !d.alarmActive && d.drill.phase === 'standby' && d.drill.rep === 2, d);
    // rep 3: finger back after only one shot
    d = await waitBeep(3);
    await lsleep(1500);
    await lpress();
    await fingerBack(); await lsleep(1200);
    d = await lst(); lo = await LO();
    check('WQ-028: rep 3: finger back on the frame after ONE shot, held 1.2 s: no cue, nothing pending, still live with 1 shot',
      d.drill.phase === 'live' && d.drill.curShots === 1 && d.drill.cuePending === false && d.drill.repsDone === 2 && !pick(lo.ev, 'cue', e => e.rep === 3) && await lline() === 'Shot 1 of 2 — fire again', [d.drill, await lline()]);
    await ltouch('touchEnd', []); await lmotion(3);
    await lpress(); d = await lst();
    check('WQ-028: rep 3: the second shot moves it to finishing', d.drill.phase === 'finishing' && d.drill.curShots === 2, d.drill);
    back = await fingerBack();
    await checkCue(3, back, 'rep 3 (second shot after the 1.2 s hold)');
    // rep 4: alarm
    d = await waitBeep(4);
    await ltouch('touchEnd', []); await lmotion(18);
    await lwobble(80, 15); d = await lst();
    check('WQ-028: rep 4: moving off the frame after the beep alarms (rep still live)', d.alarmActive && d.alarmReason === 'move' && d.drill.phase === 'live' && d.drill.rep === 4, d);
    await lpress(); await lpress(); d = await lst();
    check('WQ-028: rep 4: two shots in the alarm complete the shot count; the alarm is still on', d.drill.phase === 'finishing' && d.drill.curShots === 2 && d.alarmActive, d);
    back = await fingerBack(); await lmotion(3); d = await lst();
    check('WQ-028: rep 4: finger back on the frame silences the alarm and starts the 750 ms', !d.alarmActive && d.drill.cuePending === true, d);
    await checkCue(4, back, 'rep 4 (alarm)');
    // rep 5
    d = await waitBeep(5);
    await fireTwo(1500);
    back = await fingerBack();
    await checkCue(5, back, 'rep 5 (the end)');
    await lmotion(4); d = await lst(); lo = await LO();
    check('WQ-028: after rep 5: results open, one run, the engine is paused, phase ended, five reps done, no drillCancel path taken',
      d.drillResOpen && d.drillRuns === 1 && d.paused === true && d.drill.phase === 'ended' && d.drill.repsDone === 5 && d.drill.result && d.drill.result.reps.length === 5, d);
    const texts = lo.lines.map(x => x.l);
    for (const [name, re] of [['standby before the touch', /^Rep 1 of 5 · finger on the frame$/], ['standby, rep 1', /^Rep 1 of 5 · wait for the beep$/], ['standby, rep 2', /^Rep 2 of 5 · wait for the beep$/], ['standby, rep 5', /^Rep 5 of 5 · wait for the beep$/],
      ['live, no shot', /^Go — raise and fire two$/], ['live, one shot', /^Shot 1 of 2 — fire again$/], ['finishing', /^Finger back on the frame$/], ['hold', /^Hold…$/]]) {
      check(`WQ-028: the drill line showed ${name}`, texts.some(x => re.test(x)), texts);
    }
    // independent per-rep figures from the observed frames
    const per = [1, 2, 3, 4, 5].map(rp => {
      const b = pick(lo.ev, 'beep', e => e.rep === rp), s1 = pick(lo.ev, 'shot', e => e.rep === rp && e.i === 1), s2 = pick(lo.ev, 'shot', e => e.rep === rp && e.i === 2);
      return { reaction: s1 && b ? (s1.n - b.n) / 1000 : NaN, split: s2 && s1 ? (s2.n - s1.n) / 1000 : NaN };
    });
    const endEv = pick(lo.ev, 'res'), b1 = pick(lo.ev, 'beep', e => e.rep === 1);
    const rows = await lrows(), res = d.drill.result;
    const rowOf = k => (rows.find(r => r[0] === k) || [])[1];
    check('WQ-028: results table: rows Rep 1..Rep 5, Total, Average reaction, Best reaction, With alarm, Best average reaction (in that order)',
      JSON.stringify(rows.map(r => r[0])) === JSON.stringify(['Rep 1', 'Rep 2', 'Rep 3', 'Rep 4', 'Rep 5', 'Total', 'Average reaction (reps with no alarm)', 'Best reaction (reps with no alarm)', 'With alarm', 'Best average reaction this session (runs with no alarm)']), rows);
    check('WQ-028: results title says Low Ready', /Low Ready/.test(await lp.textContent('#drillResTitle')));
    const parse = v => { const m = /^reaction (\d+\.\d\d) s · split (\d*\.\d\d) s · (.*)$/.exec(v || ''); return m && { reaction: +m[1], split: +m[2], grades: m[3] }; };
    for (let i = 0; i < 5; i++) {
      const p = parse(rowOf(`Rep ${i + 1}`));
      check(`WQ-028: Rep ${i + 1} row: reaction ${p && p.reaction} s / split ${p && p.split} s match the observed frames (${per[i].reaction.toFixed(3)} / ${per[i].split.toFixed(3)}) within 40 ms`,
        !!p && Math.abs(p.reaction - per[i].reaction) <= 0.04 && Math.abs(p.split - per[i].split) <= 0.04, [rows[i], per[i]]);
    }
    check('WQ-028: Rep 4 row ends with "alarm" and lists alarm for both shots; Rep 3 (alarm between the reps) ends with "alarm" but its shots are graded; reps 1, 2, 5 have no alarm mark',
      /alarm, alarm · alarm$/.test(rowOf('Rep 4')) && /Clean, Clean · alarm$/.test(rowOf('Rep 3')) && [1, 2, 5].every(n => !/alarm/.test(rowOf(`Rep ${n}`)) && /(Clean|Moved|Jerked)/.test(rowOf(`Rep ${n}`))), rows);
    check(`WQ-028: Total is rep 1's beep to the end, from the observed frames (${endEv && b1 ? ((endEv.n - b1.n) / 1000).toFixed(3) : '?'} s), within 40 ms`,
      /^\d+\.\d\d s$/.test(rowOf('Total') || '') && !!endEv && !!b1 && Math.abs(parseFloat(rowOf('Total')) - (endEv.n - b1.n) / 1000) <= 0.04, [rowOf('Total'), endEv, b1]);
    const cleanR = [0, 1, 4].map(i => per[i].reaction);
    check(`WQ-028: Average / Best reaction cover the three reps with no alarm (1, 2, 5; observed mean ${(cleanR.reduce((x, y) => x + y, 0) / 3).toFixed(3)}, min ${Math.min(...cleanR).toFixed(3)}; alarm rep ${per[3].reaction.toFixed(3)} s is faster and excluded)`,
      /^\d+\.\d\d s$/.test(rowOf('Average reaction (reps with no alarm)') || '') && /^\d+\.\d\d s$/.test(rowOf('Best reaction (reps with no alarm)') || '') &&
      per[3].reaction < Math.min(...cleanR) - 0.2 &&
      Math.abs(parseFloat(rowOf('Average reaction (reps with no alarm)')) - cleanR.reduce((x, y) => x + y, 0) / 3) <= 0.04 &&
      Math.abs(parseFloat(rowOf('Best reaction (reps with no alarm)')) - Math.min(...cleanR)) <= 0.04, [rows, per]);
    check('WQ-028: result: reps 3 (alarm between reps) and 4 (alarm in the rep) are marked; the run counts two alarms; the figures exclude both',
      res.reps.map(p => p.withAlarm).join() === 'false,false,true,true,false' && res.withAlarm === true && res.alarms === 2 && res.reps[2].alarms === 1 && res.reps[3].alarms === 1 &&
      res.bestReaction > res.reps[3].reaction && res.avgReaction > res.reps[3].reaction, res);
    check('WQ-028: With alarm row appears and names two alarms; Best average reaction is a dash (the only run had an alarm)',
      /^2 alarms/.test(rowOf('With alarm') || '') && rowOf('Best average reaction this session (runs with no alarm)') === '—', rows);
    check('WQ-028: shots per rep 2, 2, 2, 2, 2 (the one-shot rep got its second shot) and no early shots', res.reps.map(p => p.shots.length).join() === '2,2,2,2,2' && res.early === 0, res.reps);
    await shoot(path.join(shotDir, 'results-landscape.png'));
    for (const sel of ['#drillAgain', '#drillChange']) { const r = await inView(sel, W, H); check(`WQ-028: ${sel} is inside the 844x390 viewport on the Low Ready results`, r === true, r); }
    await lp.evaluate(() => document.fullscreenElement ? document.exitFullscreen() : null); await lp.waitForTimeout(200);
    await lp.setViewportSize({ width: H, height: W }); await lp.waitForTimeout(250);
    for (const sel of ['#drillAgain', '#drillChange']) { const r = await inView(sel, H, W); check(`WQ-028: ${sel} is inside the 390x844 viewport on the Low Ready results`, r === true, r); }
    await lp.$eval('#drillResOv', e => { e.scrollTop = 0; });
    await shoot(path.join(shotDir, 'results-portrait.png'));
    const hs = await lp.evaluate(() => { const o = document.getElementById('drillResOv'); return o.scrollWidth <= o.clientWidth + 1; });
    check('WQ-028: the results have no horizontal overflow at 390x844', hs);
    await lp.setViewportSize({ width: W, height: H }); await lp.waitForTimeout(250);

    // --- 3. Again: standby, run count kept; gear between reps cancels and loses the reps (D-105); an early shot joins the next rep
    await ltouch('touchEnd', []);
    await lp.click('#drillAgain'); await lp.waitForTimeout(100);
    d = await lst();
    check('WQ-028: Again: results closed, new run in standby at rep 0, run count stays 1, line "Rep 1 of 5 · finger on the frame"',
      !d.drillResOpen && d.drill.phase === 'standby' && d.drill.rep === 0 && d.drill.repsDone === 0 && d.drillRuns === 1 && d.running && await lline() === 'Rep 1 of 5 · finger on the frame', [d, await lline()]);
    await observeL();
    await ltouch('touchStart', [REST]);
    d = await waitBeep(1); await fireTwo(0); await fingerBack(); await lmotion(5); d = await lst();
    check('WQ-028: run 2: two shots fired, finger back, the cue timer runs (finishing, cuePending)', d.drill.phase === 'finishing' && d.drill.cuePending === true && d.drill.repsDone === 0, d.drill);
    await lp.click('#gear'); await lp.waitForTimeout(120);
    d = await lst();
    check('WQ-028: gear while the cue timer runs cancels: paused, cuePending false, rep 0, repsDone 0, standby, no cue played',
      d.paused && d.drill.phase === 'standby' && d.drill.cuePending === false && d.drill.rep === 0 && d.drill.repsDone === 0 && d.drill.curShots === 0 &&
      !pick((await LO()).ev, 'cue'), d);
    await lp.click('#doneBtn'); await lp.waitForTimeout(100);
    check('WQ-028: after Resume the cue timer is gone (cuePending false) and the line says Cancelled', (await lst()).drill.cuePending === false && /^Cancelled/.test(await lline()), [await lline(), (await lst()).drill]);
    await ltouch('touchEnd', []); await lmotion(2); await ltouch('touchStart', [REST]);
    d = await waitBeep(1); await fireTwo(0); back = await fingerBack(); await checkCue(1, back, 'run 2, rep 1');
    d = await lst();
    check('WQ-028: run 2: between reps (cue 1 played, standby, delay running)', d.drill.phase === 'standby' && d.drill.rep === 1 && d.drill.repsDone === 1 && d.armed && d.onRest, d);
    await lp.click('#gear'); await lp.waitForTimeout(120);
    d = await lst();
    check('WQ-028: gear between reps cancels the run: engine paused, back to rep 0 with no reps done (D-105)',
      await lp.$eval('#settingsOv', e => e.classList.contains('show')) && d.paused && d.drill.phase === 'standby' && d.drill.rep === 0 && d.drill.repsDone === 0 && d.drill.curShots === 0 && d.drillRuns === 1, d);
    await lp.click('#doneBtn'); await lp.waitForTimeout(100);
    check('WQ-028: after Resume the line says Cancelled and to restart', /^Cancelled/.test(await lline()) && /restart/i.test(await lline()), await lline());
    await ltouch('touchEnd', []); await lmotion(2);
    await ltouch('touchStart', [REST]); await lmotion(5);
    await ltouch('touchEnd', []); await lmotion(2);
    await lpress();                                              // a shot before rep 1's beep (the delay is >= 2 s): early
    d = await lst();
    check('WQ-028: a shot before rep 1\'s beep is early: run early 1, standby, rep 0', d.drill.phase === 'standby' && d.drill.early === 1 && d.drill.rep === 0 && d.drill.curShots === 0, d.drill);
    await ltouch('touchStart', [REST]);
    d = await waitBeep(1);
    check('WQ-028: after the cancel the run restarts at rep 1: a fresh beep, 0 reps done, line "Go — raise and fire two" (no Cancelled)',
      d.drill.rep === 1 && d.drill.repsDone === 0 && await lline() === 'Go — raise and fire two', [d.drill, await lline()]);
    await fireTwo(0); back = await fingerBack(); await checkCue(1, back, 'run 2 after the cancel, rep 1');
    await lmotion(2); await ltouch('touchEnd', []); await lmotion(2);
    await lpress();                                              // a shot before rep 2's beep (the delay is >= 2 s): early
    d = await lst();
    check('WQ-028: a shot between the cue and the next beep is early: run early 2 (with the one before rep 1), still standby, no rep shot', d.drill.phase === 'standby' && d.drill.early === 2 && d.drill.curShots === 0 && d.drill.rep === 1, d.drill);
    await ltouch('touchStart', [REST]);
    d = await waitBeep(2); await fireTwo(0); back = await fingerBack(); await checkCue(2, back, 'run 2, rep 2');
    for (const rp of [3, 4, 5]) { d = await waitBeep(rp); await fireTwo(0); if (rp === 3) { await lpress(); d = await lst(); check('WQ-028: run 2 rep 3: a third shot joins the rep (finishing, 3 shots, no cue yet)', d.drill.phase === 'finishing' && d.drill.curShots === 3 && d.drill.repsDone === 2, d.drill); } back = await fingerBack(); await checkCue(rp, back, `run 2, rep ${rp}`); }
    d = await lst();
    const rows2 = await lrows(), r2 = d.drill.result;
    check('WQ-028: run 2 ends with the results open and 2 runs; clean run: no With alarm row', d.drillResOpen && d.drillRuns === 2 && !rows2.some(r => r[0] === 'With alarm') && r2.withAlarm === false, [d.drillRuns, rows2]);
    check('WQ-028: the early shots show on Rep 1 and Rep 2 ("early 1") and as an Early shots row of 2; the other reps carry none',
      / · early 1$/.test((rows2.find(r => r[0] === 'Rep 2') || [])[1] || '') && / · early 1$/.test((rows2.find(r => r[0] === 'Rep 1') || [])[1] || '') &&
      [3, 4, 5].every(n => !/early/.test((rows2.find(r => r[0] === `Rep ${n}`) || [])[1])) &&
      rows2.some(r => /^Early shots/.test(r[0]) && r[1] === '2') && r2.reps.map(p => p.early).join() === '1,1,0,0,0' && r2.early === 2, [rows2, r2.reps.map(p => p.early)]);
    check('WQ-028: three shots in rep 3 list three grades (and the other reps two), with no extra cue',
      /Clean, Clean, Clean$/.test((rows2.find(r => r[0] === 'Rep 3') || [])[1] || '') && r2.reps.map(p => p.shots.length).join() === '2,2,3,2,2' && !rows2.some(r => /^Rep 6/.test(r[0])), [rows2, r2.reps.map(p => p.shots.length)]);
    const lo2 = await LO(), b1b = pickLast(lo2.ev, 'beep', e => e.rep === 1), endB = pickLast(lo2.ev, 'res');
    const avg2 = [1, 2, 3, 4, 5].map(rp => { const b = pickLast(lo2.ev, 'beep', e => e.rep === rp), s1 = pickLast(lo2.ev, 'shot', e => e.rep === rp && e.i === 1); return b && s1 ? (s1.n - b.n) / 1000 : NaN; });
    const avg2v = avg2.reduce((x, y) => x + y, 0) / 5;
    check(`WQ-028: run 2 Total matches the observed frames, and its Average reaction (${avg2v.toFixed(3)} s from the observer) is the session's Best average reaction (run 1 had an alarm and is excluded)`,
      b1b && endB && Math.abs(parseFloat((rows2.find(r => r[0] === 'Total') || [])[1]) - (endB.n - b1b.n) / 1000) <= 0.04 &&
      Math.abs(parseFloat((rows2.find(r => /^Average reaction/.test(r[0])) || [])[1]) - avg2v) <= 0.04 &&
      Math.abs(parseFloat((rows2.find(r => /^Best average reaction/.test(r[0])) || [])[1]) - avg2v) <= 0.04 &&
      (rows2.find(r => /^Best average reaction/.test(r[0])) || [])[1] === (rows2.find(r => /^Average reaction/.test(r[0])) || [])[1], [rows2, avg2]);

    // --- 4. Change drill
    await ltouch('touchEnd', []);
    await lp.click('#drillChange'); await lp.waitForTimeout(100);
    d = await lst();
    check('WQ-028: Change drill: trainer stopped, start screen shown, results closed, drill is null; the stored choice stays Low Ready',
      d.running === false && d.drill === null && !d.drillResOpen && await startOv() && await lsGet() === 'lowready', d);
    await lp.close(); await lctx.close();
  }

  // WQ-029: Box Drill (D-95, D-98, D-107). Fresh context so localStorage and touches start clean.
  {
    const fs = require('fs');
    const shotDir = path.resolve(__dirname, '..', 'docs', 'screenshots', 'wq-029');
    if (process.env.WQ_SCREENSHOTS) fs.mkdirSync(shotDir, { recursive: true });
    const bctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true });
    const bp = await bctx.newPage();
    bp.on('pageerror', e => errors.push('box page: ' + e.message));
    await bp.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
    await bp.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await bp.reload();
    const bst = () => bp.evaluate(() => window.__tdt());
    const bcdp = await bctx.newCDPSession(bp);
    const btouch = (type, pts) => bcdp.send('Input.dispatchTouchEvent', {
      type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, radiusX: 25, radiusY: 25 })) });
    const bmotion = async (n = 1) => {
      for (let i = 0; i < n; i++) {
        await bp.evaluate(() => window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
          rotationRate: { alpha: 0, beta: 0, gamma: 0 }, acceleration: { x: 0, y: 0, z: 0 }, interval: 16 })));
        await bp.waitForTimeout(16);
      }
    };
    const bsleep = async ms => { const t0 = Date.now(); while (Date.now() - t0 < ms) await bmotion(1); };
    const bwobble = async (rate, n) => { for (let i = 0; i < n; i++) {
      const r = i % 2 ? rate : -rate;
      await bp.evaluate(r => window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
        rotationRate: { alpha: r, beta: r, gamma: 0 }, acceleration: { x: 0, y: 0, z: 0 }, interval: 16 })), r);
      await bp.waitForTimeout(16); } };
    const bpress = async () => {                  // one full press: touch the trigger, pull 70 px back, lift; the phone stays still
      // WQ-031 (D-115): CDP keeps a point down until a touchEnd lists it, so touchStart [TRG] alone would add a second
      // finger beside the frame finger (ignored now); lift every point first (throws if none is down).
      await btouch('touchEnd', []).catch(() => {});
      await btouch('touchStart', [TRG]); await bmotion(3);
      for (let dx = 20; dx <= 70; dx += 25) { await btouch('touchMove', [[TRG[0] - dx, TRG[1], 2]]); await bmotion(1); }
      await bmotion(2); await btouch('touchEnd', []); await bmotion(3);
    };
    const bline = () => bp.textContent('#drillLine');
    const brows = () => bp.$$eval('#drillResRows tr', trs => trs.map(tr => [...tr.children].map(td => td.textContent)));
    const waitS = async (cond, maxMs) => {
      const t0 = Date.now(); let s;
      while (Date.now() - t0 < maxMs) { await bmotion(1); s = await bst(); if (cond(s)) return s; }
      return s;
    };
    const shoot = p => process.env.WQ_SCREENSHOTS ? bp.screenshot({ path: p }) : null;   // PNGs only on request: npm test leaves the tree clean
    const inView = async (sel, vw, vh) => {
      const h = await bp.$(sel); await h.scrollIntoViewIfNeeded();
      const b = await h.boundingBox();
      return b && b.width > 0 && b.height > 0 && b.x >= 0 && b.x + b.width <= vw + 0.5 && b.y >= 0 && b.y + b.height <= vh + 0.5 ? true : b;
    };
    // Page-side frame observer (timestamps from performance.now() of the frame that first shows each change): the beep
    // (rep 0 -> 1), each cue (positions done up), each shot of a position, the finger coming onto the frame, the results
    // overlay opening, and every distinct drill line text. Independent of the engine's own event times.
    const observeB = () => bp.evaluate(() => {
      window.__bo = { ev: [], lines: [] };
      if (window.__boOn) return; window.__boOn = true;
      let rep = 0, done = 0, cur = 0, rest = false, res = false, line = null;
      const f = () => {
        const s = window.__tdt(), n = performance.now(), o = window.__bo, d = s.drill;
        if (d) {
          if (d.rep === 1 && rep === 0) o.ev.push({ k: 'beep', n });
          if (d.rep !== rep) cur = 0;
          rep = d.rep;
          if (d.repsDone > done) o.ev.push({ k: 'cue', rep: d.repsDone, n });
          done = d.repsDone;
          for (; cur < d.curShots; cur++) o.ev.push({ k: 'shot', rep: d.rep, i: cur + 1, n });
          if (d.curShots < cur) cur = d.curShots;
        } else { rep = done = cur = 0; }
        if (s.onRest && !rest) o.ev.push({ k: 'rest', n });
        rest = s.onRest;
        if (s.drillResOpen && !res) o.ev.push({ k: 'res', n });
        res = s.drillResOpen;
        const l = document.getElementById('drillLine').textContent;
        if (l !== line) { o.lines.push({ l, n }); line = l; }
        requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    });
    const BO = () => bp.evaluate(() => window.__bo);
    const pick = (ev, k, pred = () => true) => ev.find(e => e.k === k && pred(e));
    const FRM = 17, FR = 20;
    const perf = () => bp.evaluate(() => performance.now());
    const fingerBack = async () => { const a = await perf(); await btouch('touchStart', [REST]); const b = await perf(); return { a, b }; };
    const startNextSpot = async () => { await btouch('touchEnd', []); await bmotion(3); };   // walk done: finger off the frame to fire
    const waitBeep = () => waitS(x => x.drill && x.drill.rep === 1 && x.drill.phase === 'live', 6500);
    // Fire n shots at the current spot with the finger off the frame, then the finger back on the frame.
    const fireN = async n => { await startNextSpot(); for (let i = 0; i < n; i++) await bpress(); };
    // A cue (repsDone === k): same frame as the finger's return, after two or more shots at the spot.
    const checkCue = async (k, label) => {
      const s = await waitS(x => x.drill.repsDone >= k, 1500);
      const lo = await BO();
      const cue = pick(lo.ev, 'cue', e => e.rep === k), rest = cue && [...lo.ev].reverse().find(e => e.k === 'rest' && e.n <= cue.n + 1);
      const shots = lo.ev.filter(e => e.k === 'shot' && e.rep === k && e.n <= cue.n).length;
      check(`WQ-029: ${label}: the cue frame is the finger-return frame (${cue && rest ? (cue.n - rest.n).toFixed(1) : '?'} ms apart, within one frame) and at least two shots came before it (${shots})`,
        !!cue && !!rest && Math.abs(cue.n - rest.n) <= FR && shots >= 2, [lo.ev.slice(-10), s.drill]);
      return cue;
    };
    const startOv = () => bp.$eval('#startOv', e => e.classList.contains('show'));
    const lsGet = () => bp.evaluate(() => { try { return localStorage.getItem('tdt.drill'); } catch (e) { return 'ERR'; } });

    // --- 1. picker: order, Box entry and diagram, screenshots, bounding boxes
    await bp.click('#drillBtn');
    const bids = await bp.$$eval('#drillList .drillOpt', els => els.map(e => e.dataset.id));
    check("WQ-029: picker lists exactly ['freestyle','lowready','box','bill','transitions'] in D-93 + D-112 a order (Transitions joined with WQ-030)", JSON.stringify(bids) === '["freestyle","lowready","box","bill","transitions"]', bids);
    const bnames = await bp.$$eval('#drillList .drillOpt', els => els.map(e => e.textContent));
    check('WQ-029: the third entry is named Box Drill with its subtitle', /Box Drill/.test(bnames[2]) && /Four corners/.test(bnames[2]), bnames);
    const svgs = {};
    for (const id of ['freestyle', 'lowready', 'bill', 'box']) { await bp.click(`#drillList .drillOpt[data-id="${id}"]`); svgs[id] = await bp.$eval('#drillDiagram', e => e.innerHTML); }
    check('WQ-029: highlighting Box Drill moves .sel and shows its own <svg> (the box diagram, different from the other three), selectable',
      await bp.$eval('#drillList .drillOpt.sel', e => e.dataset.id) === 'box' && /^<svg/.test(svgs.box.trim()) && /fire 2 or more/.test(svgs.box) &&
      ['freestyle', 'lowready', 'bill'].every(k => svgs[k] !== svgs.box) && !(await bp.$eval('#drillList .drillOpt[data-id="box"]', e => e.disabled || e.classList.contains('disabled'))));
    const howBox = await bp.textContent('#drillHow');
    check('WQ-029: the Box how-to mentions the four spots, the three beeps and finishing back at spot 1', /four spots/i.test(howBox) && /three beeps/i.test(howBox) && /spot 1/i.test(howBox), howBox);
    for (const [name, vw, vh] of [['landscape', W, H], ['portrait', H, W]]) {
      await bp.setViewportSize({ width: vw, height: vh }); await bp.waitForTimeout(250);
      await bp.$eval('#drillOv', e => { e.scrollTop = 0; });
      await shoot(path.join(shotDir, `picker-${name}.png`));
      const reach = [];
      for (const sel of ['#drillChoose', '#drillCancelBtn']) reach.push(await inView(sel, vw, vh));
      check(`WQ-029: ${vw}x${vh}: #drillChoose and #drillCancelBtn are reachable and not clipped on the Box picker`, reach.every(r => r === true), reach);
      const noH = await bp.evaluate(() => { const o = document.getElementById('drillOv'); return o.scrollWidth <= o.clientWidth + 1; });
      check(`WQ-029: ${vw}x${vh}: the Box picker has no horizontal overflow`, noH);
      const svgBox = await bp.$eval('#drillDiagram svg', e => { const b = e.getBoundingClientRect(); return { x: b.x, r: b.right, w: b.width, h: b.height }; });
      check(`WQ-029: ${vw}x${vh}: the box diagram is fully inside the viewport and has a size`, svgBox.x >= 0 && svgBox.r <= vw + 0.5 && svgBox.w > 100 && svgBox.h > 50, svgBox);
    }
    await bp.setViewportSize({ width: W, height: H }); await bp.waitForTimeout(250);
    await bp.click('#drillChoose');
    check("WQ-029: Choose stores tdt.drill === 'box' and the button names Box Drill", await lsGet() === 'box' && /Box Drill/.test(await bp.textContent('#drillBtn')) && (await bst()).drillSel === 'box');
    await bp.reload();
    check('WQ-029: the Box choice survives a reload', (await bst()).drillSel === 'box' && /Box Drill/.test(await bp.textContent('#drillBtn')));

    // --- 2. run 1 (alarm at spot 4): spot 1 plain, spot 2 three shots after a walk with the phone shaking (finger on the frame),
    //        spot 3 finger back after ONE shot, spot 4 with an alarm, spot 5 plain.
    await bp.click('#startBtn'); await bp.waitForTimeout(150);
    await observeB();
    let d = await bst();
    check('WQ-029: after Start the Box run is in standby: rep 0, nothing done, no shots, line "Box Drill · finger on the frame, wait for the beep"',
      d.drill && d.drill.id === 'box' && d.drill.phase === 'standby' && d.drill.rep === 0 && d.drill.repsDone === 0 && d.drill.curShots === 0 && d.drillRuns === 0 &&
      await bline() === 'Box Drill · finger on the frame, wait for the beep', [d.drill, await bline()]);
    await btouch('touchStart', [REST]); await bmotion(4);
    d = await waitBeep();
    let lo = await BO();
    const rest1 = pick(lo.ev, 'rest'), beep1 = pick(lo.ev, 'beep');
    check(`WQ-029: the beep came 1000-4000 ms (+ one frame) after the finger came onto the frame (${beep1 && rest1 ? (beep1.n - rest1.n).toFixed(0) : '?'} ms); the line says "Spot 1 of 5 · fire 2 or more"`,
      !!beep1 && !!rest1 && beep1.n - rest1.n >= 1000 - FRM && beep1.n - rest1.n <= 4000 + 2 * FRM && await bline() === 'Spot 1 of 5 · fire 2 or more', [lo.ev, await bline()]);
    await bsleep(1500);
    await startNextSpot(); await bpress(); d = await bst();
    check('WQ-029: spot 1: after one shot still live with 1 shot, line "Spot 1 · shot 1 of 2"',
      d.drill.phase === 'live' && d.drill.rep === 1 && d.drill.curShots === 1 && await bline() === 'Spot 1 · shot 1 of 2', [d.drill, await bline()]);
    await bpress(); d = await bst();
    check('WQ-029: spot 1: the second shot gives phase finishing, no cue yet, line "Finger on the frame to move"',
      d.drill.phase === 'finishing' && d.drill.curShots === 2 && d.drill.repsDone === 0 && await bline() === 'Finger on the frame to move', [d.drill, await bline()]);
    await fingerBack(); await bmotion(3);
    await checkCue(1, 'spot 1');
    d = await bst();
    check('WQ-029: after cue 1: spot 2 is live at once (rep 2, 0 shots, no beep, nothing pending), line "Move to spot 2 · fire 2 or more", one position done',
      d.drill.phase === 'live' && d.drill.rep === 2 && d.drill.curShots === 0 && d.drill.repsDone === 1 && d.drill.cuePending === false && !d.drillResOpen && d.drillRuns === 0 &&
      await bline() === 'Move to spot 2 · fire 2 or more', [d.drill, await bline()]);
    // spot 2: the walk is the phone shaking with the finger on the frame: no alarm; three shots
    await bwobble(80, 15); d = await bst();
    check('WQ-029: walking to spot 2 (phone shaking, finger on the frame): no alarm, still live with no shots', !d.alarmActive && d.drill.phase === 'live' && d.drill.rep === 2 && d.drill.curShots === 0, d);
    await bsleep(800);
    await fireN(3); d = await bst();
    check('WQ-029: spot 2: a third shot joins the position (finishing, 3 shots, still no cue)', d.drill.phase === 'finishing' && d.drill.curShots === 3 && d.drill.repsDone === 1, d.drill);
    await fingerBack(); await bmotion(3);
    await checkCue(2, 'spot 2 (three shots)');
    d = await bst();
    check('WQ-029: after cue 2: spot 3 live, line "Move to spot 3 · fire 2 or more"', d.drill.rep === 3 && d.drill.phase === 'live' && d.drill.repsDone === 2 && await bline() === 'Move to spot 3 · fire 2 or more', [d.drill, await bline()]);
    // spot 3: finger back after ONE shot
    await bsleep(800);
    await fireN(1);
    await fingerBack(); await bsleep(1200);
    d = await bst(); lo = await BO();
    check('WQ-029: spot 3: finger back on the frame after ONE shot, held 1.2 s: no cue, nothing pending, still live with 1 shot, line "Spot 3 · shot 1 of 2"',
      d.drill.phase === 'live' && d.drill.curShots === 1 && d.drill.cuePending === false && d.drill.repsDone === 2 && d.drill.rep === 3 && !pick(lo.ev, 'cue', e => e.rep === 3) && await bline() === 'Spot 3 · shot 1 of 2', [d.drill, await bline()]);
    await fireN(1); d = await bst();
    check('WQ-029: spot 3: the second shot moves it to finishing', d.drill.phase === 'finishing' && d.drill.curShots === 2, d.drill);
    await fingerBack(); await bmotion(3);
    await checkCue(3, 'spot 3 (second shot after the 1.2 s hold)');
    // spot 4: alarm (finger off the frame, phone shaken), shots fired in the alarm, finger back silences it
    await bsleep(600);
    await btouch('touchEnd', []); await bmotion(18);
    await bwobble(80, 15); d = await bst();
    check('WQ-029: spot 4: moving off the frame alarms (position still live)', d.alarmActive && d.alarmReason === 'move' && d.drill.phase === 'live' && d.drill.rep === 4, d);
    await bpress(); await bpress(); d = await bst();
    check('WQ-029: spot 4: two shots in the alarm, finishing, alarm still on', d.drill.phase === 'finishing' && d.drill.curShots === 2 && d.alarmActive, d);
    await fingerBack(); await bmotion(3); d = await bst();
    check('WQ-029: spot 4: the finger back on the frame silences the alarm', !d.alarmActive, d);
    await checkCue(4, 'spot 4 (alarm)');
    d = await bst();
    check('WQ-029: after cue 4: spot 5 live, line "Back at spot 1 · fire 2 or more"', d.drill.rep === 5 && d.drill.phase === 'live' && await bline() === 'Back at spot 1 · fire 2 or more', [d.drill, await bline()]);
    await bsleep(800);
    await startNextSpot(); await bpress(); d = await bst();
    check('WQ-029: spot 5: after one shot the line reads "Spot 1 (last) · shot 1 of 2"', d.drill.curShots === 1 && await bline() === 'Spot 1 (last) · shot 1 of 2', [d.drill, await bline()]);
    await bpress(); d = await bst();
    check('WQ-029: spot 5: after two shots finishing, the line reads "Finger on the frame to finish", no results yet', d.drill.phase === 'finishing' && !d.drillResOpen && await bline() === 'Finger on the frame to finish', [d.drill, await bline()]);
    await fingerBack(); await bmotion(4); d = await bst(); lo = await BO();
    // The observer counts finished positions (repsDone): positions 1-4 end in a cue, position 5 ends the run in the same frame as the results opening.
    check('WQ-029: finger back at spot 5: results open, 1 run, engine paused, phase ended, five positions done; positions 1-4 each finished in their own frame, position 5 in the frame the results opened',
      d.drillResOpen === true && d.drillRuns === 1 && d.paused === true && d.drill.phase === 'ended' && d.drill.repsDone === 5 && d.drill.result && d.drill.result.reps.length === 5 &&
      lo.ev.filter(e => e.k === 'cue').map(e => e.rep).join() === '1,2,3,4,5' && Math.abs(pick(lo.ev, 'cue', e => e.rep === 5).n - pick(lo.ev, 'res').n) <= FR, [d, lo.ev.filter(e => e.k === 'cue')]);
    const lines1 = lo.lines.map(x => x.l);
    const rows = await brows(), res = d.drill.result, rowOf = k => (rows.find(r => r[0] === k) || [])[1];
    check('WQ-029: results title says Box Drill; rows Spot 1, Spot 2, Spot 3, Spot 4, Spot 1 (last), Total (beep to last shot), With alarm, Best clean total this session (in that order)',
      /Box Drill/.test(await bp.textContent('#drillResTitle')) &&
      JSON.stringify(rows.map(r => r[0])) === JSON.stringify(['Spot 1', 'Spot 2', 'Spot 3', 'Spot 4', 'Spot 1 (last)', 'Total (beep to last shot)', 'With alarm', 'Best clean total this session']), rows);
    // figures against the observer frames
    const fr = (k, pred) => pick(lo.ev, k, pred);
    const beepN = fr('beep').n, cueN = k => fr('cue', e => e.rep === k).n, shotN = (rp, i) => fr('shot', e => e.rep === rp && e.i === i).n;
    const startN = rp => rp === 1 ? beepN : cueN(rp - 1);
    const parse = v => { const m = /^time (\d+\.\d\d) s · (?:split (\d*\.\d\d) s|splits ((?:\d*\.\d\d)(?: · \d*\.\d\d)+) s) · (.*)$/.exec(v || ''); return m && { time: +m[1], splits: (m[2] ? [m[2]] : m[3].replace(/ s$/, '').split(' · ')).map(Number), grades: m[4] }; };
    const nShots = { 1: 2, 2: 3, 3: 2, 4: 2, 5: 2 };
    for (let rp = 1; rp <= 5; rp++) {
      const label = rp === 5 ? 'Spot 1 (last)' : `Spot ${rp}`, p = parse(rowOf(label));
      const expT = (shotN(rp, 1) - startN(rp)) / 1000, expS = []; for (let i = 2; i <= nShots[rp]; i++) expS.push((shotN(rp, i) - shotN(rp, i - 1)) / 1000);
      check(`WQ-029: "${label}" row: time ${p && p.time} s / splits ${p && p.splits.join(' ')} match the observed frames (${expT.toFixed(3)} / ${expS.map(x => x.toFixed(3)).join(' ')}) within 40 ms`,
        !!p && Math.abs(p.time - expT) <= 0.04 && p.splits.length === nShots[rp] - 1 && p.splits.every((x, i) => Math.abs(x - expS[i]) <= 0.04), [rowOf(label), expT, expS]);
    }
    check('WQ-029: spot 2 lists three grades; spot 3 (one-shot return) two; a single split is written "split .xx s", two splits "splits .xx · .xx"',
      /Clean, Clean, Clean$/.test(rowOf('Spot 2')) && /^time \d+\.\d\d s · splits \d*\.\d\d · \d*\.\d\d s · /.test(rowOf('Spot 2')) && /^time \d+\.\d\d s · split \d*\.\d\d s · Clean, Clean$/.test(rowOf('Spot 3')), rows);
    check('WQ-029: a split under 1 s drops the leading zero (".32", never "0.32") and a split of 1 s or more reads 1.xx: spot 1 "split .xx s", spot 2 "splits .xx · .xx s", spot 3 (1.2 s hold) "split 1.xx s"',
      /^time \d+\.\d\d s · split \.\d\d s · Clean, Clean$/.test(rowOf('Spot 1')) && /^time \d+\.\d\d s · splits \.\d\d · \.\d\d s · /.test(rowOf('Spot 2')) &&
      /^time \d+\.\d\d s · split 1\.\d\d s · Clean, Clean$/.test(rowOf('Spot 3')), rows);
    check('WQ-029: the status texts are rendered from the def: "shot 1 of 2" / "fire 2 or more" appear with the def\'s shotsPerRep',
      await bp.evaluate(() => TDT.DRILL_DEFS.box.shotsPerRep) === 2 && lines1.some(x => /^Spot 2 · shot 1 of 2$/.test(x)) && lines1.some(x => /^Move to spot 2 · fire 2 or more$/.test(x)), lines1);
    check('WQ-029: spot 4 ends with "alarm" and lists alarm for both shots; spots 1, 2, 3 and 1 (last) carry no alarm mark and are graded',
      /alarm, alarm · alarm$/.test(rowOf('Spot 4')) && ['Spot 1', 'Spot 2', 'Spot 3', 'Spot 1 (last)'].every(k => !/alarm/.test(rowOf(k)) && /(Clean|Moved|Jerked)/.test(rowOf(k))), rows);
    const lastN = shotN(5, 2);
    check(`WQ-029: Total is the beep to the LAST SHOT at spot 5, from the observed frames (${((lastN - beepN) / 1000).toFixed(3)} s), within 40 ms, and shorter than beep to the results opening (${((fr('res').n - beepN) / 1000).toFixed(3)} s)`,
      /^\d+\.\d\d s$/.test(rowOf('Total (beep to last shot)') || '') && Math.abs(parseFloat(rowOf('Total (beep to last shot)')) - (lastN - beepN) / 1000) <= 0.04, [rowOf('Total (beep to last shot)'), lastN, beepN]);
    check('WQ-029: result: only position 4 is marked (alarms 1, withAlarm), the run counts one alarm, no early shot; shot counts 2, 3, 2, 2, 2',
      res.reps.map(p => p.withAlarm).join() === 'false,false,false,true,false' && res.reps[3].alarms === 1 && res.withAlarm === true && res.alarms === 1 && res.early === 0 &&
      res.reps.map(p => p.shots.length).join() === '2,3,2,2,2' && res.reps[3].shots.every(x => x.unsafe), res);
    check('WQ-029: the With alarm row names one alarm; Best clean total is a dash (the only run had an alarm); no Early row',
      /^1 alarm /.test(rowOf('With alarm') || '') && rowOf('Best clean total this session') === '—' && !rows.some(r => /Early/.test(r[0])), rows);

    // --- 3. Again -> run 2, clean: Best clean total is its own total. Status lines are collected over both runs.
    await btouch('touchEnd', []);
    await bp.click('#drillAgain'); await bp.waitForTimeout(100);
    d = await bst();
    check('WQ-029: Again hides the results and starts a new run in standby (rep 0); the run count stays 1', !d.drillResOpen && d.drill.phase === 'standby' && d.drill.rep === 0 && d.drillRuns === 1 && d.running, d);
    await observeB();
    await btouch('touchStart', [REST]);
    d = await waitBeep();
    for (let rp = 1; rp <= 5; rp++) {
      if (rp > 1) await bsleep(500);
      await fireN(2); await fingerBack(); await bmotion(4);
      if (rp < 5) await checkCue(rp, `run 2, spot ${rp}`);
    }
    d = await bst(); lo = await BO();
    const rows2 = await brows(), res2 = d.drill.result, rowOf2 = k => (rows2.find(r => r[0] === k) || [])[1];
    check('WQ-029: run 2 ends: results open, 2 runs, paused, clean (no With alarm row, no alarms)',
      d.drillResOpen && d.drillRuns === 2 && d.paused === true && res2.withAlarm === false && res2.alarms === 0 && !rows2.some(r => r[0] === 'With alarm'), [d.drillRuns, rows2]);
    check(`WQ-029: Best clean total this session is this clean run (${res2.total}), shown as the Total row`,
      rowOf2('Best clean total this session') === (res2.total / 1000).toFixed(2) + ' s' && rowOf2('Total (beep to last shot)') === (res2.total / 1000).toFixed(2) + ' s', rows2);
    const lastN2 = pick(lo.ev, 'shot', e => e.rep === 5 && e.i === 2).n, beepN2 = pick(lo.ev, 'beep').n;
    check(`WQ-029: run 2 Total matches the observed frames (${((lastN2 - beepN2) / 1000).toFixed(3)} s) within 40 ms`, Math.abs(res2.total - (lastN2 - beepN2)) <= 40, [res2.total, lastN2 - beepN2]);
    const seen = new Set([...lines1, ...lo.lines.map(x => x.l)]);
    for (const [name, text] of [['standby', 'Box Drill · finger on the frame, wait for the beep'], ['spot 1 live', 'Spot 1 of 5 · fire 2 or more'], ['spot 1 shot 1', 'Spot 1 · shot 1 of 2'],
      ['spot 2 live', 'Move to spot 2 · fire 2 or more'], ['spot 3 live', 'Move to spot 3 · fire 2 or more'], ['spot 4 live', 'Move to spot 4 · fire 2 or more'], ['spot 2 shot 1', 'Spot 2 · shot 1 of 2'],
      ['spot 3 shot 1', 'Spot 3 · shot 1 of 2'], ['spot 4 shot 1', 'Spot 4 · shot 1 of 2'], ['last live', 'Back at spot 1 · fire 2 or more'], ['last shot 1', 'Spot 1 (last) · shot 1 of 2'],
      ['finishing', 'Finger on the frame to move'], ['finishing, last', 'Finger on the frame to finish']]) {
      check(`WQ-029: the drill line showed ${name}: "${text}"`, seen.has(text), [...seen]);
    }
    for (const sel of ['#drillAgain', '#drillChange']) { const r = await inView(sel, W, H); check(`WQ-029: ${sel} is inside the 844x390 viewport on the Box results`, r === true, r); }
    const cellsIn = async (vw) => bp.evaluate(vw => [...document.querySelectorAll('#drillResRows td')].every(td => { const b = td.getBoundingClientRect(); return b.right <= vw + 0.5 && b.left >= -0.5; }), vw);
    check('WQ-029: all result cells are inside the 844-wide viewport', await cellsIn(W));
    await bp.$eval('#drillResOv', e => { e.scrollTop = 0; });
    await shoot(path.join(shotDir, 'results-landscape.png'));
    await bp.evaluate(() => document.fullscreenElement ? document.exitFullscreen() : null); await bp.waitForTimeout(200);
    await bp.setViewportSize({ width: H, height: W }); await bp.waitForTimeout(250);
    for (const sel of ['#drillAgain', '#drillChange']) { const r = await inView(sel, H, W); check(`WQ-029: ${sel} is inside the 390x844 viewport on the Box results`, r === true, r); }
    check('WQ-029: all result cells are inside the 390-wide viewport', await cellsIn(H));
    const hs = await bp.evaluate(() => { const o = document.getElementById('drillResOv'); return o.scrollWidth <= o.clientWidth + 1; });
    check('WQ-029: the Box results have no horizontal overflow at 390x844', hs);
    await bp.$eval('#drillResOv', e => { e.scrollTop = 0; });
    await shoot(path.join(shotDir, 'results-portrait.png'));
    await bp.setViewportSize({ width: W, height: H }); await bp.waitForTimeout(250);

    // --- 4. gear mid-run cancels (D-107) and the run restarts at spot 1; run 3 completes cleanly; Change drill
    await btouch('touchEnd', []);
    await bp.click('#drillAgain'); await bp.waitForTimeout(100);
    await btouch('touchStart', [REST]);
    d = await waitBeep();
    await fireN(2); await fingerBack(); await bmotion(4);
    await checkCue(1, 'run 3, spot 1');
    await bsleep(300);
    await fireN(1); await fingerBack(); await bmotion(3);
    d = await bst();
    check('WQ-029: run 3: spot 2 with one shot fired, finger on the frame (rep 2, 1 shot, one position done)', d.drill.rep === 2 && d.drill.curShots === 1 && d.drill.repsDone === 1, d.drill);
    await bp.click('#gear'); await bp.waitForTimeout(120);
    d = await bst();
    check('WQ-029: gear mid-run cancels: engine paused, standby, rep 0, no positions done, no shots, no result, run count unchanged',
      await bp.$eval('#settingsOv', e => e.classList.contains('show')) && d.paused && d.drill.phase === 'standby' && d.drill.rep === 0 && d.drill.repsDone === 0 && d.drill.curShots === 0 && d.drill.result === null && d.drillRuns === 2, d);
    await bp.click('#doneBtn'); await bp.waitForTimeout(100);
    check('WQ-029: after Resume the line says Cancelled and to restart', /^Cancelled/.test(await bline()) && /restart/i.test(await bline()), await bline());
    await btouch('touchEnd', []); await bmotion(2); await btouch('touchStart', [REST]);
    d = await waitBeep();
    check('WQ-029: the run restarts at spot 1: a fresh beep, rep 1, no positions done, line "Spot 1 of 5 · fire 2 or more" (no Cancelled)',
      d.drill.rep === 1 && d.drill.repsDone === 0 && d.drill.curShots === 0 && await bline() === 'Spot 1 of 5 · fire 2 or more', [d.drill, await bline()]);
    for (let rp = 1; rp <= 5; rp++) { if (rp > 1) await bsleep(300); await fireN(2); await fingerBack(); await bmotion(4); if (rp < 5) await checkCue(rp, `run 3 after the cancel, spot ${rp}`); }
    d = await bst();
    const rows3 = await brows(), res3 = d.drill.result;
    check('WQ-029: run 3 ends with the results open and 3 runs', d.drillResOpen && d.drillRuns === 3 && res3.reps.length === 5 && res3.withAlarm === false, [d.drillRuns, res3]);
    check(`WQ-029: Best clean total is the smaller of the clean runs (run 2 ${res2.total}, run 3 ${res3.total}); the alarm run is excluded`,
      (rows3.find(r => /^Best clean/.test(r[0])) || [])[1] === (Math.min(res2.total, res3.total) / 1000).toFixed(2) + ' s', [rows3, res.total, res2.total, res3.total]);
    await btouch('touchEnd', []);
    await bp.click('#drillChange'); await bp.waitForTimeout(100);
    d = await bst();
    check('WQ-029: Change drill: trainer stopped, start screen shown, results closed, drill is null; the stored choice stays Box',
      d.running === false && d.drill === null && !d.drillResOpen && await startOv() && await lsGet() === 'box', d);
    await bp.close(); await bctx.close();
  }

  // WQ-030: Transitions (D-111, D-112). Fresh context so localStorage and touches start clean.
  {
    const fs = require('fs');
    const shotDir = path.resolve(__dirname, '..', 'docs', 'screenshots', 'wq-030');
    if (process.env.WQ_SCREENSHOTS) fs.mkdirSync(shotDir, { recursive: true });
    const tctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true });
    const tp = await tctx.newPage();
    tp.on('pageerror', e => errors.push('transitions page: ' + e.message));
    await tp.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
    await tp.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await tp.reload();
    const tst = () => tp.evaluate(() => window.__tdt());
    const tcdp = await tctx.newCDPSession(tp);
    const ttouch = (type, pts) => tcdp.send('Input.dispatchTouchEvent', {
      type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, radiusX: 25, radiusY: 25 })) });
    const tmotion = async (alpha = 0, n = 1) => {
      for (let i = 0; i < n; i++) {
        await tp.evaluate(a => window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
          rotationRate: { alpha: a, beta: 0, gamma: 0 }, acceleration: { x: 0, y: 0, z: 0 }, interval: 16 })), alpha);
        await tp.waitForTimeout(16);
      }
    };
    const tsleep = async ms => { const t0 = Date.now(); while (Date.now() - t0 < ms) await tmotion(0, 1); };
    // A fast swing (80 deg/s) until the muzzle has moved at least `deg` degrees from where it was; then the phone stands still.
    const tswing = async (sign, deg) => {
      const h0 = (await tst()).aimH;
      for (let i = 0; i < 400; i++) { await tmotion(sign * 80, 1); if (Math.abs((await tst()).aimH - h0) >= deg) break; }
      await tmotion(0, 3);
    };
    // Swing until a state condition holds (the 180 checks).
    const tswingUntil = async (rate, cond, max = 400) => { for (let i = 0; i < max; i++) { await tmotion(rate, 1); if (cond(await tst())) return true; } return false; };
    const tengage = async () => { await ttouch('touchEnd', []); await tmotion(0, 3); await ttouch('touchStart', [TRG]); await tmotion(0, 3); };   // finger off the frame, onto the trigger, no pull
    // One pull and reset with the touch kept on the trigger (the finger stays prepped); the phone stands still.
    const tfire = async () => {
      for (let dx = 20; dx <= 70; dx += 25) { await ttouch('touchMove', [[TRG[0] - dx, TRG[1], 2]]); await tmotion(0, 2); }
      await tmotion(0, 1); await ttouch('touchMove', [[TRG[0], TRG[1], 2]]); await tmotion(0, 4);
    };
    const tline = () => tp.textContent('#drillLine');
    const trows = () => tp.$$eval('#drillResRows tr', trs => trs.map(tr => [...tr.children].map(td => td.textContent)));
    const waitS = async (cond, maxMs) => { const t0 = Date.now(); let s; while (Date.now() - t0 < maxMs) { await tmotion(0, 1); s = await tst(); if (cond(s)) return s; } return s; };
    const waitBeep = () => waitS(x => x.drill && x.drill.phase === 'live', 6500);
    const shoot = p => process.env.WQ_SCREENSHOTS ? tp.screenshot({ path: p }) : null;   // PNGs only on request: npm test leaves the tree clean
    const inView = async (sel, vw, vh) => {
      const h = await tp.$(sel); await h.scrollIntoViewIfNeeded();
      const b = await h.boundingBox();
      return b && b.width > 0 && b.height > 0 && b.x >= 0 && b.x + b.width <= vw + 0.5 && b.y >= 0 && b.y + b.height <= vh + 0.5 ? true : b;
    };
    const lsGet = () => tp.evaluate(() => { try { return localStorage.getItem('tdt.drill'); } catch (e) { return 'ERR'; } });
    const startOv = () => tp.$eval('#startOv', e => e.classList.contains('show'));
    const FRM = 17;
    // Page-side frame observer (performance.now() of the frame that first shows each change): the beep, each shot, the finger
    // coming onto the frame, the results opening, every distinct drill line text, and every frame where the window was open
    // (and whether an alarm sounded in it). Independent of the engine's own event times.
    const observeT = () => tp.evaluate(() => {
      window.__to = { ev: [], lines: [], freeFrames: 0, freeAlarmFrames: 0, alarmFrames: 0 };
      if (window.__toOn) return; window.__toOn = true;
      let phase = null, shots = 0, rest = false, res = false, line = null, alarm = false;
      const f = () => {
        const s = window.__tdt(), n = performance.now(), o = window.__to, d = s.drill;
        if (d) {
          if (d.phase === 'live' && (phase === 'standby' || phase === null)) o.ev.push({ k: 'beep', n });
          for (; shots < d.shots; shots++) o.ev.push({ k: 'shot', i: shots + 1, n });
          if (d.shots < shots) shots = d.shots;
          phase = d.phase;
          if (d.freeOnTrigger) { o.freeFrames++; if (s.alarmActive) o.freeAlarmFrames++; }
        } else { phase = null; shots = 0; }
        if (s.alarmActive) o.alarmFrames++;
        if (s.alarmActive && !alarm) o.ev.push({ k: 'alarm', n, reason: s.alarmReason, shots: d ? d.shots : null });
        alarm = s.alarmActive;
        if (s.onRest && !rest) o.ev.push({ k: 'rest', n });
        rest = s.onRest;
        if (s.drillResOpen && !res) o.ev.push({ k: 'res', n });
        res = s.drillResOpen;
        const l = document.getElementById('drillLine').textContent;
        if (l !== line) { o.lines.push({ l, n }); line = l; }
        requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    });
    const TO = () => tp.evaluate(() => window.__to);
    const pick = (ev, k, pred = () => true) => ev.find(e => e.k === k && pred(e));

    // --- 1. picker: five entries, Transitions highlighted, reachability at both orientations, screenshots
    await tp.click('#drillBtn');
    const tids = await tp.$$eval('#drillList .drillOpt', els => els.map(e => e.dataset.id));
    check("WQ-030: picker lists exactly ['freestyle','lowready','box','bill','transitions'] in D-93 + D-112 a order", JSON.stringify(tids) === '["freestyle","lowready","box","bill","transitions"]', tids);
    const tnames = await tp.$$eval('#drillList .drillOpt', els => els.map(e => e.textContent));
    check('WQ-030: the fifth entry is named Transitions and carries the subtitle "Five pairs, target to target"', /Transitions/.test(tnames[4]) && /Five pairs, target to target/.test(tnames[4]), tnames);
    const tsvgs = {};
    for (const id of ['freestyle', 'lowready', 'box', 'bill', 'transitions']) { await tp.click(`#drillList .drillOpt[data-id="${id}"]`); tsvgs[id] = await tp.$eval('#drillDiagram', e => e.innerHTML); }
    check('WQ-030: highlighting Transitions moves .sel and shows its own <svg> (different from the other four), selectable',
      await tp.$eval('#drillList .drillOpt.sel', e => e.dataset.id) === 'transitions' && /^<svg/.test(tsvgs.transitions.trim()) && /trigger/i.test(tsvgs.transitions) &&
      ['freestyle', 'lowready', 'box', 'bill'].every(k => tsvgs[k] !== tsvgs.transitions) && !(await tp.$eval('#drillList .drillOpt[data-id="transitions"]', e => e.disabled || e.classList.contains('disabled'))));
    const howT = await tp.textContent('#drillHow');
    check('WQ-030: the how-to mentions the finger on the trigger between targets, five pairs and finishing on the frame', /trigger/i.test(howT) && /five pairs/i.test(howT) && /finger back on the frame/i.test(howT), howT);
    for (const [name, vw, vh] of [['landscape', W, H], ['portrait', H, W]]) {
      await tp.setViewportSize({ width: vw, height: vh }); await tp.waitForTimeout(250);
      await tp.$eval('#drillOv', e => { e.scrollTop = 0; });
      await shoot(path.join(shotDir, `picker-${name}.png`));
      const reach = [];
      for (const sel of ['#drillChoose', '#drillCancelBtn']) reach.push(await inView(sel, vw, vh));
      check(`WQ-030: ${vw}x${vh}: #drillChoose and #drillCancelBtn are reachable and not clipped with Transitions highlighted`, reach.every(r => r === true), reach);
      const noH = await tp.evaluate(() => { const o = document.getElementById('drillOv'); return o.scrollWidth <= o.clientWidth + 1; });
      check(`WQ-030: ${vw}x${vh}: the picker has no horizontal overflow`, noH);
      const sb = await tp.$eval('#drillDiagram svg', e => { const b = e.getBoundingClientRect(); return { x: b.x, r: b.right, w: b.width, h: b.height }; });
      check(`WQ-030: ${vw}x${vh}: the Transitions diagram is fully inside the viewport and has a size`, sb.x >= 0 && sb.r <= vw + 0.5 && sb.w > 100 && sb.h > 50, sb);
      if (vw === W) {                                   // D-112 compact landscape rule: all five entries, the diagram and both buttons fit with no scrolling
        const fit = await tp.evaluate(() => { const o = document.getElementById('drillOv'); return { sh: o.scrollHeight, ch: o.clientHeight, sw: o.scrollWidth, cw: o.clientWidth }; });
        check(`WQ-030: ${vw}x${vh}: the picker needs no scrolling (scrollHeight ${fit.sh} === clientHeight ${fit.ch})`, fit.sh === fit.ch && fit.sw <= fit.cw + 1, fit);
        const allIn = [];
        for (const id of ['freestyle', 'lowready', 'box', 'bill', 'transitions']) allIn.push(await tp.$eval(`#drillList .drillOpt[data-id="${id}"]`, (e, [vw, vh]) => { const b = e.getBoundingClientRect(); return b.top >= 0 && b.bottom <= vh + 0.5 && b.left >= 0 && b.right <= vw + 0.5; }, [vw, vh]));
        check(`WQ-030: ${vw}x${vh}: all five list entries are inside the viewport without scrolling (scrollTop 0)`, allIn.every(Boolean) && await tp.$eval('#drillOv', e => e.scrollTop === 0), allIn);
      }
      const last = await inView('#drillList .drillOpt[data-id="transitions"]', vw, vh);
      check(`WQ-030: ${vw}x${vh}: the fifth list entry can be scrolled into view`, last === true || (last && last.width > 0), last);
    }
    await tp.setViewportSize({ width: W, height: H }); await tp.waitForTimeout(250);
    await tp.click('#drillChoose');
    check("WQ-030: Choose stores tdt.drill === 'transitions' and the button names Transitions", await lsGet() === 'transitions' && /Transitions/.test(await tp.textContent('#drillBtn')) && (await tst()).drillSel === 'transitions');
    await tp.reload();
    check('WQ-030: the Transitions choice survives a reload', (await tst()).drillSel === 'transitions' && /Transitions/.test(await tp.textContent('#drillBtn')));

    // --- 2. run 1: the same swing BEFORE the first shot alarms; the beep timing and the first texts
    await tp.click('#startBtn'); await tp.waitForTimeout(150);
    await observeT();
    let d = await tst();
    check('WQ-030: after Start the run is in standby: no shots, window closed, line "Transitions · finger on the frame, wait for the beep"',
      d.drill && d.drill.id === 'transitions' && d.drill.phase === 'standby' && d.drill.shots === 0 && d.drill.freeOnTrigger === false && d.drillRuns === 0 &&
      await tline() === 'Transitions · finger on the frame, wait for the beep', [d.drill, await tline()]);
    await ttouch('touchStart', [REST]); await tmotion(0, 4);
    d = await waitBeep();
    let lo = await TO();
    const rest1 = pick(lo.ev, 'rest'), beep1 = pick(lo.ev, 'beep');
    check(`WQ-030: the beep came 2000-5000 ms (+ one frame) after the finger came onto the frame (${beep1 && rest1 ? (beep1.n - rest1.n).toFixed(0) : '?'} ms)`,
      !!beep1 && !!rest1 && beep1.n - rest1.n >= 2000 - FRM && beep1.n - rest1.n <= 5000 + Math.max(2 * FRM, 100), lo.ev);
    check('WQ-030: at the beep the line says "Go — two at the first target", live, no shots, window closed',
      d.drill.phase === 'live' && d.drill.shots === 0 && d.drill.freeOnTrigger === false && await tline() === 'Go — two at the first target', [d.drill, await tline()]);
    await tengage(); await tsleep(450);                                   // trigger touched, no pull, past the grace period
    d = await tst();
    check('WQ-030: finger on the trigger before any shot: off the frame, no alarm, window closed (freeOnTrigger false)', !d.onRest && !d.alarmActive && d.trig && !d.trig.fired && d.drill.freeOnTrigger === false, d);
    await tswing(1, 40); d = await tst();
    check('WQ-030: a fast 40 deg swing with the finger on the trigger BEFORE the first shot alarms (move); freeOnTrigger false', d.alarmActive && d.alarmReason === 'move' && d.violations === 1 && d.drill.freeOnTrigger === false && d.drill.shots === 0, d);
    await ttouch('touchEnd', []); await tmotion(0, 2); await ttouch('touchStart', [REST]); await tmotion(0, 8); d = await tst();
    check('WQ-030: the finger back on the frame clears that alarm (the run stays live)', !d.alarmActive && d.onRest && d.drill.phase === 'live', d);
    await ttouch('touchEnd', []);
    await tp.click('#gear'); await tp.waitForTimeout(120);
    d = await tst();
    check('WQ-030: gear in a live run cancels it: paused, standby, no shots, no result, no run counted, results not open',
      d.paused && d.drill.phase === 'standby' && d.drill.shots === 0 && d.drill.result === null && d.drillRuns === 0 && !d.drillResOpen, d);
    await tp.click('#doneBtn'); await tp.waitForTimeout(100);
    check('WQ-030: after Resume the line says Cancelled and to restart', /^Cancelled/.test(await tline()) && /restart/i.test(await tline()), await tline());

    // --- 3. run 2 (clean): window opens at shot 1, closes at shot 10; every status text; the results
    await observeT();
    await ttouch('touchStart', [REST]); await tmotion(0, 4);
    d = await waitBeep();
    await tengage();
    await tfire(); d = await tst();
    check('WQ-030: after shot 1 the run is live with 1 shot, the window is open (freeOnTrigger true), line "Target 1 · fire again"',
      d.drill.phase === 'live' && d.drill.shots === 1 && d.drill.freeOnTrigger === true && await tline() === 'Target 1 · fire again', [d.drill, await tline()]);
    await tfire(); d = await tst();
    check('WQ-030: after shot 2 the line says "Next target · finger may stay on the trigger", window open', d.drill.shots === 2 && d.drill.freeOnTrigger === true && await tline() === 'Next target · finger may stay on the trigger', [d.drill, await tline()]);
    await tsleep(200);
    const freeBefore = (await TO()).freeFrames, alarmsBefore = d.violations;
    await tswing(1, 40); d = await tst();
    check(`WQ-030: the same 40 deg swing after shot 2, touch kept on the trigger: NO alarm, freeOnTrigger true (the frame observer saw the window open on ${(await TO()).freeFrames - freeBefore} frames of it)`,
      !d.alarmActive && d.violations === alarmsBefore && d.drill.freeOnTrigger === true && d.trig && (await TO()).freeFrames - freeBefore > 10, d);
    await tsleep(250);
    const wins = [];
    for (let n = 3; n <= 10; n++) {
      await tfire(); d = await tst();
      if (n < 10) {
        const want = n % 2 ? `Target ${(n - 1) / 2 + 1} · fire again` : 'Next target · finger may stay on the trigger';
        wins.push([n, d.drill.shots === n && d.drill.freeOnTrigger === true && await tline() === want && !d.alarmActive, want]);
        if (n % 2 === 0) { await tsleep(200); await tswing(n % 4 ? 1 : -1, 40); await tsleep(250); d = await tst(); wins.push([`swing after ${n}`, !d.alarmActive && d.drill.freeOnTrigger === true]); }
        else await tsleep(150);
        if (n === 2) { /* (the first transition was done above) */ }
      }
    }
    check('WQ-030: shots 3-9: each status line matches (Target n · fire again after an odd shot, Next target after an even one), the window stays open, and the three later swings raise no alarm',
      wins.every(w => w[1]), wins);
    await tmotion(0, 4); d = await tst();
    check('WQ-030: after shot 10 the phase is finishing, the window is closed (freeOnTrigger false), no alarm, line "Finger back on the frame", no results yet',
      d.drill.phase === 'finishing' && d.drill.shots === 10 && d.drill.freeOnTrigger === false && !d.alarmActive && !d.drillResOpen && await tline() === 'Finger back on the frame', [d.drill, await tline()]);
    lo = await TO();
    check(`WQ-030: over the whole run the observer saw the window open on ${lo.freeFrames} frames, an alarm on none of them, and no alarm at all (${lo.alarmFrames} frames)`, lo.freeFrames > 100 && lo.freeAlarmFrames === 0 && lo.alarmFrames === 0, lo);
    await ttouch('touchEnd', []); await tmotion(0, 2); await ttouch('touchStart', [REST]); await tmotion(0, 4);
    d = await tst(); lo = await TO();
    const rows = await trows(), res = d.drill.result, rowOf = k => (rows.find(r => r[0] === k) || [])[1];
    check('WQ-030: finger back on the frame ends the run: results open, 1 run, engine paused, phase ended', d.drillResOpen === true && d.drillRuns === 1 && d.paused === true && d.drill.phase === 'ended', d);
    check('WQ-030: results title says Transitions', /Transitions/.test(await tp.textContent('#drillResTitle')));
    check('WQ-030: results rows in order: First shot, Pairs, Transitions, Average transition, Total, Shots, Best clean total this session (no With alarm, no Early)',
      JSON.stringify(rows.map(r => r[0])) === JSON.stringify(['First shot', 'Pairs', 'Transitions', 'Average transition', 'Total', 'Shots', 'Best clean total this session']), rows);
    const nums = k => (rowOf(k) || '').replace(/ s$/, '').split(' · ').map(parseFloat);
    const shotsN = lo.ev.filter(e => e.k === 'shot').map(e => e.n), beepN = pick(lo.ev, 'beep').n;
    check(`WQ-030: the observer saw ten shots; the Pairs row has five values and the Transitions row four`, shotsN.length === 10 && nums('Pairs').length === 5 && nums('Transitions').length === 4 && nums('Pairs').every(x => x > 0) && nums('Transitions').every(x => x > 0), [rows, shotsN.length]);
    const obsPairs = [0, 2, 4, 6, 8].map(i => shotsN[i + 1] - shotsN[i]), obsTr = [1, 3, 5, 7].map(i => shotsN[i + 1] - shotsN[i]);
    check(`WQ-030: the five pair splits in the result match the observed frames within 40 ms (${res.pairSplits.map(Math.round)} vs ${obsPairs.map(Math.round)})`, res.pairSplits.length === 5 && res.pairSplits.every((x, i) => Math.abs(x - obsPairs[i]) <= 40), [res.pairSplits, obsPairs]);
    check(`WQ-030: the four transitions in the result match the observed frames within 40 ms (${res.transitions.map(Math.round)} vs ${obsTr.map(Math.round)}), and the shown rows match the result (to the rounding)`,
      res.transitions.length === 4 && res.transitions.every((x, i) => Math.abs(x - obsTr[i]) <= 40) && nums('Pairs').every((x, i) => Math.abs(x * 1000 - res.pairSplits[i]) <= 6) && nums('Transitions').every((x, i) => Math.abs(x * 1000 - res.transitions[i]) <= 6), [res, rows]);
    const meanTr = res.transitions.reduce((a, b) => a + b, 0) / 4;
    check(`WQ-030: Average transition is the mean of the four (${(meanTr / 1000).toFixed(3)} s) and is shown as ${rowOf('Average transition')}`,
      Math.abs(res.avgTransition - meanTr) < 0.01 && rowOf('Average transition') === (res.avgTransition / 1000).toFixed(2) + ' s', [res, rows]);
    check(`WQ-030: First shot (${res.first}) and Total (${res.total}) match the observed frames (${(shotsN[0] - beepN).toFixed(0)} / ${(shotsN[9] - beepN).toFixed(0)}) within 40 ms; Total ends at shot 10`,
      Math.abs(res.first - (shotsN[0] - beepN)) <= 40 && Math.abs(res.total - (shotsN[9] - beepN)) <= 40 && rowOf('First shot') === (res.first / 1000).toFixed(2) + ' s' && rowOf('Total') === (res.total / 1000).toFixed(2) + ' s', [res, rows]);
    const shotCells = (rowOf('Shots') || '').split(' · ');
    check('WQ-030: the Shots row lists ten grades (no "alarm"), and the clean run has no early shot, no alarm, and is not withAlarm',
      shotCells.length === 10 && shotCells.every(g => g && g !== 'alarm') && res.early === 0 && res.alarms === 0 && res.withAlarm === false && res.shots.length === 10 && res.splits.length === 9, [rows, res]);
    check('WQ-030: Best clean total this session equals this run (the first clean run)', rowOf('Best clean total this session') === (res.total / 1000).toFixed(2) + ' s', rows);
    const okTexts = [/^Transitions · finger on the frame, wait for the beep$/, /^Go — two at the first target$/, /^Target [1-5] · fire again$/, /^Next target · finger may stay on the trigger$/, /^Finger back on the frame$/, /^Done$/, /^Cancelled/];
    const seenT = lo.lines.map(x => x.l);
    check('WQ-030: every text the drill line showed during the clean run is one of the D-112 k texts', seenT.every(l => okTexts.some(re => re.test(l))), seenT);
    check('WQ-030: and the run showed the beep text, "Target 1".."Target 5 · fire again", "Next target…" and "Finger back on the frame"',
      ['Go — two at the first target', 'Target 1 · fire again', 'Target 2 · fire again', 'Target 3 · fire again', 'Target 4 · fire again', 'Target 5 · fire again', 'Next target · finger may stay on the trigger', 'Finger back on the frame'].every(x => seenT.includes(x)), seenT);
    for (const sel of ['#drillAgain', '#drillChange']) { const r = await inView(sel, W, H); check(`WQ-030: ${sel} is inside the 844x390 viewport on the results`, r === true, r); }
    const cellsIn = vw => tp.evaluate(vw => [...document.querySelectorAll('#drillResRows td')].every(td => { const b = td.getBoundingClientRect(); return b.right <= vw + 0.5 && b.left >= -0.5; }), vw);
    check('WQ-030: all result cells are inside the 844-wide viewport', await cellsIn(W));
    await tp.$eval('#drillResOv', e => { e.scrollTop = 0; });
    await shoot(path.join(shotDir, 'results-landscape.png'));
    await tp.evaluate(() => document.fullscreenElement ? document.exitFullscreen() : null); await tp.waitForTimeout(200);
    await tp.setViewportSize({ width: H, height: W }); await tp.waitForTimeout(250);
    for (const sel of ['#drillAgain', '#drillChange']) { const r = await inView(sel, H, W); check(`WQ-030: ${sel} is inside the 390x844 viewport on the results`, r === true, r); }
    check('WQ-030: all result cells are inside the 390-wide viewport', await cellsIn(H));
    check('WQ-030: the results have no horizontal overflow at 390x844', await tp.evaluate(() => { const o = document.getElementById('drillResOv'); return o.scrollWidth <= o.clientWidth + 1; }));
    await tp.$eval('#drillResOv', e => { e.scrollTop = 0; });
    await shoot(path.join(shotDir, 'results-portrait.png'));
    await tp.setViewportSize({ width: W, height: H }); await tp.waitForTimeout(250);

    // --- 4. Again -> run 3: ten shots with the swings, then the same swing AFTER shot 10 with the finger still on the trigger alarms
    await ttouch('touchEnd', []);
    await tp.click('#drillAgain'); await tp.waitForTimeout(100);
    d = await tst();
    check('WQ-030: Again hides the results and starts a new run in standby; the run count stays 1, line "Transitions · finger on the frame, wait for the beep"',
      !d.drillResOpen && d.drill.phase === 'standby' && d.drill.shots === 0 && d.drillRuns === 1 && d.running && await tline() === 'Transitions · finger on the frame, wait for the beep', [d.drill, await tline()]);
    await observeT();
    await ttouch('touchStart', [REST]); await tmotion(0, 4);
    d = await waitBeep(); const v3 = d.violations; await tengage();
    for (let n = 1; n <= 10; n++) { await tfire(); if (n < 10) { await tsleep(150); if (n % 2 === 0) { await tswing(n % 4 ? 1 : -1, 40); await tsleep(250); } } }
    await tmotion(0, 4); d = await tst();
    check('WQ-030: run 3: ten shots with four swings in the window, no alarm; phase finishing, window closed', d.drill.phase === 'finishing' && d.drill.shots === 10 && !d.alarmActive && d.violations === v3 && d.drill.freeOnTrigger === false, d);
    await tsleep(800);                                                    // the press is over, the grace period is over, the finger is still on the trigger
    d = await tst();
    check('WQ-030: after shot 10, finger still on the trigger, phone still: no alarm yet', !d.alarmActive && d.trig && !d.trig.fired && !d.onRest, d);
    await tswing(1, 40); d = await tst();
    check('WQ-030: after shot 10 the same fast 40 deg swing with the finger still on the trigger alarms (move)', d.alarmActive && d.alarmReason === 'move' && d.violations === v3 + 1 && d.drill.phase === 'finishing' && d.drill.freeOnTrigger === false, d);
    await ttouch('touchEnd', []); await tmotion(0, 2); await ttouch('touchStart', [REST]); await tmotion(0, 5);
    d = await tst();
    const rows3 = await trows(), res3 = d.drill.result, rowOf3 = k => (rows3.find(r => r[0] === k) || [])[1];
    check('WQ-030: finger to the frame: the alarm clears and the results open (2 runs); that run is With alarm (1 alarm)', !d.alarmActive && d.drillResOpen && d.drillRuns === 2 && res3.withAlarm === true && res3.alarms === 1 && /^1 alarm /.test(rowOf3('With alarm') || ''), [d.drillRuns, rows3, res3]);
    check(`WQ-030: Best clean total is run 2's (${res.total}), not this run's (${res3.total}) which had the alarm`, rowOf3('Best clean total this session') === (res.total / 1000).toFixed(2) + ' s', rows3);
    check('WQ-030: the ten shots fired before the alarm are graded (no "alarm" cells in the Shots row) and counted in the pairs and transitions', !(rowOf3('Shots') || '').includes('alarm') && res3.pairSplits.length === 5 && res3.transitions.length === 4, [rows3, res3]);

    // --- 5. Change drill: start screen, no drill, stored choice stays; Start again gives a fresh Transitions standby
    await ttouch('touchEnd', []);
    await tp.click('#drillChange'); await tp.waitForTimeout(100);
    d = await tst();
    check('WQ-030: Change drill: trainer stopped, start screen shown, results closed, drill is null; the stored choice stays Transitions',
      d.running === false && d.drill === null && !d.drillResOpen && await startOv() && await lsGet() === 'transitions', d);
    await tp.click('#startBtn'); await tp.waitForTimeout(150);
    d = await tst();
    check('WQ-030: Start again: a fresh Transitions run in standby, no shots', d.drill && d.drill.id === 'transitions' && d.drill.phase === 'standby' && d.drill.shots === 0, d.drill);

    // --- 6. run 4: the trigger touch lifted mid-window (finger off everything) and the phone swung alarms
    await observeT();
    await ttouch('touchStart', [REST]); await tmotion(0, 4);
    d = await waitBeep(); const v4 = d.violations; await tengage(); await tfire(); await tfire(); await tsleep(200);
    await tswing(1, 40); d = await tst();
    check('WQ-030: run 4: after two shots a 40 deg swing with the touch kept on the trigger raises no alarm (window open)', d.drill.shots === 2 && !d.alarmActive && d.drill.freeOnTrigger === true, d);
    await ttouch('touchEnd', []); await tsleep(500); d = await tst();
    check('WQ-030: run 4: finger lifted off the trigger and not onto the frame: window closed, no alarm yet, not on the frame', d.drill.freeOnTrigger === false && !d.alarmActive && !d.onRest && d.trig === null, d);
    await tswing(-1, 40); d = await tst();
    check('WQ-030: run 4: the swing now alarms (move): the normal off-frame rules apply once the finger has left the trigger', d.alarmActive && d.alarmReason === 'move' && d.violations === v4 + 1 && d.drill.phase === 'live' && d.drill.shots === 2, d);
    await tp.click('#gear'); await tp.waitForTimeout(120);
    d = await tst();
    check('WQ-030: run 4: gear cancels the run (standby, no shots, 2 runs counted, results not open)', d.paused && d.drill.phase === 'standby' && d.drill.shots === 0 && d.drillRuns === 2 && !d.drillResOpen, d);
    check('WQ-030: run 4: while paused after the gear cancel freeOnTrigger is false', d.drill.freeOnTrigger === false, d.drill);
    await tp.click('#doneBtn'); await tp.waitForTimeout(100);

    // --- 7. run 5: gear in a live run with the window open cancels (no result, run count unchanged)
    await ttouch('touchStart', [REST]); await tmotion(0, 4);
    d = await waitBeep(); await tengage(); await tfire();
    d = await tst();
    check('WQ-030: run 5: one shot fired, window open', d.drill.shots === 1 && d.drill.freeOnTrigger === true && d.drill.phase === 'live', d.drill);
    await ttouch('touchEnd', []);
    await tp.click('#gear'); await tp.waitForTimeout(120);
    d = await tst();
    check('WQ-030: run 5: gear with the window open cancels: paused, standby, no shots, no result, run count still 2, results not open',
      d.paused && d.drill.phase === 'standby' && d.drill.shots === 0 && d.drill.result === null && d.drillRuns === 2 && !d.drillResOpen, d);
    check('WQ-030: run 5: with the window open at the gear tap, freeOnTrigger is false while paused (before Resume)', d.paused && d.drill.freeOnTrigger === false, d.drill);
    await tp.click('#doneBtn'); await tp.waitForTimeout(100);
    d = await tst();
    check('WQ-030: run 5: after Resume the window is closed (freeOnTrigger false), the line says Cancelled', d.drill.freeOnTrigger === false && /^Cancelled/.test(await tline()), [d.drill, await tline()]);

    // --- 8. run 6: with downrange set, a swing past 90 deg inside the window still raises the 180 alarm
    await ttouch('touchStart', [REST]); await tmotion(0, 4);
    await tp.click('#downrangeBtn'); await tmotion(0, 3);
    check('WQ-030: run 6: Set downrange took', (await tst()).refSet === true);
    d = await waitBeep(); await tengage(); await tfire(); await tsleep(300);
    d = await tst();
    check('WQ-030: run 6: one shot fired, window open, no alarm', d.drill.shots === 1 && d.drill.freeOnTrigger === true && !d.alarmActive, d);
    await tswingUntil(-80, x => x.dev180 > 65); d = await tst();
    check(`WQ-030: run 6: ${d.dev180.toFixed(0)} deg off downrange with the finger on the trigger inside the window: no alarm`, d.dev180 > 65 && d.dev180 < 90 && !d.alarmActive && d.drill.freeOnTrigger === true, d);
    await tswingUntil(-80, x => x.dev180 > 95); d = await tst();
    check(`WQ-030: run 6: past 90 deg of downrange (${d.dev180.toFixed(0)} deg) inside the window: the 180 alarm fires`, d.alarmActive && d.alarmReason === '180' && d.breaks180 === 1 && d.drill.freeOnTrigger === true, d);
    await ttouch('touchEnd', []);
    await tp.click('#gear'); await tp.waitForTimeout(120);
    await tp.click('#doneBtn'); await tp.waitForTimeout(100);
    check('WQ-030: no page errors in this section', errors.filter(e => e.startsWith('transitions page')).length === 0, errors);
    await tp.close(); await tctx.close();
  }

  // WQ-031: one finger (D-113, D-114 b-d, D-115). Only a touch that lands while no other touch controls (frame contact or
  // the engaged trigger) can count; a later finger is ignored until it is lifted. CDP keeps a point down until a
  // touchEnd lists it (touchEnd [] lifts all), so one finger of two is lifted with touchEnd [that finger].
  {
    const octx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true });
    const op = await octx.newPage();
    op.on('pageerror', e => errors.push('one-finger page: ' + e.message));
    await op.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
    await op.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await op.reload();
    await op.click('#startBtn'); await op.waitForTimeout(150);
    const ost = () => op.evaluate(() => window.__tdt());
    const ocdp = await octx.newCDPSession(op);
    const otouch = (type, pts) => ocdp.send('Input.dispatchTouchEvent', {
      type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, radiusX: 25, radiusY: 25 })) });
    const omotion = async (n = 1, rate = 0) => {
      for (let i = 0; i < n; i++) {
        await op.evaluate(a => window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
          rotationRate: { alpha: a, beta: a, gamma: 0 }, acceleration: { x: 0, y: 0, z: 0 }, interval: 16 })), rate);
        await op.waitForTimeout(16);
      }
    };
    const owobble = async (rate, n = 15) => { for (let i = 0; i < n; i++) await omotion(1, i % 2 ? rate : -rate); };
    // Wait for rendered frames (rAF), not wall time: n frames of the page's own loop.
    const frames = n => op.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
    const T2 = id => [TRG[0], TRG[1], id], P2 = (dx, id) => [TRG[0] - dx, TRG[1], id];
    const R1 = [REST[0], REST[1], 1], R4 = [REST[0] + 40, REST[1], 4];
    let o;

    await otouch('touchStart', [R1]); await omotion(5); await frames(3);
    o = await ost(); check('WQ-031: finger on the frame arms and is safe', o.armed && o.onRest && o.ignored === 0, o);

    // (1) finger on the frame + a second finger pulls the trigger: no trigger contact, no shot, still safe.
    await otouch('touchStart', [R1, T2(2)]); await omotion(3);
    for (let dx = 20; dx <= 75; dx += 15) { await otouch('touchMove', [R1, P2(dx, 2)]); await omotion(2); }
    await frames(3);
    o = await ost();
    check('WQ-031 (1): a second finger on the trigger while the frame finger controls: no trigger contact, no shot, safe',
      o.trig === null && o.shots === 0 && o.onRest && o.armed && !o.alarmActive && o.ignored === 1, o);

    // (2) the frame finger lifts while the second finger is still down and pulls again: still nothing, and off the frame.
    await otouch('touchEnd', [R1]); await omotion(2);
    await otouch('touchMove', [P2(0, 2)]); await omotion(2);
    for (let dx = 20; dx <= 75; dx += 15) { await otouch('touchMove', [P2(dx, 2)]); await omotion(2); }
    await omotion(10); await frames(3);
    o = await ost();
    check('WQ-031 (2): the frame finger lifts, the ignored finger pulls again: no trigger contact, no shot, off the frame',
      o.trig === null && o.shots === 0 && !o.onRest && !o.restContact && o.ignored === 1 && !o.alarmActive, o);
    await otouch('touchEnd', []); await omotion(3);
    o = await ost(); check('WQ-031 (2): lifting the ignored finger drops it from the ignored set', o.ignored === 0, o);
    await otouch('touchStart', [T2(3)]); await omotion(3);
    o = await ost(); check('WQ-031 (2): the same finger placed again on the trigger engages', !!o.trig && !o.trig.fired, o);
    for (let dx = 20; dx <= 70; dx += 25) { await otouch('touchMove', [P2(dx, 3)]); await omotion(2); }
    await frames(2);
    o = await ost(); check('WQ-031 (2): ... and fires normally', o.shots === 1 && !!o.trig && o.trig.fired && !o.alarmActive, o);
    await otouch('touchEnd', []); await omotion(25);

    // (3) trigger engaged + a second finger on the strip: no frame contact (no OK tone), movement alarms as usual; after the
    // trigger finger lifts the strip finger still gives no frame contact.
    await otouch('touchStart', [R1]); await omotion(8);
    o = await ost(); check('WQ-031 (3): back on the frame: safe', o.onRest && !o.alarmActive, o);
    await otouch('touchEnd', []); await omotion(25);
    await otouch('touchStart', [T2(2)]); await omotion(3);
    await otouch('touchStart', [T2(2), R4]); await omotion(8); await frames(3);
    o = await ost();
    check('WQ-031 (3): trigger engaged, a second finger on the strip: no frame contact (no OK tone)',
      !!o.trig && !o.onRest && !o.restContact && o.ignored === 1 && !o.alarmActive, o);
    const v3 = o.violations;
    await owobble(80); await omotion(5);
    o = await ost();
    check('WQ-031 (3): ... and moving alarms as usual', o.alarmActive && o.alarmReason === 'move' && o.violations === v3 + 1, o);
    await otouch('touchEnd', [T2(2)]); await omotion(10); await frames(3);
    o = await ost();
    check('WQ-031 (3): the trigger finger lifts: the strip finger still gives no frame contact, the alarm holds',
      o.trig === null && !o.onRest && !o.restContact && o.alarmActive && o.ignored === 1, o);
    await otouch('touchEnd', []); await omotion(3);
    await otouch('touchStart', [R1]); await omotion(8);
    o = await ost(); check('WQ-031 (3): a fresh finger on the strip clears the alarm', o.onRest && !o.alarmActive && o.ignored === 0, o);

    // (4) two fingers laid on the frame one after the other; the first lifts: frame contact is lost.
    await otouch('touchStart', [R1, R4]); await omotion(5);
    o = await ost(); check('WQ-031 (4): a second finger on the frame is ignored', o.onRest && o.ignored === 1, o);
    await otouch('touchEnd', [R1]); await omotion(10); await frames(3);
    o = await ost();
    check('WQ-031 (4): the first finger lifts: frame contact is lost although the second is still on the strip',
      !o.onRest && !o.restContact && o.ignored === 1, o);
    await otouch('touchEnd', []); await omotion(3);

    // (5) one finger slides from the strip into the trigger zone and pulls: it fires (D-114 b).
    await otouch('touchStart', [R1]); await omotion(8);
    o = await ost(); check('WQ-031 (5): finger on the frame, safe', o.onRest && !o.alarmActive && o.ignored === 0, o);
    const shots5 = o.shots;
    for (let k = 1; k <= 4; k++) {
      await otouch('touchMove', [[REST[0] + (TRG[0] - REST[0]) * k / 4, REST[1] + (TRG[1] - REST[1]) * k / 4, 1]]); await omotion(2);
    }
    o = await ost(); check('WQ-031 (5): sliding the same finger into the trigger zone engages', !!o.trig && !o.trig.fired && !o.onRest, o);
    for (let dx = 20; dx <= 70; dx += 25) { await otouch('touchMove', [P2(dx, 1)]); await omotion(2); }
    await frames(2);
    o = await ost(); check('WQ-031 (5): ... and the pull fires', o.shots === shots5 + 1 && o.trig && o.trig.fired && !o.alarmActive, o);
    await otouch('touchEnd', []); await omotion(3);
    check('WQ-031: no page errors in this section', errors.filter(e => e.startsWith('one-finger page')).length === 0, errors);
    await op.close(); await octx.close();
  }

  // WQ-045 (D-123, D-124): no devicemotion sample within 2 s of Start shows the non-modal banner and the pill prefix;
  // one sample clears both; samples stopping for more than 5 s while running shows them again. The trainer is not paused.
  {
    const nctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true });
    const np = await nctx.newPage();
    np.on('pageerror', e => errors.push('no-motion page: ' + e.message));
    await np.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
    await np.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await np.reload();
    const nst = () => np.evaluate(() => window.__tdt());
    const banner = () => np.evaluate(() => {
      const b = document.getElementById('motionBanner');
      return { shown: getComputedStyle(b).display !== 'none', text: b.textContent, pill: document.getElementById('status').textContent,
               perm: typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function' && window.isSecureContext !== false };
    });
    const nmotion = () => np.evaluate(() => window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
      rotationRate: { alpha: 0, beta: 0, gamma: 0 }, acceleration: { x: 0, y: 0, z: 0 }, interval: 16 })));
    await np.click('#startBtn'); await np.waitForTimeout(800);
    let n = await nst(), b = await banner();
    check('WQ-045: just after Start with no motion yet: no banner, motionSeen false', n.running && !n.motionSeen && !n.motionBannerOpen && !b.shown, [n.motionSeen, n.motionBannerOpen, b]);
    await np.waitForTimeout(1700);
    n = await nst(); b = await banner();
    check('WQ-045: 2 s after Start with no motion: banner shown, pill reads NO MOTION', n.motionBannerOpen && b.shown && /^NO MOTION/.test(b.pill) && /No motion data\. The alarms cannot work\./.test(b.text), [n.motionBannerOpen, b]);
    check('WQ-045: the fix line follows the feature check (D-53)',
      b.perm ? /tap Allow/.test(b.text) && /Motion & Orientation Access/.test(b.text) : /over HTTPS on a phone/.test(b.text), b);
    check('WQ-045: the banner does not pause the engine', n.running && !n.paused, n);
    // The banner lets touches through: a finger on the frame strip under it still arms (mouse fallback / touch keep working).
    const ncdp = await nctx.newCDPSession(np);
    await ncdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: REST[0], y: REST[1], id: 1, radiusX: 25, radiusY: 25 }] });
    await np.waitForTimeout(150);
    n = await nst(); b = await banner();
    check('WQ-045: with the banner up, a finger on the frame arms; the pill keeps the state after the prefix', n.armed && n.onRest && /^NO MOTION · SAFE$/.test(b.pill), [n.armed, n.onRest, b.pill]);
    await nmotion(); await np.waitForTimeout(100);
    n = await nst(); b = await banner();
    check('WQ-045: one sample clears the banner and the pill', n.motionSeen && !n.motionBannerOpen && !b.shown && b.pill === 'SAFE', [n.motionSeen, n.motionBannerOpen, b]);
    await np.waitForTimeout(3500);
    n = await nst();
    check('WQ-045: a 3.5 s gap after samples arrived: still no banner (gap limit 5 s)', !n.motionBannerOpen, n.motionBannerOpen);
    await np.waitForTimeout(2000);
    n = await nst(); b = await banner();
    check('WQ-045: samples stopped for more than 5 s while running: banner and pill again', n.motionBannerOpen && b.shown && /^NO MOTION/.test(b.pill), [n.motionBannerOpen, b]);
    await nmotion(); await np.waitForTimeout(100);
    n = await nst(); b = await banner();
    check('WQ-045: the next sample hides it again', !n.motionBannerOpen && !b.shown && !/NO MOTION/.test(b.pill), [n.motionBannerOpen, b]);
    check('WQ-045: no page errors in this section', errors.filter(e => e.startsWith('no-motion page')).length === 0, errors);
    await np.close(); await nctx.close();
  }

  // WQ-037: home-screen icons (D-127). The page under test is loaded from file://, so this block serves the repo from
  // a throwaway local HTTP server and fetches the manifest, every icon it lists and the apple-touch-icon over HTTP.
  {
    const http = require('http'), fs = require('fs');
    const root = path.resolve(__dirname, '..');
    const types = { '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.js': 'text/javascript' };
    const srv = http.createServer((req, res) => {
      const f = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
      if (!f.startsWith(root + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
    });
    await new Promise(r => srv.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${srv.address().port}/`;
    const ip = await ctx.newPage();
    ip.on('pageerror', e => errors.push('icons page: ' + e.message));
    const home = await ip.goto(base);
    check('WQ-037: index.html served over HTTP', home.status() === 200, home.status());
    const apple = await ip.$eval('link[rel="apple-touch-icon"]', l => l.getAttribute('href')).catch(() => null);
    check('WQ-037: apple-touch-icon link points at icon-180.png', apple === 'icon-180.png', apple);
    const r = await ip.evaluate(async () => {
      const mHref = document.querySelector('link[rel="manifest"]').getAttribute('href');
      const mRes = await fetch(mHref); let man = null;
      try { man = JSON.parse(await mRes.text()); } catch (e) {}
      const probe = async src => { const x = await fetch(src); const b = await x.blob();
        let w = 0, h = 0; if (x.ok && b.type === 'image/png') { const bm = await createImageBitmap(b); w = bm.width; h = bm.height; }
        return { src, status: x.status, type: b.type, w, h }; };
      const icons = man ? await Promise.all(man.icons.map(async i => ({ ...i, got: await probe(i.src) }))) : [];
      return { mStatus: mRes.status, parsed: !!man, icons, apple: await probe(document.querySelector('link[rel="apple-touch-icon"]').getAttribute('href')) };
    });
    check('WQ-037: the manifest is served (200) and parses as JSON', r.mStatus === 200 && r.parsed, r);
    check('WQ-037: every manifest icon is served with 200', r.icons.length > 0 && r.icons.every(i => i.got.status === 200), r.icons);
    const pngs = r.icons.filter(i => i.type === 'image/png');
    const has = (sz, purpose) => pngs.some(i => i.sizes === `${sz}x${sz}` && i.purpose === purpose && i.got.w === sz && i.got.h === sz);
    check('WQ-037: manifest lists 192 and 512 px PNG icons of their stated size', has(192, 'any') && has(512, 'any'), pngs);
    check('WQ-037: manifest lists a 512 px maskable PNG', has(512, 'maskable'), pngs);
    check('WQ-037: apple-touch-icon is a 180 px PNG served with 200',
      r.apple.status === 200 && r.apple.type === 'image/png' && r.apple.w === 180 && r.apple.h === 180, r.apple);
    await ip.close(); srv.close();
  }

  // WQ-043: offline use (D-121, D-128). Served over a throwaway local HTTP server (service workers need http(s); the
  // page above runs from file://, where registration is skipped) in a fresh context, so the worker cannot leak into
  // the other sections. Start registers sw.js?v=<VERSION>; once it controls the page, the context goes offline and the
  // server stops, and a reload must still render the start screen with the same engine version.
  {
    const http = require('http'), fs = require('fs');
    const root = path.resolve(__dirname, '..');
    const types = { '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.js': 'text/javascript' };
    const srv = http.createServer((req, res) => {
      const f = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
      if (!f.startsWith(root + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(f).pipe(res);
    });
    await new Promise(r => srv.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${srv.address().port}/`;
    const fctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true });
    const fp = await fctx.newPage();
    fp.on('pageerror', e => errors.push('offline page: ' + e.message));
    await fp.goto(base);
    const v0 = await fp.evaluate(() => window.TDT.VERSION);
    const before = await fp.evaluate(async () => ({ ctl: !!navigator.serviceWorker.controller,
      regs: (await navigator.serviceWorker.getRegistrations()).length, line: document.getElementById('versionLine').textContent }));
    check('WQ-043: no worker is registered before Start', !before.ctl && before.regs === 0 && !/offline/.test(before.line), before);
    await fp.click('#startBtn');
    const got = await fp.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller)
        await new Promise(r => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
      const keys = await caches.keys(), c = await caches.open(keys.find(k => k.startsWith('tdt-')) || 'none');
      return { script: reg.active && reg.active.scriptURL, ctl: !!navigator.serviceWorker.controller, keys,
        cached: (await c.keys()).map(q => new URL(q.url).pathname).sort(), line: document.getElementById('versionLine').textContent };
    });
    check('WQ-043: Start registers sw.js?v=<VERSION> and it controls the page',
      got.ctl && got.script === base + 'sw.js?v=' + encodeURIComponent(v0), got);
    check('WQ-043: the cache is named after the engine version', got.keys.length === 1 && got.keys[0] === 'tdt-' + v0, got.keys);
    const want = ['/', '/engine.js', '/icon-180.png', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/icon.svg', '/index.html', '/manifest.webmanifest'];
    check('WQ-043: the cache holds the page, the engine, the manifest and every icon', JSON.stringify(got.cached) === JSON.stringify(want), got.cached);
    check('WQ-043: the version line says offline ready once the worker controls the page', /offline ready/.test(got.line), got.line);
    const asked = [];
    fctx.on('request', q => asked.push(q.url()));
    await fctx.setOffline(true); srv.close(); srv.closeAllConnections();
    let reloaded = true;
    try { await fp.reload({ waitUntil: 'load' }); } catch (e) { reloaded = false; errors.push('offline reload: ' + e.message); }
    const off = reloaded ? await fp.evaluate(() => ({ start: document.getElementById('startOv').classList.contains('show'),
      v: window.TDT && window.TDT.VERSION, ctl: !!navigator.serviceWorker.controller,
      line: document.getElementById('versionLine').textContent })) : null;
    check('WQ-043: offline reload renders the start screen with the same engine version',
      !!off && off.start && off.v === v0 && off.ctl, off);
    check('WQ-043: offline reload shows offline ready', !!off && /offline ready/.test(off.line), off);
    check('WQ-043: no request leaves the local origin', asked.every(u => u.startsWith(base)), asked);
    // A new registered version string installs a new worker and deletes the old cache on activate.
    const bump = await fp.evaluate(() => caches.keys());
    await fctx.setOffline(false);
    const srv2 = http.createServer(srv.listeners('request')[0]);
    await new Promise(r => srv2.listen(new URL(base).port, '127.0.0.1', r));
    const next = await fp.evaluate(async () => {
      const swap = new Promise(r => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
      await navigator.serviceWorker.register('sw.js?v=wq043-next', { updateViaCache: 'none' });
      await swap;
      for (let i = 0; i < 50; i++) { const k = await caches.keys(); if (k.length === 1) break; await new Promise(r => setTimeout(r, 50)); }
      return { keys: await caches.keys(), script: navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL };
    });
    check('WQ-043: a changed version string makes a new cache and deletes the old one',
      bump.includes('tdt-' + v0) && next.keys.length === 1 && next.keys[0] === 'tdt-wq043-next' && /sw\.js\?v=wq043-next$/.test(next.script || ''), { bump, next });
    await fctx.close(); srv2.close(); srv2.closeAllConnections();
  }

  // WQ-044 (D-129, D-130): accessibility pass. The shot flash follows prefers-reduced-motion and the page-only Shot flash
  // setting (stored under tdt.shotFlash only when off); ARIA on the overlays, the live regions and the icon-only button;
  // 4.5:1 contrast for the status pill texts and the .tip lines.
  {
    const actx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true });
    const ap = await actx.newPage();
    ap.on('pageerror', e => errors.push('a11y page: ' + e.message));
    await ap.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
    await ap.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await ap.reload();
    const acdp = await actx.newCDPSession(ap);
    const atouch = (type, pts) => acdp.send('Input.dispatchTouchEvent', {
      type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, radiusX: 25, radiusY: 25 })) });
    const amotion = async (n = 1) => { for (let i = 0; i < n; i++) {
      await ap.evaluate(() => window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
        rotationRate: { alpha: 0, beta: 0, gamma: 0 }, acceleration: { x: 0, y: 0, z: 0 }, interval: 16 })));
      await ap.waitForTimeout(16); } };
    // Every class change on #flash and #trigZone is logged, with #flash's computed animation when .go is added,
    // so the 120 ms animation cannot be missed between polls.
    const watch = () => ap.evaluate(() => {
      const log = window.__flashLog = { go: 0, anim: [], hit: 0 };
      if (window.__flashObs) return; window.__flashObs = true;
      const f = document.getElementById('flash'), z = document.getElementById('trigZone');
      let fGo = false, zHit = false;
      new MutationObserver(() => {
        const l = window.__flashLog;
        if (f.classList.contains('go') && !fGo) { l.go++; l.anim.push(getComputedStyle(f).animationName); }
        if (z.classList.contains('hit') && !zHit) l.hit++;
        fGo = f.classList.contains('go'); zHit = z.classList.contains('hit');
      }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    });
    const shotOnce = async () => {
      await watch();
      await atouch('touchEnd', []).catch(() => {});
      await atouch('touchStart', [REST]); await amotion(25);
      await atouch('touchEnd', []); await atouch('touchStart', [TRG]); await amotion(3);
      for (let dx = 20; dx <= 70; dx += 25) { await atouch('touchMove', [[TRG[0] - dx, TRG[1], 2]]); await amotion(1); }
      await amotion(2); await atouch('touchEnd', []); await amotion(3);
      return ap.evaluate(() => Object.assign({ shots: window.__tdt().shots }, window.__flashLog));
    };
    const stored = () => ap.evaluate(() => localStorage.getItem('tdt.shotFlash'));
    // The warning box names the flash, and the ARIA attributes are in place.
    check('WQ-044: the start-screen warning box mentions the shot flash', /flash/i.test(await ap.textContent('.loud')));
    const aria = await ap.evaluate(() => {
      const g = id => document.getElementById(id);
      return {
        dialogs: ['startOv', 'settingsOv', 'summaryOv', 'drillOv', 'drillResOv'].map(id => {
          const e = g(id), lb = e.getAttribute('aria-labelledby');
          return e.getAttribute('role') === 'dialog' && e.getAttribute('aria-modal') === 'true' && !!lb && !!g(lb) && g(lb).textContent.trim().length > 0;
        }),
        live: ['status', 'drillLine'].map(id => g(id).getAttribute('aria-live')),
        rec: g('recPill').getAttribute('aria-label'), gear: g('gear').getAttribute('aria-label'),
        dr: g('downrangeBtn').getAttribute('aria-label'),
        vp: document.querySelector('meta[name=viewport]').content,
      };
    });
    check('WQ-044: the five overlays are labelled modal dialogs', aria.dialogs.every(Boolean), aria.dialogs);
    check('WQ-044: the status pill and #drillLine are polite live regions', aria.live.every(v => v === 'polite'), aria.live);
    check('WQ-044: the REC pill, the gear and Set downrange carry an aria-label', !!aria.rec && !!aria.gear && /^Set downrange/.test(aria.dr || ''), aria);
    check('WQ-044: user-scalable=no is kept (D-130)', /user-scalable=no/.test(aria.vp), aria.vp);
    // Contrast (WCAG relative luminance) of the status pill texts and the .tip lines, from the computed colours.
    const contrast = await ap.evaluate(() => {
      const rgb = c => c.match(/[\d.]+/g).slice(0, 3).map(Number);
      const lum = c => { const v = rgb(c).map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
        return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
      const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
      const out = {}, st = document.getElementById('status'), keep = st.className;
      for (const k of ['', 'safe', 'warn', 'bad', 'trig']) {
        st.className = 'pill ' + k; const cs = getComputedStyle(st);
        out['pill.' + (k || 'plain')] = +ratio(cs.color, cs.backgroundColor).toFixed(2);
      }
      st.className = keep;
      const rp = document.getElementById('recPill'), rcs = getComputedStyle(rp);
      out.recPill = +ratio(rcs.color, rcs.backgroundColor).toFixed(2);
      const tip = getComputedStyle(document.querySelector('#startOv p.tip')).color;
      out['tip/overlay'] = +ratio(tip, getComputedStyle(document.getElementById('startOv')).backgroundColor).toFixed(2);
      for (const [n, v] of [['bg', '--bg'], ['panel', '--panel']])
        out['tip/' + n] = +ratio(tip, getComputedStyle(document.documentElement).getPropertyValue(v).trim().replace(/^#(..)(..)(..)$/, (m, r, g, b) => `rgb(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)})`)).toFixed(2);
      return out;
    });
    console.log('      WQ-044 contrast:', JSON.stringify(contrast));
    check('WQ-044: status pill texts, the REC pill and .tip are at least 4.5:1', Object.values(contrast).every(v => v >= 4.5), contrast);
    // Defaults: Shot flash on, nothing stored, the full-screen flash plays.
    await ap.click('#startBtn'); await ap.waitForTimeout(150);
    let f = await shotOnce();
    check('WQ-044: defaults: a shot plays the #flash.go animation, no trigger outline', f.shots === 1 && f.go === 1 && f.anim[0] === 'flash' && f.hit === 0, f);
    check('WQ-044: defaults: nothing stored under tdt.shotFlash', await stored() === null);
    // prefers-reduced-motion: reduce: no #flash.go, the trigger is outlined instead.
    await ap.emulateMedia({ reducedMotion: 'reduce' });
    f = await shotOnce();
    check('WQ-044: reduced motion: a shot adds no #flash.go and outlines the trigger', f.shots === 2 && f.go === 0 && f.hit === 1, f);
    await ap.waitForTimeout(250);
    check('WQ-044: the trigger outline clears after 150 ms', !(await ap.$eval('#trigZone', e => e.classList.contains('hit'))));
    await ap.emulateMedia({ reducedMotion: 'no-preference' });
    // Settings → Shot flash off, normal motion: same as reduced motion; stored only while off.
    await ap.click('#gear'); await ap.waitForTimeout(100);
    check('WQ-044: the Shot flash toggle is on by default', await ap.$eval('#shotFlashChk', e => e.checked));
    await ap.$eval('#shotFlashChk', e => { e.checked = false; e.dispatchEvent(new Event('change')); });
    check('WQ-044: turning Shot flash off stores tdt.shotFlash = off', await stored() === 'off');
    check('WQ-044: the toggle does not touch tdt.settings.v2', await ap.evaluate(() => localStorage.getItem('tdt.settings.v2')) === null);
    await ap.reload();
    check('WQ-044: the off state survives a reload', (await ap.evaluate(() => window.__tdt().shotFlash)) === false && !(await ap.$eval('#shotFlashChk', e => e.checked)));
    await ap.click('#startBtn'); await ap.waitForTimeout(150);
    f = await shotOnce();
    check('WQ-044: Shot flash off: a shot adds no #flash.go and outlines the trigger', f.shots === 1 && f.go === 0 && f.hit === 1, f);
    await ap.click('#gear'); await ap.waitForTimeout(100);
    await ap.$eval('#shotFlashChk', e => { e.checked = true; e.dispatchEvent(new Event('change')); });
    check('WQ-044: back on removes the key', await stored() === null);
    await ap.$eval('#shotFlashChk', e => { e.checked = false; e.dispatchEvent(new Event('change')); });
    await ap.$eval('#resetDefaults', e => e.click());
    check('WQ-044: Restore defaults turns Shot flash back on and removes the key',
      await stored() === null && await ap.$eval('#shotFlashChk', e => e.checked) && (await ap.evaluate(() => window.__tdt().shotFlash)) === true);
    if (process.env.WQ_SCREENSHOTS) {
      const fs = require('fs'), dir = path.resolve(__dirname, '..', 'docs', 'screenshots', 'wq-044');
      fs.mkdirSync(dir, { recursive: true });
      await ap.$eval('#shotFlashChk', e => e.scrollIntoView({ block: 'center' }));
      await ap.screenshot({ path: path.join(dir, 'settings-shot-flash.png') });
      await ap.reload(); await ap.screenshot({ path: path.join(dir, 'start-warning.png') });
    }
    check('WQ-044: no page errors in this section', errors.filter(e => e.startsWith('a11y page')).length === 0, errors);
    await actx.close();
  }

  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log(failures ? `\n${failures} failed` : '\nall passed');
  process.exit(failures ? 1 : 0);
})();
