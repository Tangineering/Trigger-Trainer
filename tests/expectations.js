// What each recording label must produce when replayed. Each returns [[description, pass], ...].
// r = summary from replay.js: { alarms, shots[], armed, peak: {h, v} }

const dominant = (p, axis, sign) => {
  const main = axis === 'v' ? p.v : p.h, other = axis === 'v' ? p.h : p.v;
  return Math.sign(main) === sign && Math.abs(main) > Math.abs(other);
};

module.exports = {
  'free': () => [],
  'safe-move': r => [
    ['arms on the frame', r.armed > 0],
    ['no alarm while finger stays on the frame', r.alarms === 0],
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
  'jerked-press': r => [
    ['at least one shot', r.shots.length >= 1],
    ['at least one shot graded Moved or Jerked', r.shots.some(s => s.grade !== 'Clean')],
  ],
  'axis-up': r => [
    ['largest excursion reads as muzzle UP', dominant(r.peak, 'v', +1)],
  ],
  'axis-right': r => [
    ['largest excursion reads as muzzle RIGHT', dominant(r.peak, 'h', +1)],
  ],
};
