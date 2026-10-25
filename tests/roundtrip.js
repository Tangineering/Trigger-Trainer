// Records a session in the real page (headless Chromium, simulated touch + motion), saves it
// through the page's own Save path, then replays the file through engine.js in Node and
// requires the replayed events to equal the events the page produced live.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const TDT = require('../engine.js');

const W = 844, H = 390;
const { ZONES, zoneFor } = require('../engine.js');
const mid = z => [(z.x + z.w / 2) * W, (z.y + z.h / 2) * H];
const REST = [...mid(ZONES.rest), 1];         // centre of the frame strip (right-handed)
const TRG = [...mid(zoneFor('trigger', W)), 2];   // centre of the drawn trigger zone (px offset, D-72)

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
  for (let dx = 5; dx <= 70; dx += 5) { await touch('touchMove', [[TRG[0] - dx, TRG[1], 2]]); await motion(0.5, 0, 1); }
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
  check('the page says where the file went', /Downloaded .*Downloads/.test(await page.textContent('#recInfo')));
  check('stopping returns to Settings at the recorder', await page.evaluate(() => {
    const ov = document.getElementById('settingsOv'), r = document.getElementById('recSection').getBoundingClientRect();
    return ov.classList.contains('show') && ov.scrollTop > 0 && r.top >= 0 && r.top < innerHeight / 2;
  }));

  // Android Chrome: canShare refuses .json but accepts text/plain → share sheet gets a .txt copy.
  await page.evaluate(() => {
    window.__shared = null;
    navigator.canShare = d => d.files.every(f => f.type === 'text/plain');
    navigator.share = d => { window.__shared = { name: d.files[0].name, type: d.files[0].type }; return Promise.resolve(); };
  });
  await page.click('#recSave'); await page.waitForTimeout(50);
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
  // WQ-026 (D-91): a second recording with the High preset (17.5 °/s, 1.05 m/s², 3.5°). The settings carry the
  // three slider values (no preset key), the replay matches live; a 20 °/s burst off the frame (under the default
  // 25, over 17.5) alarms only because of them.
  await page.evaluate(() => { navigator.canShare = undefined; });   // back to the download path
  await page.$eval('#sensitivity', el => { el.value = 'high'; el.dispatchEvent(new Event('change')); });
  await page.selectOption('#recLabel', 'off-frame-move');
  await page.fill('#recNotes', 'roundtrip test, High preset');
  await touch('touchEnd', []);                              // lift the finger left on the frame above
  await page.click('#recStart'); await page.waitForTimeout(100);
  await touch('touchStart', [REST]); await motion(0, 0, 10);
  await touch('touchEnd', []); await motion(0, 0, 25);
  await motion(20, 0, 25);                                   // 20 °/s back and forth
  await touch('touchStart', [REST]); await motion(0, 0, 10);
  const [dl3] = await Promise.all([page.waitForEvent('download'), page.click('#recPill')]);
  const recH = JSON.parse(fs.readFileSync(await dl3.path(), 'utf8'));
  const resH = TDT.replay(recH);
  check('High preset: the settings carry 17.5 / 1.05 / 3.5 and no sensitivity key', recH.settings && recH.settings.moveDps === 17.5 &&
    recH.settings.moveAcc === 1.05 && recH.settings.offFrameDeg === 3.5 && !('sensitivity' in recH.settings), recH.settings);
  check('High preset: the 20 °/s burst alarmed live', recH.observed.some(o => o[1] === 'alarmStart'), recH.observed);
  check(`High preset: replay reproduces the live events exactly (${recH.observed.length} events)`,
    JSON.stringify(recH.observed) === JSON.stringify(resH.packed), { live: recH.observed, replay: resH.packed });
  check('High preset: the same log under the default limits does not alarm',
    !TDT.replay(recH, { moveDps: 25, moveAcc: 1.5, offFrameDeg: 5 }).events.some(e => e.type === 'alarmStart'));
  check('WQ-027: a Freestyle recording has no r or x row and no drill event',
    !rec.log.some(r => r[0] === 'r' || r[0] === 'x') && !recH.log.some(r => r[0] === 'r' || r[0] === 'x') &&
    !rec.observed.concat(recH.observed).some(o => /^drill/.test(o[1])));

  // WQ-027: a Bill Drill run recorded in the page replays with identical events; the log starts the run with an 'r' row.
  await touch('touchEnd', []);
  await page.reload();
  await page.evaluate(() => { navigator.canShare = undefined; });
  await page.click('#drillBtn');
  await page.click('#drillList .drillOpt[data-id="bill"]');
  await page.click('#drillChoose');
  check('WQ-027: Bill selected in the picker', await page.evaluate(() => window.__tdt().drillSel) === 'bill');
  await page.click('#startSettingsBtn');
  check('WQ-027: the recorder offers the drill-bill label', await page.$$eval('#recLabel option', os => os.some(o => o.value === 'drill-bill')));
  await page.selectOption('#recLabel', 'drill-bill');
  await page.fill('#recNotes', 'roundtrip test, Bill Drill');
  await page.click('#recStart'); await page.waitForTimeout(100);
  check('WQ-027: Bill recording started with the drill in standby', await page.evaluate(() => {
    const t = window.__tdt(); return t.recording && t.drill && t.drill.id === 'bill' && t.drill.phase === 'standby'; }));
  await page.waitForTimeout(150);
  const press = async () => {
    await touch('touchStart', [TRG]); await motion(0, 0, 3);
    for (let dx = 20; dx <= 70; dx += 25) { await touch('touchMove', [[TRG[0] - dx, TRG[1], 2]]); await motion(0, 0, 1); }
    await motion(0, 0, 2); await touch('touchEnd', []); await motion(0, 0, 3);
  };
  await touch('touchStart', [REST]);
  let t0 = Date.now(), ph = null;
  while (Date.now() - t0 < 4800) { await motion(0, 0, 1); ph = await page.evaluate(() => window.__tdt().drill && window.__tdt().drill.phase); if (ph === 'live') break; }
  check('WQ-027: the beep came within 4.8 s of putting the finger on the frame', ph === 'live', ph);
  for (let i = 0; i < 6; i++) await press();
  await touch('touchStart', [REST]); await motion(0, 0, 4);
  const liveB = await page.evaluate(() => window.__tdt());
  check('WQ-027: Bill run finished live (results open, one run)', liveB.drillResOpen && liveB.drillRuns === 1, liveB);
  await touch('touchEnd', []);
  await page.click('#drillChange');                       // leaves the trainer: logs an x row while recording
  const [dl4] = await Promise.all([page.waitForEvent('download'), page.$eval('#recPill', el => el.click())]);   // the start screen covers the pill
  const recB = JSON.parse(fs.readFileSync(await dl4.path(), 'utf8'));
  const resB = TDT.replay(recB);
  const firstRow = recB.log[0], runRow = firstRow;
  check("WQ-027: Bill recording: label drill-bill and the first log row is ['r', t, 'bill', seed]",
    recB.label === 'drill-bill' && runRow[0] === 'r' && runRow[2] === 'bill' && Number.isInteger(runRow[3]) && runRow[3] >= 0 && runRow[3] < 2 ** 32, [firstRow, runRow]);
  check('WQ-027: Bill recording: exactly one r row', recB.log.filter(r => r[0] === 'r').length === 1);
  check('WQ-027: Bill recording: observed has one drillBeep and one drillEnd',
    recB.observed.filter(o => o[1] === 'drillBeep').length === 1 && recB.observed.filter(o => o[1] === 'drillEnd').length === 1, recB.observed.filter(o => /drill/.test(o[1])));
  check('WQ-027: Bill recording: Change drill logged an x row and the page cancelled nothing live',
    recB.log.some(r => r[0] === 'x') && !recB.observed.some(o => o[1] === 'drillCancel'), recB.observed.filter(o => /drill/.test(o[1])));
  check(`WQ-027: Bill recording: replay reproduces the live events exactly (${recB.observed.length} events)`,
    JSON.stringify(recB.observed) === JSON.stringify(resB.packed), { live: recB.observed, replay: resB.packed });
  const endB = recB.observed.find(o => o[1] === 'drillEnd');
  check('WQ-027: Bill recording: the replayed result total matches the live drillEnd total',
    resB.state.drillRuns.length === 1 && Math.abs(resB.state.drillRuns[0].total - endB[3]) < 0.001 && endB[2] === 'bill', [resB.state.drillRuns, endB]);
  check('WQ-027: Bill recording: the results overlay paused the engine and no drillCancel was observed (0 events)',
    liveB.paused === true && recB.observed.filter(o => o[1] === 'drillCancel').length === 0, [liveB.paused, recB.observed.filter(o => /drill/.test(o[1]))]);
  {
    // Another seed must give a beep too (the delay fits the log), at a different time than the recorded one.
    const b1 = resB.events.find(e => e.type === 'drillBeep'), i = recB.log.findIndex(r => r[0] === 'r');
    let b2 = null, used = null;
    for (const add of [777, 1001, 2003, 3001, 5003, 8009]) {
      const r2 = JSON.parse(JSON.stringify(recB)); r2.log[i][3] = (r2.log[i][3] + add) >>> 0;
      const e = TDT.replay(r2).events.find(x => x.type === 'drillBeep');
      if (e && e.t !== b1.t) { b2 = e; used = add; break; }
    }
    check(`WQ-027: Bill recording: another seed gives a beep too, at a different time (${b1 && b1.t} vs ${b2 && b2.t}, seed + ${used})`, !!b1 && !!b2 && b2.t !== b1.t);
  }
  // WQ-028: a Low Ready run recorded in the page (five reps, picked through the picker and the recorder) replays with identical events.
  await page.reload();
  await page.evaluate(() => { navigator.canShare = undefined; });
  await page.click('#drillBtn');
  await page.click('#drillList .drillOpt[data-id="lowready"]');
  await page.click('#drillChoose');
  check('WQ-028: Low Ready selected in the picker', await page.evaluate(() => window.__tdt().drillSel) === 'lowready');
  await page.click('#startSettingsBtn');
  check('WQ-028: the recorder offers the drill-low-ready label', await page.$$eval('#recLabel option', os => os.some(o => o.value === 'drill-low-ready')));
  await page.selectOption('#recLabel', 'drill-low-ready');
  await page.fill('#recNotes', 'roundtrip test, Low Ready');
  await page.click('#recStart'); await page.waitForTimeout(100);
  check('WQ-028: Low Ready recording started with the drill in standby at rep 0', await page.evaluate(() => {
    const t = window.__tdt(); return t.recording && t.drill && t.drill.id === 'lowready' && t.drill.phase === 'standby' && t.drill.rep === 0; }));
  await page.waitForTimeout(150);
  await touch('touchStart', [REST]);
  const stLR = () => page.evaluate(() => window.__tdt());
  const waitLR = async (cond, maxMs) => { const t1 = Date.now(); let x; while (Date.now() - t1 < maxMs) { await motion(0, 0, 1); x = await stLR(); if (cond(x)) return x; } return x; };
  let lrOk = true, lrLast = null;
  for (let rp = 1; rp <= 5; rp++) {
    lrLast = await waitLR(x => x.drill && x.drill.rep === rp && x.drill.phase === 'live', 6500);
    if (!(lrLast.drill && lrLast.drill.rep === rp && lrLast.drill.phase === 'live')) { lrOk = false; break; }
    await motion(0, 0, 5);
    await press(); await press();
    await touch('touchStart', [REST]); await motion(0, 0, 3);
    lrLast = await waitLR(x => rp === 5 ? x.drillResOpen : x.drill.repsDone >= rp, 2500);
    if (!(rp === 5 ? lrLast.drillResOpen : lrLast.drill.repsDone >= rp)) { lrOk = false; break; }
  }
  check('WQ-028: Low Ready recording: all five reps ran live and the results opened', lrOk && lrLast.drillResOpen && lrLast.drillRuns === 1 && lrLast.paused === true, lrLast);
  await touch('touchEnd', []);
  await page.click('#drillChange');
  const [dl5] = await Promise.all([page.waitForEvent('download'), page.$eval('#recPill', el => el.click())]);
  const recL = JSON.parse(fs.readFileSync(await dl5.path(), 'utf8'));
  const resL = TDT.replay(recL);
  const obsL = k => recL.observed.filter(o => o[1] === k);
  check("WQ-028: Low Ready recording: label drill-low-ready and the first log row is ['r', t, 'lowready', seed]",
    recL.label === 'drill-low-ready' && recL.log[0][0] === 'r' && recL.log[0][2] === 'lowready' && Number.isInteger(recL.log[0][3]) && recL.log[0][3] >= 0 && recL.log[0][3] < 2 ** 32, recL.log[0]);
  check('WQ-028: Low Ready recording: exactly one r row', recL.log.filter(r => r[0] === 'r').length === 1);
  check('WQ-028: Low Ready recording: observed has 5 drillBeep (reps 1-5), 4 drillCue (reps 1-4, "lowready"), 1 drillEnd, 0 drillCancel',
    obsL('drillBeep').map(o => o[2]).join() === '1,2,3,4,5' && obsL('drillCue').length === 4 && obsL('drillCue').every((o, i) => o[2] === 'lowready' && o[3] === i + 1) &&
    obsL('drillEnd').length === 1 && obsL('drillCancel').length === 0, recL.observed.filter(o => /drill/.test(o[1])));
  check('WQ-028: Low Ready recording: each cue comes 750 ms (+ a frame, + 40 ms browser jitter) after the last ok before it',
    obsL('drillCue').concat(obsL('drillEnd')).every(c => { const oks = recL.observed.filter(o => o[1] === 'ok' && o[0] <= c[0]); const g = oks.length ? c[0] - oks[oks.length - 1][0] : NaN; return g >= 750 - 1 && g <= 750 + 17 + 40; }),
    recL.observed.filter(o => /drill|ok/.test(o[1])));
  check(`WQ-028: Low Ready recording: replay reproduces the live events exactly (${recL.observed.length} events)`,
    JSON.stringify(recL.observed) === JSON.stringify(resL.packed), { live: recL.observed, replay: resL.packed });
  const endL = recL.observed.find(o => o[1] === 'drillEnd');
  check('WQ-028: Low Ready recording: the replayed run has five reps and its total matches the live drillEnd total',
    resL.state.drillRuns.length === 1 && resL.state.drillRuns[0].reps.length === 5 && Math.abs(resL.state.drillRuns[0].total - endL[3]) < 0.001 && endL[2] === 'lowready', [resL.state.drillRuns.length, endL]);
  check('WQ-028: Low Ready recording: the results overlay paused the engine (no drillCancel observed)', lrLast.paused === true && obsL('drillCancel').length === 0);
  check('WQ-028: the earlier Bill and Freestyle recordings carry no drillCue', !recB.observed.concat(rec.observed, recH.observed).some(o => o[1] === 'drillCue'));
  check('no page errors', errors.length === 0, errors);

  await browser.close();
  console.log(failures ? `\n${failures} failed` : '\nall passed');
  process.exit(failures ? 1 : 0);
})();
