#!/usr/bin/env node
'use strict';
/* Touch gesture decision logic (the pure helpers in src/input.js),
   loaded with a stubbed DOM. Run: node test/touch.test.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const el = () => ({
  addEventListener(){},
  classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
  children: [],
  textContent: ''
});
const root = el();
root.children = [el(), el(), el()];

const ctx = vm.createContext({
  console,
  window: { addEventListener(){}, matchMedia: () => ({ matches:false }), innerWidth: 360 },
  document: {
    getElementById: () => root,
    querySelectorAll: () => [],
    addEventListener(){},
    body: el()
  }
});
for (const f of ['config.js', 'input.js']){
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ctx, { filename:f });
}

const t = (expr, want, msg) => assert.strictEqual(vm.runInContext(expr, ctx), want, msg || expr);

// lane zones: exact screen thirds, clamped at the edges
t('touchLane(0, 360)', 0);
t('touchLane(119, 360)', 0);
t('touchLane(120, 360)', 1);
t('touchLane(239, 360)', 1);
t('touchLane(240, 360)', 2);
t('touchLane(359, 360)', 2);
t('touchLane(360, 360)', 2, 'right edge clamps');
t('touchLane(-5, 360)', 0, 'left edge clamps');

// swipes: far enough, flatter than ~1:1.3, sign is the rotate direction
t('swipeDir(50, 0, 360)', 1);
t('swipeDir(-50, 10, 360)', -1);
t('swipeDir(-30, 0, 360)', 0, 'under the distance threshold');
t('swipeDir(50, 45, 360)', 0, 'too diagonal');
t('swipeDir(0, 80, 360)', 0, 'vertical drag is not a swipe');
t('swipeDir(120, 60, 1290)', 1, 'threshold scales with screen width');
t('swipeDir(80, 0, 1290)', 0, 'wide screen needs a longer swipe');

// the keyboard label set stays the default contract
t('CONFIG.inputLabels === CONFIG.inputLabelSets.key', true);
t('CONFIG.inputLabelSets.touch.laneGroup.length > 0', true);

console.log('touch.test: OK');
