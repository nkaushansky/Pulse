/* ---------------- HUD ---------------- */
const ui = {
  hud: document.getElementById('hud'),
  title: document.getElementById('title'),
  pause: document.getElementById('pause'),
  select: document.getElementById('select'),
  settings: document.getElementById('settings'),
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
  document.getElementById('titlemeta').textContent =
    SONGS.length + ' SIGNALS DETECTED';
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

/* ---------------- song select (V2 §2) ---------------- */
let songSel = 0;
function buildSelect(){
  const list = document.getElementById('songlist');
  list.innerHTML = '';
  SONGS.forEach((song, i) => {
    const m = song.meta;
    const row = document.createElement('div');
    row.className = 'songrow' + (i === songSel ? ' sel' : '');
    const title = document.createElement('div');
    title.className = 'st';
    title.textContent = m.title;
    title.style.color = '#' + song.tracks[0].color.toString(16).padStart(6, '0');
    const meta = document.createElement('div');
    meta.className = 'sm';
    meta.textContent = m.bpm + ' BPM \u00b7 ' + m.difficulty.toUpperCase() +
      ' \u00b7 ' + song.tracks.length + ' TRACKS \u00b7 ' + m.lengthBars + ' BARS';
    const bestLine = document.createElement('div');
    bestLine.className = 'sb';
    const best = SAVE.getBest(m.title);
    bestLine.textContent = best
      ? 'BEST ' + best.score.toLocaleString() + ' \u00b7 ' + best.grade + ' \u00b7 ' + best.acc + '%'
      : 'NO RECORD';
    row.append(title, meta, bestLine);
    row.addEventListener('click', () => {
      songSel = i;
      selectSong(SONGS[i]);
      startGame();
    });
    list.appendChild(row);
  });
}


/* ---------------- options / difficulty settings (V2 §6) ---------------- */
const OPTIONS = [
  { key:'speedMult', name:'TUNNEL SPEED', values:[0.75, 1, 1.25], def:1,
    fmt:v => v + '\u00d7', mod:v => v + '\u00d7 SPEED' },
  { key:'windowMode', name:'HIT WINDOW', values:['strict','normal','relaxed'], def:'normal',
    fmt:v => ({ strict:'STRICT \u00b170', normal:'NORMAL \u00b190', relaxed:'RELAXED \u00b1120' })[v],
    mod:v => v.toUpperCase() },
  { key:'lenient', name:'LENIENT MODE', values:[false, true], def:false,
    fmt:v => v ? 'ON' : 'OFF', mod:() => 'LENIENT' }
];

/* labels for every non-default setting; empty array = pure V1 feel */
function settingsModifiers(){
  const mods = [];
  for (const o of OPTIONS){
    const v = SAVE.getSetting(o.key, o.def);
    if (v !== o.def) mods.push(o.mod(v));
  }
  return mods;
}

let optSel = 0;
function buildSettings(){
  const list = document.getElementById('optlist');
  list.innerHTML = '';
  OPTIONS.forEach((o, i) => {
    const row = document.createElement('div');
    row.className = 'optrow' + (i === optSel ? ' sel' : '');
    const name = document.createElement('div');
    name.className = 'on';
    name.textContent = o.name;
    const vals = document.createElement('div');
    vals.className = 'ov';
    const cur = SAVE.getSetting(o.key, o.def);
    o.values.forEach(v => {
      const s = document.createElement('span');
      s.textContent = o.fmt(v);
      if (v === cur) s.className = 'cur';
      s.addEventListener('click', () => { optSel = i; setOption(o, v); });
      vals.appendChild(s);
    });
    row.append(name, vals);
    list.appendChild(row);
  });
}

function moveOptSel(dir){
  optSel = (optSel + dir + OPTIONS.length) % OPTIONS.length;
  buildSettings();
}

function changeOpt(dir){
  const o = OPTIONS[optSel];
  const cur = SAVE.getSetting(o.key, o.def);
  let i = o.values.findIndex(v => v === cur);
  if (i < 0) i = o.values.indexOf(o.def);
  setOption(o, o.values[(i + dir + o.values.length) % o.values.length]);
}

function setOption(o, v){
  SAVE.setSetting(o.key, v);
  applySettings();
  if (SONG) selectSong(SONG);   // refresh speed + zone-band geometry, no restart needed
  buildSettings();
}
