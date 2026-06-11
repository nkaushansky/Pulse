/* ---------------- audio engine ---------------- */
const audio = { ctx:null, master:null, hitBus:null, pulseBus:null, noiseBuf:null };

function initAudio(){
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 20;
  comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.18;
  comp.connect(ctx.destination);
  const master = ctx.createGain(); master.gain.value = 0.85;
  master.connect(comp);
  const hitBus = ctx.createGain(); hitBus.gain.value = 0.9; hitBus.connect(master);
  // Constant quiet pulse so the grid is audible before any capture.
  const pulseBus = ctx.createGain(); pulseBus.gain.value = 0.06; pulseBus.connect(master);
  const len = Math.floor(ctx.sampleRate * 2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  audio.ctx = ctx; audio.master = master; audio.hitBus = hitBus;
  audio.pulseBus = pulseBus; audio.noiseBuf = buf;
  for (const tr of SONG.tracks){
    tr._gain = ctx.createGain();
    tr._gain.gain.value = 0;       // muted until captured
    tr._gain.connect(master);
  }
}

/* ONE generic synth voice — interprets any INSTRUMENTS descriptor. */
function playVoice(instId, when, midi, dur, dest){
  const d = INSTRUMENTS[instId];
  if (!d || !audio.ctx) return;
  const ctx = audio.ctx;
  const amp = ctx.createGain();
  amp.gain.value = 0;
  let chainIn = amp;
  if (d.filter){
    const f = ctx.createBiquadFilter();
    f.type = d.filter.type;
    f.Q.value = d.filter.q || 0.7;
    if (d.filter.envMult){
      f.frequency.setValueAtTime(d.filter.freq * d.filter.envMult, when);
      f.frequency.exponentialRampToValueAtTime(d.filter.freq, when + (d.filter.envTime || 0.15));
    } else {
      f.frequency.setValueAtTime(d.filter.freq, when);
    }
    f.connect(amp);
    chainIn = f;
  }
  amp.connect(dest);
  const sources = [];
  if (d.type === 'noise'){
    const src = ctx.createBufferSource();
    src.buffer = audio.noiseBuf; src.loop = true;
    src.connect(chainIn); sources.push(src);
  } else {
    const voices = d.voices || 1;
    for (let v = 0; v < voices; v++){
      const o = ctx.createOscillator();
      o.type = d.wave || 'sine';
      if (d.pitchEnv){
        o.frequency.setValueAtTime(d.pitchEnv.start, when);
        o.frequency.exponentialRampToValueAtTime(d.pitchEnv.end, when + d.pitchEnv.time);
      } else {
        o.frequency.setValueAtTime(midiFreq(midi), when);
      }
      if (d.detune && voices > 1) o.detune.value = (v - (voices - 1) / 2) * d.detune;
      o.connect(chainIn); sources.push(o);
    }
  }
  const peak = d.gain || 0.8;
  const atk = d.attack || 0.002, dec = d.decay || 0.1;
  const sus = Math.max((d.sustain || 0) * peak, 0.0001);
  const g = amp.gain;
  g.setValueAtTime(0.0001, when);
  g.linearRampToValueAtTime(peak, when + atk);
  g.exponentialRampToValueAtTime(sus, when + atk + dec);
  let tail = when + atk + dec;
  if ((d.sustain || 0) > 0){
    const rs = Math.max(when + dur, when + atk + dec);
    g.setValueAtTime(sus, rs);
    g.exponentialRampToValueAtTime(0.0001, rs + (d.release || 0.08));
    tail = rs + (d.release || 0.08);
  }
  const stopAt = tail + 0.1;
  for (const s of sources){ s.start(when); s.stop(stopAt); }
}

/* Stem-driven track stub (format + code path exist; v1 has no decoder UI).
   With a decoded buffer this schedules an 8-bar window of the stem:   */
function playStemWindow(track, startTime, offsetSec, durSec){
  if (!track._stemBuffer){
    console.warn('PULSE v1: stemUrl track "' + track.name + '" has no decoded buffer; skipping.');
    return;
  }
  const src = audio.ctx.createBufferSource();
  src.buffer = track._stemBuffer;
  src.connect(track._gain);
  src.start(startTime, offsetSec, durSec);
}

/* Lookahead scheduler — 25ms interval, ~120ms lookahead. */
let schedTimer = null, nextStep = 0;
function stepTime(s){ return G.songStart + s * S16; }
function schedulerTick(){
  if (!G || (G.state !== 'playing' && G.state !== 'countin')) return;
  const ahead = audio.ctx.currentTime + 0.12;
  while (nextStep < TOTAL_STEPS && stepTime(nextStep) < ahead){
    scheduleStep(nextStep);
    nextStep++;
  }
}
function scheduleStep(s){
  const t = stepTime(s);
  if (s % 4 === 0) playVoice('pulseTick', t, 93, 0.05, audio.pulseBus);
  for (const tr of SONG.tracks){
    if (tr.stemUrl) continue;           // stem tracks scheduled via playStemWindow
    const evs = tr._stepMap[s % STEPS_PER_PHRASE];
    if (evs){
      for (const ev of evs){
        playVoice(ev.inst || tr.synth, t, ev.note, (ev.len || 1) * S16, tr._gain);
      }
    }
  }
}

