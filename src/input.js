/* ---------------- input layer ----------------
   Keyboard is the only v1 backend; gameplay code receives
   semantic actions only (touch can be added as a second
   emitter without touching game logic). */
const INPUT = {
  emit(action){
    switch (action){
      case 'lane0': case 'lane1': case 'lane2':
        onLaneInput(+action.slice(4)); break;
      case 'rotateLeft':  rotate(-1); break;
      case 'rotateRight': rotate(1);  break;
      case 'pause': togglePause(); break;
    }
  }
};

let appState = 'title'; // title | select | running | over
window.addEventListener('keydown', (e) => {
  if (['ArrowLeft','ArrowDown','ArrowRight','ArrowUp','Space'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (appState === 'title'){ enterSelect(); return; }
  if (appState === 'select'){
    if (e.code === 'ArrowUp') moveSongSel(-1);
    else if (e.code === 'ArrowDown') moveSongSel(1);
    else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') startGame();
    else if (e.code === 'KeyO') enterSettings();
    else if (e.code === 'Escape') backToTitle();
    return;
  }
  if (appState === 'settings'){
    if (e.code === 'ArrowUp') moveOptSel(-1);
    else if (e.code === 'ArrowDown') moveOptSel(1);
    else if (e.code === 'ArrowLeft') changeOpt(-1);
    else if (e.code === 'ArrowRight') changeOpt(1);
    else if (e.code === 'KeyC') enterCalibrate();
    else if (e.code === 'Escape' || e.code === 'KeyO' || e.code === 'Enter') enterSelect();
    return;
  }
  if (appState === 'calibrate'){
    if (e.code === 'Space') calibTap();             // tap along the tick
    else if (e.code === 'ArrowLeft') calibNudge(-5);
    else if (e.code === 'ArrowRight') calibNudge(5);
    else if (e.code === 'Enter' || e.code === 'NumpadEnter') exitCalibrate(true);
    else if (e.code === 'Escape') exitCalibrate(false);
    return;
  }
  if (appState === 'over' || (G && G.state === 'over')){
    if (e.code === 'KeyR'){ newGame(); appState = 'running'; }
    else if (e.code === 'KeyS') enterSelect();
    return;
  }
  const action = CONFIG.keymap[e.code];
  if (action) INPUT.emit(action);
});
document.getElementById('title').addEventListener('click', () => {
  if (appState === 'title') enterSelect();
});

/* clickable / tappable flow controls — same paths the keyboard takes */
document.getElementById('btn-retry').addEventListener('click', () => {
  if (G && G.state === 'over'){ newGame(); appState = 'running'; }
});
document.getElementById('btn-select').addEventListener('click', () => {
  if (G && G.state === 'over') enterSelect();
});
document.getElementById('btn-options').addEventListener('click', () => {
  if (appState === 'select') enterSettings();
});
document.getElementById('btn-calibrate').addEventListener('click', () => {
  if (appState === 'settings') enterCalibrate();
});
document.getElementById('btn-back').addEventListener('click', () => {
  if (appState === 'select') backToTitle();
});
document.getElementById('btn-done').addEventListener('click', () => {
  if (appState === 'settings') enterSelect();
});
document.getElementById('pause').addEventListener('click', () => INPUT.emit('pause'));

function enterSelect(){
  appState = 'select';
  G = null;                        // frame() falls back to the idle tunnel spin
  ui.hud.classList.add('hidden');
  ui.title.classList.add('hidden');
  ui.results.classList.add('hidden');
  ui.settings.classList.add('hidden');
  buildSelect();
  ui.select.classList.remove('hidden');
  maybeSuggestCalibration();       // §4: one-time prompt on first touch run
}

function enterSettings(){
  appState = 'settings';
  ui.select.classList.add('hidden');
  buildSettings();
  ui.settings.classList.remove('hidden');
}

function backToTitle(){
  appState = 'title';
  ui.select.classList.add('hidden');
  ui.title.classList.remove('hidden');
}

function moveSongSel(dir){
  const n = SONGS.length;
  songSel = (songSel + dir + n) % n;
  selectSong(SONGS[songSel]);      // live backdrop: tunnel rebuilds to the highlighted song
  buildSelect();
}

function togglePause(){
  if (!G || G.state === 'over') return;
  if (audio.ctx.state === 'running'){
    audio.ctx.suspend();          // freezes currentTime → everything pauses in sync
    ui.pause.classList.remove('hidden');
  } else {
    audio.ctx.resume();
    ui.pause.classList.add('hidden');
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden && G && G.state !== 'over' && audio.ctx && audio.ctx.state === 'running'){
    togglePause();
  }
});

function startGame(){
  appState = 'running';
  ui.select.classList.add('hidden');
  if (!audio.ctx) initAudio();     // first user gesture lands here
  warmUpAudio();                   // iOS: wake the audio hardware on the gesture
  initSongAudio(SONG);
  audio.ctx.resume().then(() => {
    if (!schedTimer) schedTimer = setInterval(schedulerTick, 25);
    newGame();
  });
}

/* ---------------- touch backend (V2 §3) ----------------
   A second emitter into INPUT.emit(); game logic is untouched and the
   keyboard keeps working in touch mode. setInputMode only swaps the HUD
   label set and gates the touch-only DOM via body.touch. */
function setInputMode(mode){
  CONFIG.inputLabels = CONFIG.inputLabelSets[mode] || CONFIG.inputLabelSets.key;
  document.body.classList.toggle('touch', mode === 'touch');
}

/* pure gesture decisions (Node-tested in test/touch.test.js): the three
   zones are exact screen thirds, matching lanes 0/1/2 left-to-right; a
   drag is a rotate swipe once it is far enough and flatter than ~1:1.3 */
function touchLane(x, w){ return Math.max(0, Math.min(2, Math.floor(x * 3 / w))); }
function swipeDir(dx, dy, w){
  if (Math.abs(dx) < Math.max(36, w * 0.07)) return 0;
  return Math.abs(dx) > Math.abs(dy) * 1.3 ? (dx < 0 ? -1 : 1) : 0;
}
// one wall per swipe: collapse any extra emits (multi-touch jitter,
// coalesced moves, fast re-flicks) within this window into a single
// rotate. Pure + tested; clock is input ergonomics, not game timing.
const SWIPE_COOLDOWN_MS = 250;
function swipeCooldownOk(now, last, ms){ return now - last >= ms; }

(function initTouchInput(){
  const lanes = document.getElementById('tlanes');
  const swipe = document.getElementById('tswipe');
  const pauseBtn = document.getElementById('tpause');

  // lane zones: every touch point is its own press (multi-touch chords)
  const held = new Map();          // touch id -> zone element
  function pressZone(t){
    const lane = touchLane(t.clientX, window.innerWidth);
    INPUT.emit('lane' + lane);
    const el = lanes.children[lane];
    el.classList.add('press');
    held.set(t.identifier, el);
  }
  function liftZone(t){
    const el = held.get(t.identifier);
    if (!el) return;
    held.delete(t.identifier);
    let stillHeld = false;
    held.forEach(v => { if (v === el) stillHeld = true; });
    if (!stillHeld) el.classList.remove('press');
  }
  lanes.addEventListener('touchstart', e => {
    e.preventDefault();            // no synthetic clicks, no zoom/scroll
    for (let i = 0; i < e.changedTouches.length; i++) pressZone(e.changedTouches[i]);
  }, { passive:false });
  const lift = e => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) liftZone(e.changedTouches[i]);
  };
  lanes.addEventListener('touchend', lift, { passive:false });
  lanes.addEventListener('touchcancel', lift, { passive:false });

  // swipe region (everything above the zones): one rotate per swipe,
  // fired the moment the threshold is crossed, not on finger lift
  const drags = new Map();         // touch id -> {x, y, done}
  let lastSwipeAt = -Infinity;     // gesture clock (ergonomics, not game timing)
  swipe.addEventListener('touchstart', e => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++){
      const t = e.changedTouches[i];
      drags.set(t.identifier, { x:t.clientX, y:t.clientY, done:false });
    }
  }, { passive:false });
  swipe.addEventListener('touchmove', e => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++){
      const t = e.changedTouches[i];
      const d = drags.get(t.identifier);
      if (!d || d.done) continue;
      const dir = swipeDir(t.clientX - d.x, t.clientY - d.y, window.innerWidth);
      if (!dir) continue;
      d.done = true;               // this finger has spent its one rotate
      const now = performance.now();
      if (!swipeCooldownOk(now, lastSwipeAt, SWIPE_COOLDOWN_MS)) continue;
      lastSwipeAt = now;
      INPUT.emit(dir < 0 ? 'rotateLeft' : 'rotateRight');
    }
  }, { passive:false });
  const endDrag = e => {
    for (let i = 0; i < e.changedTouches.length; i++) drags.delete(e.changedTouches[i].identifier);
  };
  swipe.addEventListener('touchend', endDrag);
  swipe.addEventListener('touchcancel', endDrag);

  pauseBtn.addEventListener('touchstart', e => {
    e.preventDefault();
    INPUT.emit('pause');
  }, { passive:false });
  pauseBtn.addEventListener('click', () => INPUT.emit('pause'));   // mouse only: touchstart ate the tap

  // rotate buttons: exactly one wall per tap, no gesture ambiguity
  function bindRotate(el, action){
    el.addEventListener('touchstart', e => { e.preventDefault(); INPUT.emit(action); }, { passive:false });
    el.addEventListener('click', () => INPUT.emit(action));        // mouse only
  }
  bindRotate(document.getElementById('trotL'), 'rotateLeft');
  bindRotate(document.getElementById('trotR'), 'rotateRight');

  // coarse-pointer detection happens at boot (main.js); the first real
  // touch flips the UI for devices the media query missed
  window.addEventListener('touchstart', () => {
    if (!document.body.classList.contains('touch')){
      setInputMode('touch');
      buildTitle();
    }
  }, { once:true, passive:true });
})();

