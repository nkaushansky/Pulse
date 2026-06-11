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

let appState = 'title'; // title | running | over
window.addEventListener('keydown', (e) => {
  if (['ArrowLeft','ArrowDown','ArrowRight','ArrowUp','Space'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (appState === 'title'){ startGame(); return; }
  if (appState === 'over' || (G && G.state === 'over')){
    if (e.code === 'KeyR'){ newGame(); appState = 'running'; }
    return;
  }
  const action = CONFIG.keymap[e.code];
  if (action) INPUT.emit(action);
});
document.getElementById('title').addEventListener('click', () => {
  if (appState === 'title') startGame();
});
document.getElementById('results').addEventListener('click', () => {
  if (G && G.state === 'over'){ newGame(); appState = 'running'; }
});

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
  if (!audio.ctx) initAudio();
  audio.ctx.resume().then(() => {
    if (!schedTimer) schedTimer = setInterval(schedulerTick, 25);
    newGame();
  });
}

