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
    else if (e.code === 'Escape') backToTitle();
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
document.getElementById('results').addEventListener('click', () => {
  if (G && G.state === 'over'){ newGame(); appState = 'running'; }
});

function enterSelect(){
  appState = 'select';
  G = null;                        // frame() falls back to the idle tunnel spin
  ui.hud.classList.add('hidden');
  ui.title.classList.add('hidden');
  ui.results.classList.add('hidden');
  buildSelect();
  ui.select.classList.remove('hidden');
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
  initSongAudio(SONG);
  audio.ctx.resume().then(() => {
    if (!schedTimer) schedTimer = setInterval(schedulerTick, 25);
    newGame();
  });
}

