# Contributing

Thanks for helping. This is a small, free teaching aid; Ricky Tan (Tangineering) decides its scope, and every
decision is logged in [`docs/DECISIONS.md`](docs/DECISIONS.md).

- **Report a problem** as a [GitHub issue](https://github.com/Tangineering/Trigger-Trainer/issues). Name the phone
  model, the OS version and the browser, and the `Engine x.y.z` line from the bottom of Settings.
- **Attach a recording** if you can: Settings → **Record test data** (how-to in [`docs/RECORDINGS.md`](docs/RECORDINGS.md)).
  It is the most useful thing you can send. A contributed recording is committed to this repository under the MIT
  licence; it contains the browser's user-agent string, motion samples and touch positions (plus the screen size,
  settings, label, notes and date) and nothing else. Keep names out of the notes: phone model, grip and hand are enough.
- **Before a pull request**, run `npm test` (see README "Develop"). The replay check in
  [`.github/workflows/test.yml`](.github/workflows/test.yml) must be green on the pull request.
- **Thresholds and logic** change only with the replay suite's say-so: real-phone recordings in `tests/recordings/`
  are the ground truth. Run `npm run test:replay`, say which recordings change outcome, and never edit a recording
  to make it pass.
- **Versions:** a `VERSION` bump in `engine.js` adds a section to [`CHANGELOG.md`](CHANGELOG.md) in the same commit.
- **Planning:** outstanding work is in [`WORK_QUEUE.md`](WORK_QUEUE.md), finished work in
  [`WORK_COMPLETED.md`](WORK_COMPLETED.md), open questions in [`OPEN_QUESTIONS.md`](OPEN_QUESTIONS.md).
  [`CLAUDE.md`](CLAUDE.md) is the operating manual (constraints, architecture, working rules).
- Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md). Security: [`SECURITY.md`](SECURITY.md).
