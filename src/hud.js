/* ---------------- HUD ---------------- */
const ui = {
  hud: document.getElementById('hud'),
  title: document.getElementById('title'),
  pause: document.getElementById('pause'),
  results: document.getElementById('results'),
  score: document.getElementById('score'),
  judge: document.getElementById('judge'),
  mult: document.getElementById('mult'),
  energy: document.getElementById('energy'),
  progress: document.getElementById('progress'),
  barcount: document.getElementById('barcount'),
  trackname: document.getElementById('trackname'),
  trackstate: document.getElementById('trackstate'),
  msg: document.getElementById('msg'),
  count: document.getElementById('count'),
  ring: document.getElementById('ring')
};

function showMsg(text, cls){
  ui.msg.textContent = text;
  ui.msg.className = '';
  void ui.msg.offsetWidth;       // restart the animation
  ui.msg.className = 'show ' + cls;
}

function setHud(){
  ui.score.textContent = G.score.toLocaleString();
  ui.mult.textContent = '\u00d7' + G.mult;
  ui.mult.classList.toggle('maxed', G.mult >= 4);
  ui.energy.style.width = G.energy + '%';
  ui.energy.classList.toggle('low', G.energy < 25);
}

function updateTrackLabel(){
  const tr = SONG.tracks[G.activeIdx];
  const p = Math.max(0, Math.floor(nowSong() / PHRASE_SEC));
  ui.trackname.style.color = '#' + tr.color.toString(16).padStart(6, '0');
  let state = 'OPEN';
  if (isCaptured(tr, p)){
    state = 'LOCKED \u00b7 ' + ((tr.capturedUntilPhrase - p + 1) * PHRASE_BARS) + ' BARS';
  } else if (!(tr._byPhrase[p] || []).length){
    state = 'NO GEMS THIS PHRASE';
  } else if (G.attempt.broken && G.attempt.p === p){
    state = 'BROKEN \u00b7 NEXT PHRASE';
  }
  ui.trackname.innerHTML = '';
  ui.trackname.appendChild(document.createTextNode(tr.name));
  const span = document.createElement('span');
  span.id = 'trackstate';
  span.textContent = state;
  ui.trackname.appendChild(span);
}

/* status ring: 8 octagon edges, rotates in sync with the tunnel */
const ringSegs = [];
function buildRingHud(){
  const NS = 'http://www.w3.org/2000/svg';
  const r = 24, cx = 32, cy = 32;
  for (let w = 0; w < WALL_COUNT; w++){
    const a0 = -Math.PI / 2 + wallAngle(w) - Math.PI / 8;
    const a1 = -Math.PI / 2 + wallAngle(w) + Math.PI / 8;
    const seg = document.createElementNS(NS, 'line');
    seg.setAttribute('x1', cx + r * Math.cos(a0));
    seg.setAttribute('y1', cy - r * Math.sin(a0));
    seg.setAttribute('x2', cx + r * Math.cos(a1));
    seg.setAttribute('y2', cy - r * Math.sin(a1));
    seg.setAttribute('stroke-width', '4');
    seg.setAttribute('stroke-linecap', 'round');
    ui.ring.appendChild(seg);
    ringSegs.push(seg);
  }
}
function updateRing(){
  const p = G ? Math.max(0, Math.floor(nowSong() / PHRASE_SEC)) : 0;
  for (let w = 0; w < WALL_COUNT; w++){
    const wr = wallRender[w];
    const seg = ringSegs[w];
    if (!wr || !wr.track){
      seg.setAttribute('stroke', '#181d29');
      seg.setAttribute('opacity', '1');
      continue;
    }
    const tr = wr.track;
    const col = '#' + tr.color.toString(16).padStart(6, '0');
    seg.setAttribute('stroke', col);
    if (isCaptured(tr, p)) seg.setAttribute('opacity', '1');
    else if (!(tr._byPhrase[p] || []).length) seg.setAttribute('opacity', '0.15');
    else seg.setAttribute('opacity', '0.4');
    seg.setAttribute('stroke-width', SONG.tracks[G ? G.activeIdx : 0] === tr ? '6' : '4');
  }
}

function buildTitle(){
  const m = SONG.meta;
  document.getElementById('titlemeta').textContent =
    m.title + ' \u00b7 ' + m.bpm + ' BPM \u00b7 ' + m.lengthBars + ' BARS \u00b7 ' + m.difficulty;
  const L = CONFIG.inputLabels;
  const rows = [
    ['<kbd>' + L.lane0 + '</kbd><kbd>' + L.lane1 + '</kbd><kbd>' + L.lane2 + '</kbd> or <kbd>' + L.lanesAlt + '</kbd>', 'HIT LANES'],
    ['<kbd>' + L.rotateLeft + '</kbd> <kbd>' + L.rotateRight + '</kbd>', 'ROTATE TUNNEL'],
    ['<kbd>' + L.pause + '</kbd>', 'PAUSE']
  ];
  document.getElementById('howto').innerHTML =
    rows.map(r => '<div class="keys">' + r[0] + '</div><div>' + r[1] + '</div>').join('');
  document.getElementById('keyhints').innerHTML =
    '<span><b>' + L.lane0 + ' ' + L.lane1 + ' ' + L.lane2 + '</b> LANES</span>' +
    '<span><b>' + L.rotateLeft + ' \u00b7 ' + L.rotateRight + '</b> ROTATE</span>';
}

