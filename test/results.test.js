#!/usr/bin/env node
'use strict';
/* Results-screen pure logic: run-duration M:SS formatting (formatTime in
   src/game.js). Loaded with stubs; game.js only declares functions +
   `let G` at top level, so it evaluates without a DOM.
   Run: node test/results.test.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ctx = vm.createContext({ console, window: {} });
for (const f of ['config.js', 'game.js']){
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ctx, { filename:f });
}
const t = (expr, want, msg) => assert.strictEqual(vm.runInContext(expr, ctx), want, msg || expr);

t("formatTime(0)", '0:00');
t("formatTime(5)", '0:05', 'pads seconds');
t("formatTime(59)", '0:59');
t("formatTime(60)", '1:00', 'minute rollover');
t("formatTime(65)", '1:05');
t("formatTime(153.6)", '2:33', 'LUNAR DRIFT clear (floors the fraction)');
t("formatTime(192)", '3:12', 'NEON CIRCUIT clear');
t("formatTime(600)", '10:00', 'two-digit minutes');
t("formatTime(-3)", '0:00', 'never negative');

console.log('results.test: OK');
