/* ---------------- song packages ----------------
   Format (the content contract — see CLAUDE.md):
     meta: { title, bpm, timeSignature, lengthBars,
             difficulty: 'easy'|'normal'|'hard',
             overrides?: { speed } }          // world units/sec, else CONFIG.speed
     tracks: [{ name, color, wall, synth:"instrumentId" | stemUrl:"...",
                pattern:[{step,note,len,inst?}],   // 16th grid, 2-bar loop
                chart:[{bar,beat,lane}] }]
   A track is EITHER synth-pattern-driven OR stem-driven.
   chart is authored as a 2-bar loop (_chartLoop) and expanded to the
   canonical [{bar,beat,lane}] form by prepareSong(). Adding a song is
   data only: push a package into SONGS, zero new code paths. */
const SONGS = [
{
  meta: { title:'NEON CIRCUIT', bpm:120, timeSignature:[4,4],
          lengthBars:96, difficulty:'hard' },
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
},
{
  meta: { title:'LUNAR DRIFT', bpm:100, timeSignature:[4,4],
          lengthBars:64, difficulty:'easy',
          overrides:{ speed:15 } },
  tracks: [
    { name:'DRUMS', color:0xff6e8a, wall:0, synth:'kickSoft',
      pattern:[
        {step:0, note:36, len:1},{step:8, note:36, len:1},
        {step:16,note:36, len:1},{step:24,note:36, len:1},
        {step:4, note:42, len:1, inst:'hatSoft'},
        {step:12,note:42, len:1, inst:'hatSoft'},
        {step:20,note:42, len:1, inst:'hatSoft'},
        {step:28,note:42, len:1, inst:'hatSoft'}
      ],
      _chartLoop:[
        {step:0,lane:1},{step:8,lane:0},{step:12,lane:2},
        {step:16,lane:1},{step:24,lane:0},{step:28,lane:2}
      ]},
    { name:'BASS', color:0x4f8cff, wall:1, synth:'bass808',
      pattern:[
        {step:0, note:33, len:7},{step:8, note:29, len:7},
        {step:16,note:36, len:7},{step:24,note:31, len:7}
      ],
      _chartLoop:[
        {step:0,lane:0},{step:8,lane:1},{step:16,lane:2},{step:24,lane:1}
      ]},
    { name:'KEYS', color:0x9a6bff, wall:2, synth:'pluckSoft',
      pattern:[
        {step:2, note:64, len:2},{step:6, note:67, len:2},
        {step:12,note:64, len:3},{step:18,note:62, len:2},
        {step:22,note:60, len:2},{step:26,note:57, len:4}
      ],
      _chartLoop:[
        {step:2,lane:1},{step:6,lane:2},{step:12,lane:1},
        {step:18,lane:0},{step:22,lane:1},{step:26,lane:0}
      ]},
    { name:'PAD', color:0x2fd4b2, wall:3, synth:'padWarm',
      pattern:[
        {step:0, note:45, len:16},{step:0, note:52, len:16},{step:0, note:57, len:16},
        {step:16,note:41, len:16},{step:16,note:48, len:16},{step:16,note:53, len:16}
      ],
      _chartLoop:[ {step:0,lane:1},{step:16,lane:1} ]}
  ]
}
];

let SONG = null;          // selected package; set via selectSong()
const WALL_COUNT = 8;

function midiFreq(n){ return 440 * Math.pow(2, (n - 69) / 12); }

/* Expand authoring loops into the canonical song format + runtime gem
   objects. Uses song-local tempo so packages can be prepared once,
   independent of which song is currently selected. */
function prepareSong(song){
  const s16 = (60 / song.meta.bpm) / 4;
  const totalPhrases = song.meta.lengthBars / PHRASE_BARS;
  for (const tr of song.tracks){
    tr._stepMap = {};
    if (tr.pattern){
      for (const ev of tr.pattern){
        (tr._stepMap[ev.step] = tr._stepMap[ev.step] || []).push(ev);
      }
    }
    tr.chart = [];
    for (let p = 0; p < totalPhrases; p++){
      for (const c of tr._chartLoop){
        tr.chart.push({ bar: p * 2 + (c.step >> 4), beat: (c.step & 15) / 4, lane: c.lane });
      }
    }
    // runtime gems
    tr._gems = [];
    tr._byPhrase = [];
    for (let p = 0; p < totalPhrases; p++) tr._byPhrase.push([]);
    for (const c of tr.chart){
      const step = c.bar * STEPS_PER_BAR + Math.round(c.beat * 4);
      const loopStep = step % STEPS_PER_PHRASE;
      const evs = tr._stepMap[loopStep];
      const ev = evs ? evs[Math.min(c.lane, evs.length - 1)] : null;
      const gem = {
        time: step * s16, step, lane: c.lane,
        phrase: Math.floor(c.bar / PHRASE_BARS),
        note: ev ? ev.note : 69,
        inst: ev ? (ev.inst || tr.synth) : tr.synth,
        lenSec: (ev ? (ev.len || 1) : 1) * s16,
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
  song._prepared = true;
}

/* Tempo-derived globals follow the selected song (V2 §2). */
function applySongTiming(song){
  BPM = song.meta.bpm;
  SPB = 60 / BPM;
  SPBAR = SPB * 4;
  S16 = SPB / 4;
  PHRASE_SEC = SPBAR * PHRASE_BARS;
  TOTAL_PHRASES = song.meta.lengthBars / PHRASE_BARS;
  TOTAL_STEPS = song.meta.lengthBars * STEPS_PER_BAR;
  SPEED = (song.meta.overrides && song.meta.overrides.speed) || CONFIG.speed;
}

/* Make a song current: timing globals, per-track audio buses (if the
   AudioContext exists yet), and the tunnel rebuilt for its walls. */
function selectSong(song){
  if (!song._prepared) prepareSong(song);
  SONG = song;
  applySongTiming(song);
  if (audio.ctx) initSongAudio(song);
  rebuildWalls(song);
  updateRingIdle();
}
