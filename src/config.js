'use strict';
/* ============================================================
   PULSE v1 — Frequency-style rhythm tunnel
   All timing derives from audioContext.currentTime. rAF is
   visuals-only. Lookahead scheduler per "A Tale of Two Clocks".
   ============================================================ */

/* ---------------- timing constants ----------------
   Grid shape is fixed; tempo-derived values are per-song (V2 §2)
   and assigned by applySongTiming() when a song is selected. */
const STEPS_PER_BAR = 16;
const STEPS_PER_PHRASE = 32;     // phrase = 2 bars
const PHRASE_BARS = 2;
const CAPTURE_PHRASES = 4;       // 8 bars

/* Judgment windows are settings-scaled (V2 §6); defaults are V1's
   values exactly. Assigned by applySettings(). */
let HIT_WINDOW = 0.090;
let PERFECT_WINDOW = 0.040;
const WINDOW_PRESETS = { strict:0.070, normal:0.090, relaxed:0.120 };

function applySettings(){
  const wm = SAVE.getSetting('windowMode', 'normal');
  HIT_WINDOW = WINDOW_PRESETS[wm] || WINDOW_PRESETS.normal;
  PERFECT_WINDOW = 0.040 * (HIT_WINDOW / 0.090);   // scales proportionally
}

let BPM = 120;
let SPB = 60 / BPM;              // seconds per beat
let SPBAR = SPB * 4;             // seconds per bar
let S16 = SPB / 4;               // seconds per 16th
let PHRASE_SEC = SPBAR * PHRASE_BARS;
let TOTAL_PHRASES = 0;           // set per song
let TOTAL_STEPS = 0;

const CONFIG = {
  speed: 18,            // world units per second of song time
  spawnAhead: 7.0,      // seconds of gems visible down the tunnel
  hitZ: -11,            // now-line distance in front of camera (must stay inside bottom of FOV)
  tunnelRadius: 6,
  rotateTween: 0.15,    // seconds
  countInBeats: 3,
  // Input abstraction: game logic only ever sees semantic actions.
  keymap: {
    KeyJ:'lane0', KeyK:'lane1', KeyL:'lane2',
    ArrowLeft:'lane0', ArrowDown:'lane1', ArrowRight:'lane2',
    KeyQ:'rotateLeft', KeyE:'rotateRight',
    KeyA:'rotateLeft', KeyD:'rotateRight',
    Escape:'pause'
  },
  // HUD labels come from config, never from keycode assumptions.
  inputLabels: {
    lane0:'J', lane1:'K', lane2:'L',
    lanesAlt:'\u2190 \u2193 \u2192',
    rotateLeft:'Q / A', rotateRight:'E / D', pause:'ESC'
  }
};

const LANE_COLORS = [0x33eeff, 0xff44dd, 0xffcc33];

