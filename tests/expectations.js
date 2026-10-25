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
  'axis-up': r => [
    ['largest excursion reads as muzzle UP', dominant(r.peak, 'v', +1)],
  ],
  'axis-right': r => [
    ['largest excursion reads as muzzle RIGHT', dominant(r.peak, 'h', +1)],
  ],
};
