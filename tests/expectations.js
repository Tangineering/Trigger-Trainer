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
  // WQ-027: Bill Drill. The log starts a run ('r' row) with the finger already on the frame, so the beep comes
  // 1000-4000 ms after the first armed event (plus up to one 17 ms frame); six presses follow, finger back at the end.
  'drill-bill': r => [
    ['exactly one start beep', r.drillBeeps === 1],
    ['exactly one drill end', r.drillEnds === 1],
    ['no drill cancel', r.drillCancels === 0],
    ['at least six shots', r.shots.length >= 6],
    ['no alarm', r.alarms === 0],
    ['the beep falls 1000-4000 ms (+ one frame) after the first armed event',
      r.beepT !== undefined && r.firstArmedT !== undefined && r.beepT - r.firstArmedT >= 1000 && r.beepT - r.firstArmedT <= 4000 + 17],
    ['every one of the six run shots comes after the beep', r.shotTimes.length >= 6 && r.shotTimes.slice(0, 6).every(t => t > r.beepT)],
  ],
  'axis-up': r => [
    ['largest excursion reads as muzzle UP', dominant(r.peak, 'v', +1)],
  ],
  'axis-right': r => [
    ['largest excursion reads as muzzle RIGHT', dominant(r.peak, 'h', +1)],
  ],
};
