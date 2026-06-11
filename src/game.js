/* ---------------- game state & rules ---------------- */
let G = null;

function nowSong(){ return audio.ctx.currentTime - G.songStart; }
function phraseStartTime(p){ return G.songStart + p * PHRASE_SEC; }

function newGame(){
  nextStep = 0;
  for (const tr of SONG.tracks){
    tr.capturedUntilPhrase = null;
    if (tr._gain){
      tr._gain.gain.cancelScheduledValues(audio.ctx.currentTime);
      tr._gain.gain.setValueAtTime(0, audio.ctx.currentTime);
    }
    if (tr._skipped) tr._skipped.length = 0;
    for (const gem of tr._gems){
      gem.hit = false; gem.missed = false;
      if (gem.mesh) releaseGemMesh(tr, gem);
    }
    tr._live.clear();
    tr._spawnPtr = 0;
  }
  G = {
    state:'countin',
    songStart: audio.ctx.currentTime + 0.3 + CONFIG.countInBeats * SPB,
    score:0, mult:1, bestMult:1, energy:60,
    hits:0, misses:0, captures:0, capturedTracks:new Set(),
    activeIdx:0, lastPhrase:-1, lastCount:-1, fullBonusArmed:true,
    attempt:{ p:-1, active:false, broken:true, total:0, hits:0 }
  };
  // count-in ticks
  for (let i = 0; i < CONFIG.countInBeats; i++){
    playVoice('tickHi', G.songStart - (CONFIG.countInBeats - i) * SPB, 81, 0.08, audio.master);
  }
  tunnelGroup.rotation.z = -wallAngle(SONG.tracks[0].wall);
  rotAnim.active = false;
  refreshGemMaterials();
  ui.hud.classList.remove('hidden');
  ui.title.classList.add('hidden');
  ui.results.classList.add('hidden');
  updateRing();
  updateTrackLabel();
  setHud();
}

function setupAttempt(p, fresh){
  const tr = SONG.tracks[G.activeIdx];
  const gems = tr._byPhrase[p] || [];
  const captured = isCaptured(tr, p);
  let valid = !captured && gems.length > 0;
  if (valid && !fresh){
    // rotated in mid-phrase: only valid if nothing already slipped past
    const t = nowSong();
    valid = gems.every(g => g.hit || g.time >= t - HIT_WINDOW);
  }
  const hits = gems.reduce((n, g) => n + (g.hit ? 1 : 0), 0);
  G.attempt = { p, active:valid, broken:!valid, total:gems.length, hits };
  if (valid && hits === gems.length) captureTrack(tr, p); // all early-hit edge
}

function onPhraseBoundary(p){
  G.lastPhrase = p;
  for (const tr of SONG.tracks){
    if (tr.capturedUntilPhrase !== null && p > tr.capturedUntilPhrase){
      tr.capturedUntilPhrase = null;   // window over: track reopens
    }
  }
  setupAttempt(p, true);
  updateRing();
  updateTrackLabel();
}

function breakPhrase(){
  const a = G.attempt;
  if (!a.active || a.broken) return;
  a.broken = true;
  G.mult = 1;
  G.energy = Math.max(0, G.energy - 15);
  showMsg('PHRASE BROKEN', 'bad');
  playVoice('breakBuzz', audio.ctx.currentTime + 0.005, 38, 0.2, audio.hitBus);
  // grey out what's left of this phrase
  const tr = SONG.tracks[G.activeIdx];
  for (const gem of tr._byPhrase[a.p]){
    if (!gem.hit && !gem.missed && gem.mesh) gem.mesh.material = gemMats.miss;
  }
}

function captureTrack(tr, p){
  tr.capturedUntilPhrase = Math.min(p + CAPTURE_PHRASES, TOTAL_PHRASES - 1);
  G.captures++;
  G.capturedTracks.add(tr.name);
  G.mult = Math.min(4, G.mult + 1);
  G.bestMult = Math.max(G.bestMult, G.mult);
  G.score += 1000 * G.mult;
  G.energy = Math.min(100, G.energy + 12);
  G.attempt.active = false;
  showMsg(tr.name + ' CAPTURED', 'good');
  // unmute now, schedule the remute at the window's end. The bus is silent
  // at this instant (uncaptured events are never scheduled into it), so an
  // instant unmute can't click — and a ramp would shave the attack of
  // events flushed at the seam.
  const g = tr._gain.gain, n = audio.ctx.currentTime;
  g.cancelScheduledValues(n);
  g.setValueAtTime(1, n);
  flushSkippedEvents(tr);
  const endT = phraseStartTime(tr.capturedUntilPhrase + 1);
  if (endT > n + 0.1){
    g.setValueAtTime(1, endT - 0.06);
    g.linearRampToValueAtTime(0, endT);
  }
  // hide gems inside the captured window
  for (const gem of tr._live){
    if (gem.phrase <= tr.capturedUntilPhrase) releaseGemMesh(tr, gem);
  }
  // full-spectrum bonus: all five locked at once
  if (G.fullBonusArmed && SONG.tracks.every(t => isCaptured(t, p))){
    G.fullBonusArmed = false;
    G.score += 5000;
    setTimeout(() => showMsg('FULL SPECTRUM +5000', 'neutral'), 900);
  }
  if (!SONG.tracks.every(t => isCaptured(t, p))) G.fullBonusArmed = true;
  updateRing();
  updateTrackLabel();
}

