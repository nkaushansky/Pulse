/* ---------------- instrument registry ----------------
   Each entry is a descriptor interpreted by ONE generic
   voice function (playVoice). Tracks reference these by id;
   pattern events may override per-event via ev.inst.       */
const INSTRUMENTS = {
  kick909:    { type:'osc', wave:'sine', pitchEnv:{start:160,end:44,time:0.09},
                attack:0.002, decay:0.26, sustain:0, gain:1.05 },
  snareNoise: { type:'noise', filter:{type:'bandpass',freq:1900,q:0.9},
                attack:0.001, decay:0.16, sustain:0, gain:0.8 },
  clap:       { type:'noise', filter:{type:'bandpass',freq:1300,q:1.2},
                attack:0.001, decay:0.12, sustain:0, gain:0.75 },
  hatClosed:  { type:'noise', filter:{type:'highpass',freq:8200,q:0.7},
                attack:0.001, decay:0.045, sustain:0, gain:0.4 },
  hatOpen:    { type:'noise', filter:{type:'highpass',freq:7800,q:0.7},
                attack:0.001, decay:0.28, sustain:0, gain:0.34 },
  bass808:    { type:'osc', wave:'sine', filter:{type:'lowpass',freq:520,q:0.8},
                attack:0.004, decay:0.18, sustain:0.55, release:0.07, gain:0.95 },
  bassSaw:    { type:'osc', wave:'sawtooth',
                filter:{type:'lowpass',freq:420,q:4,envMult:5,envTime:0.12},
                attack:0.003, decay:0.12, sustain:0.4, release:0.06, gain:0.6 },
  leadSquare: { type:'osc', wave:'square', voices:2, detune:10,
                filter:{type:'lowpass',freq:1600,q:2,envMult:2.4,envTime:0.1},
                attack:0.004, decay:0.15, sustain:0.45, release:0.1, gain:0.32 },
  padTriangle:{ type:'osc', wave:'triangle', voices:2, detune:7,
                filter:{type:'lowpass',freq:1100,q:0.5},
                attack:0.3, decay:0.4, sustain:0.7, release:0.5, gain:0.16 },
  arpPluck:   { type:'osc', wave:'sawtooth',
                filter:{type:'lowpass',freq:700,q:3,envMult:6,envTime:0.07},
                attack:0.001, decay:0.12, sustain:0, gain:0.4 },
  fxSweep:    { type:'noise', filter:{type:'bandpass',freq:300,q:2,envMult:14,envTime:0.5},
                attack:0.05, decay:0.6, sustain:0, gain:0.25 },
  breakBuzz:  { type:'osc', wave:'sawtooth', pitchEnv:{start:120,end:55,time:0.18},
                filter:{type:'lowpass',freq:500,q:1},
                attack:0.002, decay:0.22, sustain:0, gain:0.5 },
  tickHi:     { type:'osc', wave:'square', filter:{type:'lowpass',freq:6000,q:0.7},
                attack:0.001, decay:0.07, sustain:0, gain:0.5 },
  pulseTick:  { type:'noise', filter:{type:'highpass',freq:9500,q:0.7},
                attack:0.0005, decay:0.018, sustain:0, gain:0.9 },
  // non-musical tap acknowledgment for 'dead'/'miss' presses (early-tap
  // feedback): a soft mid click on hitBus so every tap is heard even after
  // a phrase breaks — bandpass mid reads as a UI click, distinct from the
  // hats (highpass noise) and the low break buzz, and never the note bus
  tapTick:    { type:'noise', filter:{type:'bandpass',freq:2500,q:0.9},
                attack:0.0005, decay:0.03, sustain:0, gain:0.25 },
  // gentler palette for the easy song (V2 §2)
  kickSoft:   { type:'osc', wave:'sine', pitchEnv:{start:120,end:40,time:0.12},
                attack:0.004, decay:0.30, sustain:0, gain:0.85 },
  hatSoft:    { type:'noise', filter:{type:'highpass',freq:9000,q:0.6},
                attack:0.002, decay:0.06, sustain:0, gain:0.22 },
  pluckSoft:  { type:'osc', wave:'triangle', voices:2, detune:6,
                filter:{type:'lowpass',freq:900,q:1.2,envMult:3,envTime:0.15},
                attack:0.004, decay:0.25, sustain:0.2, release:0.18, gain:0.5 },
  padWarm:    { type:'osc', wave:'sine', voices:2, detune:5,
                filter:{type:'lowpass',freq:800,q:0.4},
                attack:0.5, decay:0.5, sustain:0.75, release:0.8, gain:0.18 }
};

