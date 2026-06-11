/* ---------------- main loop (visuals only) ---------------- */
function frame(){
  requestAnimationFrame(frame);
  if (!renderer) return;

  if (!G){ // idle title spin
    tunnelGroup.rotation.z += 0.0012;
    renderer.render(scene, camera);
    return;
  }

  const t = nowSong();
  const pulse = Math.max(0, 1 - ((t % SPB) + SPB) % SPB / SPB * 3);

  if (G.state === 'countin'){
    if (t >= 0){
      G.state = 'playing';
      ui.count.className = '';
      ui.count.style.opacity = '0';
      showMsg('GO', 'neutral');
    } else {
      const c = Math.ceil(-t / SPB);
      if (c !== G.lastCount && c <= CONFIG.countInBeats){
        G.lastCount = c;
        ui.count.textContent = c;
        ui.count.className = '';
        void ui.count.offsetWidth;
        ui.count.className = 'tick';
      }
    }
  }

  if (G.state === 'playing'){
    const p = Math.max(0, Math.floor(t / PHRASE_SEC));
    if (p !== G.lastPhrase) onPhraseBoundary(p);
    missCheck(t, p);
    if (G.energy <= 0) finish('fail');
    else if (t > SONG.meta.lengthBars * SPBAR + 0.4) finish('clear');
  }

  if (G.state === 'playing' || G.state === 'countin'){
    for (const tr of SONG.tracks) updateTrackGems(tr, t);
    updateWallVisuals(t, pulse);
    camera.position.y = 0.1 * pulse;
    // HUD
    setHud();
    const bar = Math.min(SONG.meta.lengthBars, Math.max(0, Math.floor(t / SPBAR)) + 1);
    ui.barcount.textContent = 'BAR ' + bar + ' / ' + SONG.meta.lengthBars;
    ui.progress.style.width = Math.min(100, Math.max(0, t / (SONG.meta.lengthBars * SPBAR) * 100)) + '%';
  }

  // rotation tween (audio clock pauses with ctx.suspend → tween uses perf clock,
  // purely cosmetic and ~150ms, acceptable)
  if (rotAnim.active){
    const k = Math.min(1, (performance.now() - rotAnim.t0) / (CONFIG.rotateTween * 1000));
    const ease = 1 - Math.pow(1 - k, 3);
    tunnelGroup.rotation.z = rotAnim.from + (rotAnim.to - rotAnim.from) * ease;
    if (k >= 1) rotAnim.active = false;
  }
  ui.ring.style.transform = 'rotate(' + (-tunnelGroup.rotation.z * 180 / Math.PI) + 'deg)';

  renderer.render(scene, camera);
}

/* ---------------- boot ---------------- */
prepareSong();
initScene();
buildRingHud();
buildTitle();
updateRingIdle();
function updateRingIdle(){
  for (let w = 0; w < WALL_COUNT; w++){
    const wr = wallRender[w];
    const seg = ringSegs[w];
    if (!wr || !wr.track){ seg.setAttribute('stroke', '#181d29'); continue; }
    seg.setAttribute('stroke', '#' + wr.track.color.toString(16).padStart(6, '0'));
    seg.setAttribute('opacity', '0.4');
  }
}
frame();
