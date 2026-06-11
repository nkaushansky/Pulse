function showJudge(text, color){
  ui.judge.textContent = text;
  ui.judge.style.color = color;
  ui.judge.style.textShadow = '0 0 14px ' + color;
  ui.judge.className = '';
  void ui.judge.offsetWidth;     // restart the animation
  ui.judge.className = 'show';
}

// fires on EVERY lane keypress: kind = perfect | good | miss | dead
// good carries offSec (signed: negative = early, positive = late)
function pressFeedback(lane, kind, offSec){
  const wr = SONG.tracks[G.activeIdx]._wr;
  if (!wr) return;
  const FB = { perfect:0xffffff, good:LANE_COLORS[lane], miss:0xff3355, dead:0x6b7385 };
  const c = FB[kind];
  const rec = wr.receptors[lane];
  if (rec){
    rec.pop = kind === 'dead' ? 0.45 : 1;
    rec.fill.material.color.setHex(c);
    rec.ring.material.color.setHex(kind === 'miss' || kind === 'dead' ? c : LANE_COLORS[lane]);
  }
  const fl = wr.flashes[lane];
  fl.material.color.setHex(c);
  fl.material.opacity = kind === 'dead' ? 0.25 : 0.55;
  if (kind === 'perfect'){
    showJudge('PERFECT', '#ffffff');
  } else if (kind === 'good'){
    const ms = Math.round(offSec * 1000);
    const hex = '#' + LANE_COLORS[lane].toString(16).padStart(6, '0');
    showJudge(ms < 0 ? (-ms) + ' ms EARLY' : ms + ' ms LATE', hex);
  } else if (kind === 'miss'){
    showJudge('MISS', '#ff3355');
  }
}