function onLaneInput(lane){
  if (!G || G.state !== 'playing') return;
  const tr = SONG.tracks[G.activeIdx];
  const t = nowSong();
  const p = Math.max(0, Math.floor(t / PHRASE_SEC));
  // candidates in this phrase and the next (early hits across the boundary)
  let best = null, bestDt = Infinity;
  for (const ph of [p, p + 1]){
    const gems = tr._byPhrase[ph];
    if (!gems || (ph !== p && isCaptured(tr, ph))) continue;
    for (const gem of gems){
      if (gem.lane !== lane || gem.hit || gem.missed) continue;
      const dt = Math.abs(gem.time - t);
      if (dt <= HIT_WINDOW && dt < bestDt){ best = gem; bestDt = dt; }
    }
  }
  const a = G.attempt;
  if (best){
    if (best.phrase === p && (!a.active || a.broken)){
      pressFeedback(lane, 'dead');   // dead phrase: press registers, no effect
      return;
    }
    best.hit = true;
    const off = t - best.time;       // signed: negative = early, positive = late
    const perfect = bestDt <= PERFECT_WINDOW;
    G.score += (perfect ? 200 : 100) * G.mult;
    G.hits++;
    G.energy = Math.min(100, G.energy + 0.5);
    playHitNote(tr, best);
    pressFeedback(lane, perfect ? 'perfect' : 'good', off);
    releaseGemMesh(tr, best);
    if (best.phrase === p){
      a.hits++;
      if (a.hits >= a.total) captureTrack(tr, p);
    }
  } else if (a.active && !a.broken){
    pressFeedback(lane, 'miss');
    breakPhrase(); // empty press — Frequency-strict
  } else {
    pressFeedback(lane, 'dead');     // empty press in an already-dead phrase
  }
}

function missCheck(t, p){
  const tr = SONG.tracks[G.activeIdx];
  const gems = tr._byPhrase[p];
  if (!gems) return;
  for (const gem of gems){
    if (gem.hit || gem.missed || isCaptured(tr, p)) continue;
    if (gem.time < t - HIT_WINDOW){
      gem.missed = true;
      G.misses++;
      if (gem.mesh) gem.mesh.material = gemMats.miss;
      breakPhrase();
    }
  }
}

function rotate(dir){
  if (!G || (G.state !== 'playing' && G.state !== 'countin')) return;
  const n = SONG.tracks.length;
  G.activeIdx = (G.activeIdx + dir + n) % n;
  rotateTunnelTo(SONG.tracks[G.activeIdx].wall);
  refreshGemMaterials();
  if (G.state === 'playing'){
    setupAttempt(Math.max(0, Math.floor(nowSong() / PHRASE_SEC)), false);
  }
  updateRing();
  updateTrackLabel();
}

function finish(kind){
  G.state = 'over';
  for (const tr of SONG.tracks){
    const g = tr._gain.gain, n = audio.ctx.currentTime;
    g.cancelScheduledValues(n);
    g.setValueAtTime(g.value, n);
    g.linearRampToValueAtTime(0, n + 0.4);
  }
  const judged = G.hits + G.misses;
  const acc = judged ? Math.round(100 * G.hits / judged) : 0;
  let grade = 'D';
  if (kind === 'fail') grade = 'F';
  else if (G.captures >= 30 && acc >= 95) grade = 'S';
  else if (G.captures >= 22 && acc >= 88) grade = 'A';
  else if (G.captures >= 14 && acc >= 75) grade = 'B';
  else if (G.captures >= 7) grade = 'C';
  ui.results.classList.toggle('fail', kind === 'fail');
  document.getElementById('grade').textContent = grade;
  document.getElementById('verdict').textContent = kind === 'fail' ? 'SIGNAL LOST' : 'SIGNAL CLEAR';
  document.getElementById('r-score').textContent = G.score.toLocaleString();
  document.getElementById('r-hits').textContent = G.hits + ' / ' + judged;
  document.getElementById('r-acc').textContent = acc + '%';
  document.getElementById('r-caps').textContent = G.captures;
  document.getElementById('r-tracks').textContent = G.capturedTracks.size + ' / ' + SONG.tracks.length;
  document.getElementById('r-mult').textContent = '\u00d7' + G.bestMult;
  ui.results.classList.remove('hidden');
}

