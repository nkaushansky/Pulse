# PULSE — project rules

Browser rhythm game (Frequency-style tunnel). Source lives in `src/`,
built into a single self-contained file at `dist/pulse.html`.

## Build

```
node build.js        # src/ → dist/pulse.html
```

`build.js` concatenates the `src/*.js` modules **in the order listed in
its MODULES array** into `src/template.html` (HTML + CSS + script shell).
There is no module system — all files share one script scope, top-to-bottom,
exactly like the original single-file build. New top-level code must respect
that order (a module may only reference earlier modules' top-level bindings
at load time; function bodies may reference anything).

`dist/pulse.html` is committed (it is the deployable for nk00.com). Rebuild
and include it whenever `src/` changes. The only permitted external request
is Three.js r128 from cdnjs (r128 quirks: no `CapsuleGeometry`, no bundled
`OrbitControls`). Audio starts only on user gesture.

The tag `v1` is the behavioral baseline (`pulse-v2.html` at repo root).

## Hard rules (carried forward from V1 — do not violate)

### 1. AudioContext is the master clock
All gameplay timing derives from `audio.ctx.currentTime`, via `nowSong()`.
Never use rAF timestamps, `performance.now()`, or `Date.now()` for game
timing, judgment, or scheduling. rAF is visuals-only. Audio events are
scheduled ahead via the lookahead scheduler ("A Tale of Two Clocks"
pattern: 25 ms tick, ~120 ms lookahead). Pause works by `ctx.suspend()`,
which freezes `currentTime` and therefore the whole game in sync.
(The 150 ms rotation tween uses `performance.now()` — cosmetic only;
that is the known, accepted exception.)

### 2. All input flows through the semantic input layer
Game logic only ever sees semantic actions (`lane0/1/2`, `rotateLeft`,
`rotateRight`, `pause`) emitted through `INPUT.emit()`. No keycode, touch,
or gamepad detail may leak past `src/input.js`. HUD labels come from
`CONFIG.inputLabels`, never from keycode assumptions. New input backends
(touch, gamepad) are new emitters into `INPUT.emit()` — zero game-logic
changes.

### 3. The FOV lesson: check in-world UI against the camera frustum
The camera sits at the tunnel center (FOV 72°, so ~36° half-FOV) looking
at `(0, -2.2, -30)`. In V1 the hit zone at `z = -6` was physically below
the visible frustum — invisible. It lives at `z = -11` (`CONFIG.hitZ`)
for that reason. Any in-world UI element (receptors, bands, markers) must
be verified to fall inside the ~36° half-FOV from the centered camera at
its intended position. Related: target circles live in the **gem flight
plane** (`y = -R + 0.4`, `z = hitZ`), not painted on the wall floor, so
"gem centered in circle" is literally the hit moment (no parallax).

### 4. The SONG package format is the content contract
All playable content is a SONG package (see `src/song.js`). New songs are
data only — adding one must require zero new code paths.

```js
{
  meta: { title, bpm, timeSignature, lengthBars, difficulty },
  tracks: [{
    name, color, wall,
    synth: "instrumentId"  /* OR */  stemUrl: "...",   // exactly one
    pattern: [{ step, note, len, inst? }],  // 16th grid, 2-bar backing loop
    _chartLoop: [{ step, lane }]            // authored 2-bar gem loop
  }]
}
```

- `pattern` steps are 16ths over a 2-bar loop (0–31); `note` is MIDI;
  `len` is in 16ths; `inst?` overrides the track's `synth` per event.
- `_chartLoop` is expanded by `prepareSong()` into the canonical chart
  form `[{ bar, beat, lane }]` and into runtime gems; gems take their
  note/instrument from the pattern event at the same loop step.
- A track is EITHER synth-pattern-driven OR stem-driven (`stemUrl` is a
  stubbed code path in V1 — `playStemWindow()` — kept clean for later).
- Instrument sounds are entries in the `INSTRUMENTS` registry interpreted
  by the single generic `playVoice()` — new sounds are new registry
  entries, not new code paths.

V2 (§2 of the spec) extends `meta`: `difficulty` becomes the displayed
enum `easy | normal | hard`, and per-song overrides (starting with
`speed`) live in an optional `meta.overrides` object. Update this section
when that lands.
