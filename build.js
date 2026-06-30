#!/usr/bin/env node
'use strict';
/* PULSE build: concatenate src/ modules into dist/pulse.html.
   No dependencies, no transforms — modules are spliced verbatim into
   src/template.html at the {{MODULES}} placeholder, so the output is a
   single self-contained file with the same external-request profile as
   V1 (Three.js r128 from cdnjs is the only external request).

   MODULE ORDER IS LOAD ORDER. The files below execute top-to-bottom in
   one script scope, exactly like the original single <script> block. */

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const OUT = path.join(__dirname, 'dist', 'pulse.html');

const MODULES = [
  'config.js',      // timing constants, CONFIG (keymap, inputLabels), lane colors
  'save.js',        // persistence: versioned localStorage blob (bests, settings)
  'instruments.js', // INSTRUMENTS synth-patch registry
  'song.js',        // SONG package + prepareSong() chart expansion
  'audio.js',       // audio graph, playVoice, stem stub, lookahead scheduler
  'scene.js',       // three.js tunnel, walls, gems, rotation tween, wall visuals
  'hitzone.js',     // per-press hit-zone feedback (showJudge, pressFeedback)
  'game.js',        // game state G + rules (capture, break, judge, finish)
  'input.js',       // semantic input layer + keyboard backend + flow events
  'hud.js',         // DOM HUD, status ring, title screen
  'calibrate.js',   // latency calibration screen (V2 §4)
  'main.js'         // rAF loop (visuals only) + boot
];

const template = fs.readFileSync(path.join(SRC, 'template.html'), 'utf8');
const PLACEHOLDER = '/*{{MODULES}}*/\n';
if (!template.includes(PLACEHOLDER)) {
  console.error('build: {{MODULES}} placeholder missing from src/template.html');
  process.exit(1);
}

const bundle = MODULES
  .map(f => fs.readFileSync(path.join(SRC, f), 'utf8'))
  .join('');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, template.replace(PLACEHOLDER, bundle));
console.log('built ' + path.relative(__dirname, OUT) + ' (' + bundle.length + ' bytes of script)');
