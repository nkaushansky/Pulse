#!/usr/bin/env node
'use strict';
/* SONG package contract check + the V2 §3 chart density review as an
   executable rule: every track must stay two-thumb playable on the
   touch layout. Bounds (see src/song.js header):
     - at most 2 simultaneous lanes per step (current charts use 1)
     - >= 240 ms between hits on the same lane
     - >= 200 ms between any two hits (simultaneous pairs exempt)
   Run: node test/charts.test.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ctx = vm.createContext({ console, window: {} });   // no localStorage: SAVE degrades silently
for (const f of ['config.js', 'save.js', 'song.js']){
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ctx, { filename:f });
}
vm.runInContext('for (const s of SONGS) prepareSong(s)', ctx);
const SONGS = vm.runInContext('SONGS', ctx);

const MIN_ANY_GAP = 0.200, MIN_LANE_GAP = 0.240, MAX_CHORD = 2, EPS = 1e-6;

for (const song of SONGS){
  const m = song.meta;
  assert(['easy','normal','hard'].includes(m.difficulty), m.title + ': difficulty enum');
  assert(m.lengthBars % 2 === 0, m.title + ': whole phrases');
  for (const tr of song.tracks){
    const id = m.title + ' / ' + tr.name;
    assert(!!tr.synth !== !!tr.stemUrl, id + ': exactly one of synth|stemUrl');
    for (const c of tr._chartLoop){
      assert(Number.isInteger(c.step) && c.step >= 0 && c.step <= 31, id + ': step 0-31');
      assert([0, 1, 2].includes(c.lane), id + ': lane 0-2');
    }
    if (tr.pattern) for (const ev of tr.pattern){
      assert(Number.isInteger(ev.step) && ev.step >= 0 && ev.step <= 31, id + ': pattern step');
      assert(typeof ev.note === 'number', id + ': MIDI note');
      assert(ev.len > 0, id + ': len in 16ths');
    }

    // density over the expanded gems (times are song-local seconds)
    const gems = tr._gems.slice().sort((a, b) => a.time - b.time);
    const byStep = {};
    for (const g of gems) byStep[g.step] = (byStep[g.step] || 0) + 1;
    const chord = Math.max(...Object.values(byStep));
    assert(chord <= MAX_CHORD, id + ': needs ' + chord + ' simultaneous lanes (max ' + MAX_CHORD + ')');

    let minAny = Infinity, minLane = Infinity;
    const lastOnLane = {};
    for (let i = 0; i < gems.length; i++){
      const g = gems[i];
      if (i > 0){
        const dt = g.time - gems[i - 1].time;
        if (dt > EPS) minAny = Math.min(minAny, dt);
      }
      if (lastOnLane[g.lane] !== undefined) minLane = Math.min(minLane, g.time - lastOnLane[g.lane]);
      lastOnLane[g.lane] = g.time;
    }
    assert(minAny >= MIN_ANY_GAP - EPS, id + ': ' + (minAny * 1000).toFixed(0) + ' ms between hits');
    assert(minLane >= MIN_LANE_GAP - EPS, id + ': ' + (minLane * 1000).toFixed(0) + ' ms on one lane');

    const perPhrase = tr._chartLoop.length;
    console.log('  ' + id + ': ' + perPhrase + ' gems/phrase, chords ' + chord +
      ', min gap ' + (minAny * 1000).toFixed(0) + ' ms' +
      ', min lane gap ' + (isFinite(minLane) ? (minLane * 1000).toFixed(0) + ' ms' : 'n/a'));
  }
}
console.log('charts.test: OK');
