/* ---------------- song package ----------------
   Format (per spec):
     meta: { title, bpm, timeSignature, lengthBars, difficulty }
     tracks: [{ name, color, synth:"instrumentId" | stemUrl:"...",
                pattern:[{step,note,len,inst?}],   // 16th grid, 2-bar loop
                chart:[{bar,beat,lane}] }]
   A track is EITHER synth-pattern-driven OR stem-driven.
   chart here is authored as a 2-bar loop (_chartLoop) and
   expanded to the canonical [{bar,beat,lane}] form at load. */
const SONG = {
  meta: { title:'NEON CIRCUIT', bpm:120, timeSignature:[4,4],
          lengthBars:96, difficulty:'NORMAL' },
  tracks: [
    { name:'DRUMS', color:0xff3b5c, wall:0, synth:'kick909',
      pattern:[
        {step:0, note:36, len:1},{step:4, note:36, len:1},
        {step:8, note:36, len:1},{step:12, note:36, len:1},
        {step:16,note:36, len:1},{step:20,note:36, len:1},
        {step:24,note:36, len:1},{step:28,note:36, len:1},
        {step:4, note:38, len:1, inst:'snareNoise'},
        {step:12,note:38, len:1, inst:'snareNoise'},
        {step:20,note:38, len:1, inst:'snareNoise'},
        {step:28,note:38, len:1, inst:'snareNoise'},
        {step:2, note:42, len:1, inst:'hatClosed'},
        {step:6, note:42, len:1, inst:'hatClosed'},
        {step:10,note:42, len:1, inst:'hatClosed'},
        {step:18,note:42, len:1, inst:'hatClosed'},
        {step:22,note:42, len:1, inst:'hatClosed'},
        {step:26,note:42, len:1, inst:'hatClosed'},
        {step:14,note:46, len:2, inst:'hatOpen'},
        {step:30,note:46, len:2, inst:'hatOpen'}
      ],
      _chartLoop:[
        {step:0,lane:1},{step:4,lane:2},{step:8,lane:1},{step:12,lane:2},
        {step:14,lane:0},{step:16,lane:1},{step:20,lane:2},{step:24,lane:1},
        {step:28,lane:2},{step:30,lane:0}
      ]},
    { name:'BASS', color:0x2f7bff, wall:1, synth:'bass808',
      pattern:[
        {step:0, note:33, len:3},{step:6, note:33, len:2},
        {step:8, note:33, len:3},{step:12,note:33, len:2},
        {step:14,note:36, len:2},
        {step:16,note:29, len:3},{step:22,note:29, len:2},
        {step:24,note:29, len:3},{step:28,note:29, len:2},
        {step:30,note:31, len:2}
      ],
      _chartLoop:[
        {step:0,lane:0},{step:6,lane:1},{step:8,lane:0},{step:12,lane:1},
        {step:14,lane:2},{step:16,lane:0},{step:22,lane:1},{step:24,lane:0},
        {step:28,lane:1},{step:30,lane:2}
      ]},
    { name:'SYNTH LEAD', color:0xb04dff, wall:2, synth:'leadSquare',
      pattern:[
        {step:2, note:64, len:2},{step:4, note:67, len:3},
        {step:8, note:69, len:4},{step:14,note:67, len:2},
        {step:18,note:64, len:2},{step:20,note:62, len:2},
        {step:24,note:60, len:4},{step:30,note:62, len:2}
      ],
      _chartLoop:[
        {step:2,lane:1},{step:4,lane:1},{step:8,lane:2},{step:14,lane:1},
        {step:18,lane:1},{step:20,lane:0},{step:24,lane:0},{step:30,lane:0}
      ]},
    { name:'SYNTH PAD', color:0x21d4a7, wall:3, synth:'padTriangle',
      pattern:[
        {step:0, note:45, len:16},{step:0, note:48, len:16},{step:0, note:52, len:16},
        {step:16,note:41, len:16},{step:16,note:45, len:16},{step:16,note:48, len:16},
        {step:24,note:52, len:4}
      ],
      _chartLoop:[ {step:0,lane:1},{step:16,lane:2},{step:24,lane:0} ]},
    { name:'ARP / FX', color:0xffb22e, wall:4, synth:'arpPluck',
      pattern:[
        {step:0, note:69,len:1},{step:2, note:72,len:1},{step:4, note:76,len:1},{step:6, note:81,len:1},
        {step:8, note:69,len:1},{step:10,note:72,len:1},{step:12,note:76,len:1},{step:14,note:81,len:1},
        {step:16,note:69,len:1},{step:18,note:72,len:1},{step:20,note:76,len:1},{step:22,note:81,len:1},
        {step:24,note:69,len:1},{step:26,note:72,len:1},{step:28,note:76,len:1},{step:30,note:81,len:1}
      ],
      _chartLoop:[
        {step:0,lane:0},{step:2,lane:1},{step:4,lane:2},
        {step:8,lane:0},{step:10,lane:1},{step:12,lane:2},
        {step:16,lane:0},{step:18,lane:1},{step:20,lane:2},
        {step:24,lane:0},{step:26,lane:1},{step:28,lane:2}
      ]}
  ]
};
const TOTAL_PHRASES = SONG.meta.lengthBars / PHRASE_BARS;
const TOTAL_STEPS = SONG.meta.lengthBars * STEPS_PER_BAR;
const WALL_COUNT = 8;

function midiFreq(n){ return 440 * Math.pow(2, (n - 69) / 12); }

/* Expand authoring loops into the canonical song format +
   runtime gem objects. Game code consumes tracks generically:
   a track with stemUrl skips pattern scheduling (v1 stub). */
function prepareSong(){
  for (const tr of SONG.tracks){
    tr._stepMap = {};
    if (tr.pattern){
      for (const ev of tr.pattern){
        (tr._stepMap[ev.step] = tr._stepMap[ev.step] || []).push(ev);
      }
    }
    tr.chart = [];
    for (let p = 0; p < TOTAL_PHRASES; p++){
      for (const c of tr._chartLoop){
        tr.chart.push({ bar: p * 2 + (c.step >> 4), beat: (c.step & 15) / 4, lane: c.lane });
      }
    }
    // runtime gems
    tr._gems = [];
    tr._byPhrase = [];
    for (let p = 0; p < TOTAL_PHRASES; p++) tr._byPhrase.push([]);
    for (const c of tr.chart){
      const step = c.bar * STEPS_PER_BAR + Math.round(c.beat * 4);
      const loopStep = step % STEPS_PER_PHRASE;
      const evs = tr._stepMap[loopStep];
      const ev = evs ? evs[Math.min(c.lane, evs.length - 1)] : null;
      const gem = {
        time: step * S16, step, lane: c.lane,
        phrase: Math.floor(c.bar / PHRASE_BARS),
        note: ev ? ev.note : 69,
        inst: ev ? (ev.inst || tr.synth) : tr.synth,
        lenSec: (ev ? (ev.len || 1) : 1) * S16,
        hit:false, missed:false, mesh:null
      };
      tr._gems.push(gem);
      tr._byPhrase[gem.phrase].push(gem);
    }
    tr._gems.sort((a,b)=>a.time-b.time);
    // gems sharing a step play only their own event on hit, not the full
    // pattern slice (slice playback would double-fire on simultaneous hits)
    const perStep = {};
    for (const g of tr._gems) perStep[g.step] = (perStep[g.step] || 0) + 1;
    for (const g of tr._gems) g._solo = perStep[g.step] > 1;
    tr.capturedUntilPhrase = null;
  }
}

