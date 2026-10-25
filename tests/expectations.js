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
    ];
  },
  'axis-up': r => [
    ['largest excursion reads as muzzle UP', dominant(r.peak, 'v', +1)],
  ],
  'axis-right': r => [
    ['largest excursion reads as muzzle RIGHT', dominant(r.peak, 'h', +1)],
  ],
};
