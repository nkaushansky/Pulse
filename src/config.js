'use strict';
/* ============================================================
   PULSE v1 — Frequency-style rhythm tunnel
   All timing derives from audioContext.currentTime. rAF is
   visuals-only. Lookahead scheduler per "A Tale of Two Clocks".
   ============================================================ */

/* ---------------- timing constants ---------------- */
const BPM = 120;
const SPB = 60 / BPM;            // seconds per beat (0.5)
const SPBAR = SPB * 4;           // seconds per bar (2.0)
const S16 = SPB / 4;             // seconds per 16th (0.125)
const STEPS_PER_BAR = 16;
const STEPS_PER_PHRASE = 32;     // phrase = 2 bars
const PHRASE_SEC = SPBAR * 2;    // 4.0s
const PHRASE_BARS = 2;
const CAPTURE_PHRASES = 4;       // 8 bars
const HIT_WINDOW = 0.090;
const PERFECT_WINDOW = 0.040;

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

