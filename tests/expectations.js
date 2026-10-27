// What each recording label must produce when replayed. Each returns [[description, pass], ...].
// r = summary from replay.js: { alarms, shots[], armed, finalAlarm, peak: {h, v} }

const dominant = (p, axis, sign) => {
  const main = axis === 'v' ? p.v : p.h, other = axis === 'v' ? p.h : p.v;
  return Math.sign(main) === sign && Math.abs(main) > Math.abs(other);
};

module.exports = {
  'free': () => [],
  // A recording ends with the finger lifted to tap Stop; since D-56 the phone moving more than
  // offFrameDeg in that last moment alarms, and the alarm is still on when the recording ends.
  'safe-move': r => [
    ['arms on the frame', r.armed > 0],
    ['no alarm while finger stays on the frame (one still active at the end is the lift to stop)',
      r.alarms === 0 || (r.alarms === 1 && r.finalAlarm)],
  ],
  'off-frame-move': r => [
    ['arms on the frame', r.armed > 0],
    ['alarm trips when phone moves off-frame', r.alarms >= 1],
  ],
  'off-frame-still': r => [
    ['arms on the frame', r.armed > 0],
    ['no alarm when phone stays still off-frame', r.alarms === 0],
  ],
  'clean-press': r => [
    ['at least one shot', r.shots.length >= 1],
    ['no alarm', r.alarms === 0],
    ['every shot graded Clean', r.shots.length > 0 && r.shots.every(s => s.grade === 'Clean')],
  ],
  // D-34: a short jerk is graded, not alarmed by the rate/time rule. Since D-56 a jerk (or drift
  // over several follow-up shots) that moves the muzzle more than offFrameDeg from where it pointed
  // when the finger left the frame alarms, so this label no longer requires zero alarms; the
  // under-the-limit case is covered by tests/smoke.js.
  'jerked-press': r => [
    ['at least one shot', r.shots.length >= 1],
    ['at least one shot graded Moved or Jerked', r.shots.some(s => s.grade !== 'Clean')],
  ],
  'press-wobble': r => [
    ['alarm when the phone keeps moving during a press', r.alarms >= 1],
  ],
  'trigger-sweep': r => [
    ['alarm when moving with the finger resting on the trigger', r.alarms >= 1],
    ['no shot fired', r.shots.length === 0],
  ],
  '180-break': r => [
    ['180 alarm when the muzzle passes 90° from downrange', r.b180 >= 1],
    ['alarm clears once back downrange with the finger on the frame', !r.finalAlarm],
  ],
  '180-safe': r => [
    ['no 180 alarm while within 90° of downrange', r.b180 === 0],
    ['no alarm at all (finger stays on the frame)', r.alarms === 0],
  ],
  // WQ-027: Bill Drill. The log starts a run ('r' row) with the finger on the frame; it lifts off for 0.7 s covering the
  // seeded due time (1.43 s after arming), so the beep is deferred: it plays only once the finger has been back on the
  // frame 350 ms (D-104), i.e. >= 350 ms after the OK tone, never in the OK tone's tick.
  'drill-bill': r => {
    const run = r.runs[0], bt = r.beepT, shots6 = r.shotTimes.slice(0, 6);
    const okBefore = r.okTs.filter(t => t <= bt);
    return [
      ['exactly one start beep', r.drillBeeps === 1],
      ['exactly one drill end', r.drillEnds === 1],
      ['no drill cancel', r.drillCancels === 0],
      ['at least six shots', r.shots.length >= 6],
      ['no alarm', r.alarms === 0],
      ['one finished run with six shots, no early shot, no alarm', r.runs.length === 1 && run.shots.length === 6 && run.early === 0 && run.alarms === 0 && run.withAlarm === false],
      ['the beep falls 1000-4000 ms (+ one frame) after the first armed event',
        bt !== undefined && r.firstArmedT !== undefined && bt - r.firstArmedT >= 1000 && bt - r.firstArmedT <= 4000 + 17],
      ['the beep was deferred past the finger-off window: 2250-2317 ms after arming (return + 350 ms hold)',
        bt !== undefined && bt - r.firstArmedT >= 2250 && bt - r.firstArmedT <= 2300 + 17],
      ['the beep comes at least 350 ms after the OK tone of the finger returning',
        okBefore.length >= 1 && bt - okBefore[okBefore.length - 1] >= 350],
      ['all six run shots come after the beep and are the first six shots', shots6.length === 6 && shots6.every(t => t > bt) && r.shotTimes.every(t => t > bt)],
      ['result.first is the first shot minus the beep', !!run && Math.abs(run.first - (shots6[0] - bt)) < 0.01],
    ];
  },
  // WQ-028: Low Ready, five reps (adaptive synthetic recording, see make-synthetic.js). Rep 2 lifts the finger 0.4 s after
  // returning (the 750 ms restarts); rep 4 fires three shots (the extra one stays in the rep, no extra cue). Every figure is
  // derived here from the event times, not from the engine's result object.
  'drill-low-ready': r => {
    const FR = 17, near = (a, b) => Math.abs(a - b) < 0.01;
    const run = r.runs[0], B = r.beepEvs, C = r.cueEvs, endT = r.endTs[0];
    const lastOkBefore = t => { const o = r.okTs.filter(x => x <= t); return o.length ? o[o.length - 1] : undefined; };
    const winEnd = i => i < C.length ? C[i].t : endT;                       // rep i+1 ends at its cue (rep 5: the end)
    const shotsOf = i => r.shotTimes.filter(t => B[i] && t > B[i].t && t <= winEnd(i));
    const reps = [0, 1, 2, 3, 4].map(i => { const s = shotsOf(i); return { s, reaction: s[0] - B[i].t, split: s[1] - s[0] }; });
    const okRep = reps.every(x => x.s.length >= 2);
    const cleanReact = okRep ? reps.map(x => x.reaction) : [];
    return [
      ['five start beeps, reps 1-5 in order', r.drillBeeps === 5 && B.map(b => b.rep).join() === '1,2,3,4,5'],
      ['four cues, reps 1-4 in order, cue "lowready"', r.drillCues === 4 && C.map(c => c.rep).join() === '1,2,3,4' && C.every(c => c.cue === 'lowready')],
      ['one drill end, no cancel, no alarm', r.drillEnds === 1 && r.drillCancels === 0 && r.alarms === 0],
      ['order: beep, cue, beep, cue, ... beep, end', r.drillBeeps === 5 && r.drillCues === 4 && B.every((b, i) => b.t < winEnd(i)) && C.every((c, i) => c.t < B[i + 1].t) && endT > B[4].t],
      ['each cue comes 750 ms (+ one frame) after the LAST ok before it (the finger returning)',
        C.length === 4 && C.every(c => { const o = lastOkBefore(c.t); return o !== undefined && c.t - o >= 750 && c.t - o <= 750 + FR; })],
      ['the end comes 750 ms (+ one frame) after the last ok before it',
        endT !== undefined && (() => { const o = lastOkBefore(endT); return o !== undefined && endT - o >= 750 && endT - o <= 750 + FR; })()],
      ['rep 2 (finger lifted 0.4 s after returning) has two ok events before its cue, 600 ms apart: the 750 ms restarted',
        C.length >= 2 && (() => { const o = r.okTs.filter(x => x > B[1].t && x < C[1].t); return o.length === 2 && Math.abs(o[1] - o[0] - 600) <= FR; })()],
      ['rep 1 beep 2000-5000 ms (+ one frame) after arming (finger on the frame from the start, hold already met)',
        B.length > 0 && r.firstArmedT !== undefined && B[0].t - r.firstArmedT >= 2000 && B[0].t - r.firstArmedT <= 5000 + FR],
      ['reps 2-5: each beep 2000-5000 ms (+ one frame) after the cue before it',
        B.length === 5 && C.length === 4 && [1, 2, 3, 4].every(i => B[i].t - C[i - 1].t >= 2000 && B[i].t - C[i - 1].t <= 5000 + FR)],
      ['eleven shots in all: 2, 2, 2, 3, 2 per rep (the extra shot stays in rep 4)', r.shotTimes.length === 11 && B.length === 5 && [2, 2, 2, 3, 2].every((n, i) => shotsOf(i).length === n)],
      ['state.drillRuns holds one run with five reps (cancel-free)', r.runs.length === 1 && !!run && run.reps.length === 5 && run.drill === 'lowready'],
      ['per rep: reaction = shot 1 - beep and split = shot 2 - shot 1, from the event times',
        !!run && okRep && run.reps.every((p, i) => near(p.reaction, reps[i].reaction) && near(p.split, reps[i].split) && p.rep === i + 1 && near(p.beepT, B[i].t))],
      ['per rep: shot counts 2, 2, 2, 3, 2; no early shots; no alarm', !!run && run.reps.map(p => p.shots.length).join() === '2,2,2,3,2' && run.reps.every(p => p.early === 0 && p.alarms === 0 && p.withAlarm === false)],
      ['total = end - rep 1 beep', !!run && B.length > 0 && near(run.total, endT - B[0].t) && near(run.endT, endT) && near(run.beepT, B[0].t)],
      ['avgReaction / bestReaction = mean / min of the per-rep reactions from the events',
        !!run && okRep && near(run.avgReaction, cleanReact.reduce((a, b) => a + b, 0) / 5) && near(run.bestReaction, Math.min(...cleanReact))],
      ['run-level early 0, alarms 0, withAlarm false', !!run && run.early === 0 && run.alarms === 0 && run.withAlarm === false],
      ['Low Ready reps carry reaction / split and no Box fields (no time, no splits, no startT)', !!run && run.reps.every(p => !('time' in p) && !('splits' in p) && !('startT' in p) && 'reaction' in p && 'split' in p)],
    ];
  },
  // WQ-051: shared Low Ready (a class code): the same presses as 'drill-low-ready', but the beeps come from the wall-clock
  // schedule TDT.slotAt(seed, cycle, k). Wall time of a beep = engine t + (wall - t of the 'r' row).
  'drill-low-ready-class': r => {
    const FR = 17, TDT = require('../engine.js');
    const run = r.runs[0], B = r.beepEvs, C = r.cueEvs, rr = r.rRow;
    const have = !!rr && rr.length === 5 && B.length === 5 && C.length === 4 && !!run && run.reps.length === 5;
    const off = have ? rr[4] - rr[1] : NaN, seed = have ? rr[3] : 0, cyc = TDT.DEFAULTS.classCycleMs;
    const wallOf = b => b.t + off;
    const slots = have ? run.reps.map(p => p.slot) : [];
    return [
      ['the r row carries a wall time (five elements, finite)', !!rr && rr.length === 5 && Number.isFinite(rr[4])],
      ['five start beeps, reps 1-5 in order; four cues; one drill end; no cancel; no alarm',
        r.drillBeeps === 5 && B.map(b => b.rep).join() === '1,2,3,4,5' && r.drillCues === 4 && r.drillEnds === 1 && r.drillCancels === 0 && r.alarms === 0],
      [`every beep falls on its slot: wall time of the beep = TDT.slotAt(seed, ${cyc}, slot) within one frame`,
        have && run.reps.every((p, i) => Math.abs(wallOf(B[i]) - TDT.slotAt(seed, cyc, p.slot)) <= FR)],
      ['slot jitter: each slot time lies in [k * cycle, k * cycle + 3000)',
        have && slots.every(k => { const w = TDT.slotAt(seed, cyc, k); return w >= k * cyc && w < k * cyc + 3000; })],
      ['rep 1 beep is at least 1500 ms after the arming tick (join margin), by wall time',
        have && r.firstArmedT !== undefined && B[0].t - r.firstArmedT >= 1500 - 0.5],
      ['reps 2-5: each beep is at least 1500 ms after the cue before it',
        have && [1, 2, 3, 4].every(i => B[i].t - C[i - 1].t >= 1500 - 0.5)],
      ['the beeps are the earliest slots meeting the margin (no earlier slot would have qualified), rep 1',
        have && r.firstArmedT !== undefined && TDT.nextSlotAfter(seed, cyc, r.firstArmedT + off + 1500, false) === slots[0]],
      ['reps 2-5: each slot is the earliest at or after cue + 1500 ms (the finger was on the frame for the hold, so none skipped)',
        have && [1, 2, 3, 4].every(i => TDT.nextSlotAfter(seed, cyc, C[i - 1].t + off + 1500, false) === slots[i])],
      ['slots strictly increasing', have && slots.every((k, i) => i === 0 || k > slots[i - 1])],
      ['the result and every rep carry shared: true, and a numeric slot',
        have && run.shared === true && run.reps.every(p => p.shared === true && Number.isInteger(p.slot))],
      ['one finished run, lowready, five reps, two shots per rep (three in rep 4), no early, no alarm',
        have && run.drill === 'lowready' && run.reps.map(p => p.shots.length).join() === '2,2,2,3,2' && run.early === 0 && run.alarms === 0],
    ];
  },
  // WQ-029: Box Drill, five positions (adaptive synthetic recording, see make-synthetic.js). Position 2 fires three shots (the
  // extra one stays in the position); position 3 returns the finger to the frame after ONE shot and holds it 1.3 s: that return
  // gives an ok but no cue, and the cue follows the second shot's return. Every figure is derived here from the event times.
  'drill-box': r => {
    const FR = 17, near = (a, b) => Math.abs(a - b) < 0.01;
    const run = r.runs[0], B = r.beepEvs, C = r.cueEvs, endT = r.endTs[0];
    const start = i => i === 0 ? (B[0] && B[0].t) : C[i - 1] && C[i - 1].t;       // position i+1 opens at the beep / the previous cue
    const winEnd = i => i < C.length ? C[i].t : endT;                              // and closes at its cue (position 5: the end)
    const shotsOf = i => r.shotTimes.filter(t => t > start(i) && t <= winEnd(i));
    const have = B.length === 1 && C.length === 4 && endT !== undefined;
    const pos = have ? [0, 1, 2, 3, 4].map(i => { const s = shotsOf(i); return { s, time: s[0] - start(i), splits: s.slice(1).map((x, k) => x - s[k]) }; }) : [];
    const okPos = pos.length === 5 && pos.every(x => x.s.length >= 2);
    const lastShot = okPos ? pos[4].s[pos[4].s.length - 1] : undefined;
    return [
      ['exactly one start beep (rep 1): positions 2-5 start at the cue, with no beep', r.drillBeeps === 1 && B[0].rep === 1],
      ['four cues, positions 1-4 in order, cue "move" (and no Low Ready cue)', r.drillCues === 4 && C.map(c => c.rep).join() === '1,2,3,4' && C.every(c => c.cue === 'move')],
      ['one drill end, no cancel, no alarm', r.drillEnds === 1 && r.drillCancels === 0 && r.alarms === 0],
      ['order: beep, cue, cue, cue, cue, end', have && B[0].t < C[0].t && C.every((c, i) => i === 0 || C[i - 1].t < c.t) && C[3].t < endT],
      ['every cue has the same t as an ok event (the finger returning)', C.length === 4 && C.every(c => r.okTs.includes(c.t))],
      ['the end has the same t as an ok event', endT !== undefined && r.okTs.includes(endT)],
      ['eleven shots in all: 2, 3, 2, 2, 2 per position (the extra shot stays in position 2)', have && r.shotTimes.length === 11 && [2, 3, 2, 2, 2].every((n, i) => shotsOf(i).length === n)],
      ['every cue comes after at least two shots at its position', have && [0, 1, 2, 3].every(i => shotsOf(i).length >= 2)],
      ['one-shot return (position 3): an ok falls between shot 1 and shot 2, but no cue does',
        have && (() => { const s = shotsOf(2); return s.length === 2 && r.okTs.some(o => o > s[0] && o < s[1]) && !C.some(c => c.t > s[0] && c.t < s[1]) && !C.some(c => c.t === s[0]); })()],
      ['that one-shot return holds the finger on the frame well over a second before shot 2 (no cue yet)',
        have && (() => { const s = shotsOf(2), o = r.okTs.filter(x => x > s[0] && x < s[1])[0]; return o !== undefined && s[1] - o >= 1000; })()],
      ['the cue of position 3 is the ok after its second shot, not the earlier ok', have && (() => { const s = shotsOf(2); return C[2].t > s[1] && r.okTs.filter(o => o > s[1] && o <= C[2].t).includes(C[2].t); })()],
      ['the beep falls 1000-4000 ms (+ one frame) after arming (finger on the frame from the start, hold already met)',
        B.length > 0 && r.firstArmedT !== undefined && B[0].t - r.firstArmedT >= 1000 && B[0].t - r.firstArmedT <= 4000 + FR],
      ['all shots come after the beep; the walk after each cue lasts about a second before the next position\'s first shot',
        have && r.shotTimes.every(t => t > B[0].t) && [1, 2, 3, 4].every(i => pos[i].time >= 1000 && pos[i].time <= 1500)],
      ['state.drillRuns holds one run with five positions (cancel-free), drill "box"', r.runs.length === 1 && !!run && run.reps.length === 5 && run.drill === 'box'],
      ['per position: startT = beep / previous cue, beepT only on position 1, rep = 1..5',
        !!run && have && run.reps.every((p, i) => p.rep === i + 1 && near(p.startT, start(i)) && (i === 0 ? near(p.beepT, B[0].t) : p.beepT === null))],
      ['per position: time = first shot - (beep | previous cue), splits = shot gaps, from the event times',
        !!run && okPos && run.reps.every((p, i) => near(p.time, pos[i].time) && p.splits.length === pos[i].splits.length && p.splits.every((x, k) => near(x, pos[i].splits[k])))],
      ['per position: shot counts 2, 3, 2, 2, 2; no early shots; no alarm',
        !!run && run.reps.map(p => p.shots.length).join() === '2,3,2,2,2' && run.reps.every(p => p.early === 0 && p.alarms === 0 && p.withAlarm === false)],
      ['total = last shot of position 5 - beep (not the end event)', !!run && okPos && near(run.total, lastShot - B[0].t) && near(run.endT, endT) && near(run.beepT, B[0].t) && run.total < endT - B[0].t - 10],
      ['run-level early 0, alarms 0, withAlarm false', !!run && run.early === 0 && run.alarms === 0 && run.withAlarm === false],
      ['Box positions carry time / splits and no Low Ready fields (no reaction, no split)', !!run && run.reps.every(p => !('reaction' in p) && !('split' in p) && 'time' in p && Array.isArray(p.splits)) && !('avgReaction' in run)],
    ];
  },
  // WQ-030: Transitions. Structural checks apply to every recording with this label (real phones too); the timing, grade and
  // no-alarm checks hold only for the generated synthetic one (r.synthetic), whose swings and presses are scripted. Every figure
  // is derived here from the event times.
  'drill-transitions': r => {
    const FR = 17, near = (a, b) => Math.abs(a - b) < 0.01, run = r.runs[0], B = r.beepEvs, endT = r.endTs[0], st = r.shotTimes;
    const have = B.length === 1 && st.length === 10 && endT !== undefined;
    const gaps = have ? st.slice(1).map((x, i) => x - st[i]) : [];
    const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
    const out = [
      ['exactly one start beep (rep 1), no cue, no cancel, one drill end', r.drillBeeps === 1 && B[0].rep === 1 && r.drillCues === 0 && r.drillCancels === 0 && r.drillEnds === 1],
      ['the beep falls 2000-5000 ms (+ one frame) after arming', B.length > 0 && r.firstArmedT !== undefined && B[0].t - r.firstArmedT >= 2000 && B[0].t - r.firstArmedT <= 5000 + FR],
      ['ten shots, all after the beep, the drill end after the tenth', have && st.every(t => t > B[0].t) && endT > st[9]],
      ['no alarmStart between shot 1 and shot 10 (the window)', have && !r.alarmTs.some(t => t >= st[0] && t <= st[9])],
      ['the end has the same t as an ok event (the finger back on the frame)', endT !== undefined && r.okTs.includes(endT)],
      ['state.drillRuns holds one run, drill "transitions", ten shots, nine splits', r.runs.length === 1 && !!run && run.drill === 'transitions' && run.shots.length === 10 && run.splits.length === 9],
      ['first = shot 1 - beep; total = shot 10 - beep (not the end); endT = the drillEnd t',
        !!run && have && near(run.first, st[0] - B[0].t) && near(run.total, st[9] - B[0].t) && near(run.endT, endT) && near(run.beepT, B[0].t) && run.total < endT - B[0].t - 10],
      ['splits = the nine shot gaps', !!run && have && run.splits.every((x, i) => near(x, gaps[i]))],
      ['pairSplits = splits 1-2, 3-4, 5-6, 7-8, 9-10 (indices 0, 2, 4, 6, 8; five)', !!run && have && run.pairSplits.length === 5 && run.pairSplits.every((x, i) => near(x, gaps[2 * i]))],
      ['transitions = splits 2-3, 4-5, 6-7, 8-9 (indices 1, 3, 5, 7; four)', !!run && have && run.transitions.length === 4 && run.transitions.every((x, i) => near(x, gaps[2 * i + 1]))],
      ['avgTransition = the mean of the four transitions (4 decimals)', !!run && have && Math.abs(run.avgTransition - mean(gaps.filter((_, i) => i % 2 === 1))) < 0.001],
      ['a Transitions result carries no Low Ready / Box fields (reps, time, reaction, avgReaction)', !!run && !('reps' in run) && !('time' in run) && !('reaction' in run) && !('avgReaction' in run)],
    ];
    if (r.synthetic) out.push(
      ['synthetic: no alarm at all, every shot graded Clean (the phone is still during each press), none unsafe',
        r.alarms === 0 && r.alarmTs.length === 0 && r.shots.length === 10 && r.shots.every(s => s.grade === 'Clean') && !!run && run.shots.every(x => !x.unsafe && x.grade !== 'alarm')],
      ['synthetic: pair splits are 500 ms (+- one frame), transitions 1900 ms (+- one frame: the 0.5 s swing sits inside)',
        !!run && have && run.pairSplits.every(x => Math.abs(x - 500) <= FR) && run.transitions.every(x => Math.abs(x - 1900) <= FR)],
      ['synthetic: run-level early 0, alarms 0, withAlarm false', !!run && run.early === 0 && run.alarms === 0 && run.withAlarm === false]);
    return out;
  },
  'axis-up': r => [
    ['largest excursion reads as muzzle UP', dominant(r.peak, 'v', +1)],
  ],
  // WQ-031 (D-113, D-115): only a touch that lands while no other touch controls counts (tests/make-synthetic.js).
  'two-finger': r => {
    const T0 = 1000, at = s => T0 + s * 1000, inside = (x, a, b) => x >= at(a) && x < at(b);
    return [
      ['arms on the frame', r.armed >= 1 && r.firstArmedT < at(0.1)],
      ['the second finger on the trigger beside the frame finger never engages, not after the frame finger lifts either',
        !r.trigOnTs.some(x => inside(x, 1.0, 3.0))],
      ['exactly one shot, from the fresh finger at 3.1-3.4 s', r.shotTimes.length === 1 && inside(r.shotTimes[0], 3.1, 3.45)],
      ['exactly one trigger contact (the fresh finger at 3.0 s)', r.trigOnTs.length === 1 && inside(r.trigOnTs[0], 3.0, 3.05)],
      ['no OK tone from the strip finger beside the trigger or after the trigger finger lifts; the next one is the fresh finger',
        !r.okTs.some(x => inside(x, 0.2, 5.2)) && r.okTs.some(x => inside(x, 5.2, 5.4))],
      ['no alarm (the phone stays still)', r.alarms === 0],
    ];
  },
  'axis-right': r => [
    ['largest excursion reads as muzzle RIGHT', dominant(r.peak, 'h', +1)],
  ],
};
