/* ---------------- latency calibration (V2 §4) ----------------
   A tap-along screen: a steady tick plays on the master clock; the player
   taps each beat; the median signed offset over ~16 taps becomes the saved
   calibration, with a manual +/- ms nudge. The offset is applied to
   JUDGMENT timing only (game.js: applyCalibration / judgeNow) — never to
   audio or visual scheduling — and is stored via SAVE as `calibrationMs`.

   Like song-select, this is a menu utility, not gameplay: its taps are
   captured here (the calib overlay sits above the touch lane zones) and do
   not flow through INPUT.emit. All tick scheduling derives from
   audio.ctx.currentTime (master-clock rule); the 25ms setInterval is only
   the scheduler driver, exactly as the game's lookahead scheduler. */

const CALIB_BPM = 120;
const CALIB_PERIOD = 60 / CALIB_BPM;   // seconds between ticks (0.5s)
const CALIB_TAPS = 16;                 // samples for the median (~16, per spec)
const CALIB_CLAMP = 200;               // manual nudge bound, +/- ms

let calibTimer = null;
let calibNextTick = 0;                 // audio-clock time of the next tick to schedule
let calibTickTimes = [];               // recently scheduled tick times (audio clock)
let calibSamples = [];                 // rolling signed tap offsets, seconds (+ = late)
let calibWorkingMs = 0;                // the value being edited / about to be saved
let calibMeasuredMs = null;            // last completed 16-tap median, or null

/* pure: signed median of a sample list (Node-tested in test/calibrate.test.js) */
function calibMedian(arr){
  const a = arr.slice().sort((x, y) => x - y);
  const n = a.length;
  if (!n) return 0;
  return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
}
function calibClamp(ms){ return Math.max(-CALIB_CLAMP, Math.min(CALIB_CLAMP, Math.round(ms))); }
function calibFmt(ms){ return (ms > 0 ? '+' : '') + ms + ' ms'; }

/* lookahead tick scheduler — same 25ms/120ms pattern as the game */
function calibScheduler(){
  if (appState !== 'calibrate' || !audio.ctx) return;
  const ahead = audio.ctx.currentTime + 0.12;
  while (calibNextTick < ahead){
    playVoice('tickHi', calibNextTick, 81, 0.08, audio.master);
    calibTickTimes.push(calibNextTick);
    if (calibTickTimes.length > 64) calibTickTimes.shift();
    calibNextTick += CALIB_PERIOD;
  }
}

/* one tap: its signed distance to the nearest scheduled tick (audio clock) */
function calibTap(){
  if (appState !== 'calibrate' || !audio.ctx) return;
  const now = audio.ctx.currentTime;
  let nearest = Infinity;              // signed now-tick, picks the closest tick
  for (const tt of calibTickTimes){
    if (Math.abs(now - tt) < Math.abs(nearest)) nearest = now - tt;
  }
  if (nearest === Infinity) return;    // no tick scheduled yet
  calibSamples.push(nearest);
  if (calibSamples.length > CALIB_TAPS) calibSamples.shift();
  if (calibSamples.length >= CALIB_TAPS){
    calibMeasuredMs = calibClamp(calibMedian(calibSamples) * 1000);
    calibWorkingMs = calibMeasuredMs;
  }
  const z = document.getElementById('calibtap');
  z.classList.remove('flash'); void z.offsetWidth; z.classList.add('flash');
  renderCalib();
}

function calibNudge(deltaMs){
  if (appState !== 'calibrate') return;
  calibWorkingMs = calibClamp(calibWorkingMs + deltaMs);
  renderCalib();
}

function calibRestart(){
  calibSamples = [];
  calibMeasuredMs = null;
  if (audio.ctx){ calibTickTimes = []; calibNextTick = audio.ctx.currentTime + 0.4; }
  renderCalib();
}

function renderCalib(){
  document.getElementById('calib-count').textContent =
    Math.min(calibSamples.length, CALIB_TAPS) + ' / ' + CALIB_TAPS;
  const meas = document.getElementById('calib-measured');
  if (calibMeasuredMs === null){
    meas.textContent = calibSamples.length ? 'KEEP TAPPING…' : 'TAP ON EACH TICK';
  } else {
    meas.textContent = 'MEASURED ' + calibFmt(calibMeasuredMs);
  }
  document.getElementById('calib-value').textContent = calibFmt(calibWorkingMs);
}

function enterCalibrate(){
  appState = 'calibrate';
  if (!audio.ctx) initAudio();         // reached via a tap/click — audio gesture
  warmUpAudio();
  audio.ctx.resume();
  document.getElementById('calibprompt').classList.add('hidden');
  ui.select.classList.add('hidden');
  ui.settings.classList.add('hidden');
  calibSamples = [];
  calibMeasuredMs = null;
  calibWorkingMs = calibClamp(SAVE.getSetting('calibrationMs', 0));
  calibTickTimes = [];
  calibNextTick = audio.ctx.currentTime + 0.4;
  if (!calibTimer) calibTimer = setInterval(calibScheduler, 25);
  renderCalib();
  document.getElementById('calib').classList.remove('hidden');
}

function exitCalibrate(save){
  if (calibTimer){ clearInterval(calibTimer); calibTimer = null; }
  if (save){
    SAVE.setSetting('calibrationMs', calibWorkingMs);
    applySettings();                   // CALIB_OFFSET updates live (no restart)
  }
  document.getElementById('calib').classList.add('hidden');
  enterSettings();                     // back to OPTIONS
}

/* first-run suggestion: touch devices that haven't calibrated yet get a
   one-time prompt the first time they reach song select (spec §4) */
function maybeSuggestCalibration(){
  if (!document.body.classList.contains('touch')) return;
  if (SAVE.getSetting('calibPrompted', false)) return;
  if (calibClamp(SAVE.getSetting('calibrationMs', 0)) !== 0) return;
  SAVE.setSetting('calibPrompted', true);
  document.getElementById('calibprompt').classList.remove('hidden');
}

/* DOM wiring deferred to boot (called from main.js) so the module loads
   cleanly outside the browser for the Node test */
function initCalibrate(){
  const z = document.getElementById('calibtap');
  z.addEventListener('touchstart', e => { e.preventDefault(); calibTap(); }, { passive:false });
  z.addEventListener('mousedown', () => calibTap());
  document.getElementById('calib-minus').addEventListener('click', () => calibNudge(-5));
  document.getElementById('calib-plus').addEventListener('click', () => calibNudge(5));
  document.getElementById('calib-restart').addEventListener('click', calibRestart);
  document.getElementById('calib-save').addEventListener('click', () => exitCalibrate(true));
  document.getElementById('calib-cancel').addEventListener('click', () => exitCalibrate(false));
  document.getElementById('cp-yes').addEventListener('click', enterCalibrate);
  document.getElementById('cp-skip').addEventListener('click',
    () => document.getElementById('calibprompt').classList.add('hidden'));
}
