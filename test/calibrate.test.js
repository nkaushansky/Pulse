#!/usr/bin/env node
'use strict';
/* V2 §4 latency calibration — the outside-the-browser logic:
     - calibMedian / calibClamp (the tap-along math, src/calibrate.js)
     - CALIB_OFFSET wiring: applySettings() maps the stored ms onto the
       seconds offset, and applyCalibration() shifts judgment by exactly
       that amount (src/config.js + src/game.js)
     - round-trip through the SAVE blob (src/save.js)
   Acceptance (spec §4): an artificial +80ms offset shifts judgment by
   exactly +80ms, and calibration round-trips through storage.
   Run: node test/calibrate.test.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const SRC = path.join(__dirname, '..', 'src');
const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');

/* minimal in-memory localStorage so SAVE is persistent in the test */
function fakeStore(seed){
  const m = Object.assign({}, seed);
  return {
    _m: m,
    getItem(k){ return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem(k, v){ m[k] = String(v); },
    removeItem(k){ delete m[k]; }
  };
}
function load(files, store){
  const ctx = vm.createContext({ console, window: { localStorage: store } });
  for (const f of files) vm.runInContext(read(f), ctx, { filename:f });
  return ctx;
}
const run = (ctx, expr) => vm.runInContext(expr, ctx);
const approx = (ctx, expr, want, msg) => {
  const got = run(ctx, expr);
  assert(Math.abs(got - want) < 1e-9, (msg || expr) + ' — got ' + got + ', want ' + want);
};
const eq = (ctx, expr, want, msg) => assert.strictEqual(run(ctx, expr), want, msg || expr);

/* ---- context A: fresh store, set the offset here ---- */
const storeA = fakeStore();
const A = load(['config.js', 'save.js', 'game.js', 'calibrate.js'], storeA);

// median: odd, even, and signed (early taps are negative)
approx(A, 'calibMedian([0.01, 0.02, 0.03])', 0.02, 'odd-count median');
approx(A, 'calibMedian([0, 0.02, 0.04, 0.06])', 0.03, 'even-count median averages the middle two');
approx(A, 'calibMedian([-0.05, -0.01, 0.03])', -0.01, 'signed median');
approx(A, 'calibMedian([])', 0, 'empty median is 0');
// order independence
approx(A, 'calibMedian([0.03, -0.05, -0.01])', -0.01, 'median ignores input order');

// clamp rounds to whole ms and bounds to +/-200
eq(A, 'calibClamp(83.4)', 83, 'clamp rounds');
eq(A, 'calibClamp(250)', 200, 'clamp upper bound');
eq(A, 'calibClamp(-250)', -200, 'clamp lower bound');

// default (no setting): CALIB_OFFSET is 0 → applyCalibration is identity
run(A, 'applySettings()');
approx(A, 'CALIB_OFFSET', 0, 'default offset is 0');
approx(A, 'applyCalibration(12.34)', 12.34, 'no offset = identity');

// the acceptance case: +80ms must shift judgment by exactly +80ms.
// judged error of a tap = applyCalibration(rawTapTime) - gemTime.
run(A, 'SAVE.setSetting("calibrationMs", 80); applySettings();');
approx(A, 'CALIB_OFFSET', 0.080, '80 ms stored → 0.080 s offset');
// a tap 80ms after the gem now judges as exactly on-time (error 0)
approx(A, 'applyCalibration(10.08) - 10.0', 0.0, '+80ms tap judged on-time under +80ms offset');
// and the difference vs. the uncalibrated judgment is exactly 80ms
approx(A, '(10.08 - 0 - 10.0) - (applyCalibration(10.08) - 10.0)', 0.080,
  'offset shifts the judged moment by exactly +80ms');

/* ---- context B: reload from A's persisted blob → round-trip ---- */
const blob = storeA._m[run(A, 'SAVE_KEY')];
assert(typeof blob === 'string' && blob.length, 'SAVE wrote a blob to storage');
const storeB = fakeStore({ [run(A, 'SAVE_KEY')]: blob });
const B = load(['config.js', 'save.js', 'game.js'], storeB);
eq(B, 'SAVE.getSetting("calibrationMs", 0)', 80, 'calibrationMs survives a reload');
run(B, 'applySettings()');
approx(B, 'CALIB_OFFSET', 0.080, 'reloaded offset re-derives to 0.080 s');

console.log('calibrate.test: OK');
