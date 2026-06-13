# PULSE — project rules

Browser rhythm game (Frequency-style tunnel). Source lives in `src/`,
built into a single self-contained file at `dist/pulse.html`.
The V2 spec is `docs/pulse-v2-spec.md`; V1 architecture context is
`docs/pulse-v2-handoff.md`.

## V2 status & roadmap

Done (in spec §-order; each section play-tested by the owner before
the next starts — keep that gate):

- **§0 Foundation** — src/ split + concat build; output was verified
  byte-identical to the `v1` baseline.
- **§1 Per-hit note audio** — see "Audio routing" below.
- **§5 Persistence** — extended beyond spec: top-5 scores per song
  (`SAVE_MAX_SCORES`), results-screen leaderboard. Fail runs may rank
  (owner's call).
- **§2 Song select + second song** — LUNAR DRIFT (easy, 100 BPM);
  flow is title → select → count-in; format change documented below.
- **§6 Difficulty & feel options** — OPTIONS screen from select (O);
  see "Persistence" below for keys and the not-ranked rule.
- **§3 Touch/mobile input** — touch backend in `src/input.js` (zero
  game-logic change); see "Touch input" below. Chart density review:
  both songs two-thumb playable as authored (no chart changes); the
  bounds are enforced by `test/charts.test.js`.

Remaining:

- **§4 Latency calibration** — tap-along median offset (~16 taps) +
  manual nudge; applies to judgment only (never audio/visual
  scheduling); stored as a `SAVE` setting; suggest on first touch run.
- **Release** — tag, deploy `dist/pulse.html` to nk00.com.

Process notes:

- Work lands on the session work branch; `main` is fast-forwarded only
  after the owner's play-test passes. §6 passed and `main` is at the
  §6+docs line (`d3525e9`); §3 awaits play-test on the work branch.
- This remote rejects tag pushes (branches only). Tags must be pushed
  from the owner's machine: `git tag v1 22f2345; git tag v2-foundation
  567e3ca; git push origin v1 v2-foundation`.
- Logic that can run outside the browser gets a Node test (stubbed
  `window`/`localStorage`) before pushing; song packages are validated
  against the contract the same way. Current suite:
  `node test/touch.test.js && node test/charts.test.js`.

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
All playable content is a SONG package in the `SONGS` array
(`src/song.js`). New songs are data only — adding one must require zero
new code paths: `selectSong()` handles timing globals, per-track audio
buses, and the tunnel rebuild.

```js
{
  meta: { title, bpm, timeSignature, lengthBars,
          difficulty: 'easy'|'normal'|'hard',   // displayed enum
          overrides?: { speed } },              // world units/sec; else CONFIG.speed
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

Tempo-derived globals (`SPB`, `S16`, `PHRASE_SEC`, `TOTAL_PHRASES`,
`TOTAL_STEPS`, `SPEED`) follow the selected song via `applySongTiming()`;
nothing may cache them across song selection. Per-song save data is
keyed by `meta.title`. Grade capture thresholds scale with
`TOTAL_PHRASES` (ratios preserve V1's values for the 48-phrase NEON
CIRCUIT). New `meta.overrides` keys may be added only via that object.

## Persistence (V2 §5)

One versioned localStorage key, `pulse.save.v1`, owned exclusively by
`src/save.js` (`SAVE`). Contents: per-song bests keyed by song title
(`{score, grade, acc}`, highest score wins) and a flat `settings` object
(`SAVE.getSetting`/`setSetting` — calibration offset, difficulty options,
etc. land here in later sections). Nothing else goes in the blob.
`SAVE` must never throw past its module: storage unavailable (private
browsing) or a corrupt/missing blob degrades to session-only state and
must never break boot. No other module touches localStorage.

Settings keys in use (V2 §6): `speedMult` (0.75|1|1.25), `windowMode`
(`strict|normal|relaxed`), `lenient` (bool). Defaults reproduce V1 feel
exactly. Runs with any non-default setting are tagged on the results
screen and are NEVER recorded to the saved bests — default-settings
records must not be displaced by assisted (or hardened) runs. The
`OPTIONS` table in `src/hud.js` is the single source of option
definitions; `applySettings()` maps `windowMode` onto `HIT_WINDOW` /
`PERFECT_WINDOW` (perfect scales proportionally), and the speed
multiplier applies inside `applySongTiming()` (tunnel speed only,
never audio).

## Touch input (V2 §3)

Touch is a second emitter into `INPUT.emit()` — rule 2 applies in
full: every touch event detail stays inside `src/input.js`. The layer:

- `#touch` DOM (template) is gated by `body.touch`, set by
  `setInputMode('touch'|'key')`: boot-time `(pointer: coarse)` check in
  `main.js`, upgraded by the first real `touchstart` if missed. The
  mode swap only repoints `CONFIG.inputLabels` at an entry of
  `CONFIG.inputLabelSets` and toggles the body class — HUD text always
  renders from `CONFIG.inputLabels` (rule 2), static prompts swap via
  `.km`/`.tm` CSS classes.
- Three lane tap zones = exact screen thirds, bottom `--tzone` high
  (`max(80px, 20vh)` portrait / `22vh` landscape, + safe-area inset),
  i.e. the zone reaches up to the hit line, no further; `touchLane()`
  maps `clientX` to lanes 0/1/2. Multi-touch: each changed touch emits
  independently.
- Rotation has two backends, both one-wall-per-action: the round
  `#trotL`/`#trotR` buttons just above the left/right zones (one tap =
  one hop — the reliable, precise control) and a swipe in the region
  above the zones (`swipeDir()`, debounced by `swipeCooldownOk()` /
  `SWIPE_COOLDOWN_MS` so a single flick / multi-touch jitter can't
  over-rotate). The round `#tpause` button is the third control. All
  gameplay touches are `preventDefault`ed non-passive +
  `touch-action:none` (no synthetic clicks, zoom, scroll,
  pull-to-refresh). NB: cycling past the first/last track is one logical
  step but a wide visual swing (tracks sit on adjacent walls spanning
  <180°); that's `rotate()` game logic, untouched by §3.
- Menus/flow are tap-first: song rows start the song (audio unlock
  gesture), `OPTIONS`/`BACK`/`DONE`/`RETRY`/`SONG SELECT` buttons and
  tap-to-resume on the pause overlay mirror the keyboard paths. The
  old click-anywhere-to-retry on results was replaced by the buttons.
- Bottom HUD: `#keyhints` is hidden in touch (redundant); `#trackname`
  and `#energywrap` are decoupled from `--tzone` and pinned above the
  receptors (the shorter zone would otherwise collide with them);
  `#judge` moves to mid-screen; the status ring grows (`88px`, `104px`
  landscape). Overlays stay scroll-safe on short screens (flex spacer
  trick in `.overlay`); mobile-web-app metas enable fullscreen via
  Add-to-Home-Screen.
- Chart authoring bound for thumbs (enforced by `test/charts.test.js`):
  ≤2 simultaneous lanes, ≥240 ms same-lane, ≥200 ms between any hits.

## Audio routing (V2 §1 — per-hit note audio)

A gem hit on an uncaptured track performs the track's **actual pattern
content at that grid step** — the full slice (chords, layered drums) —
via `playHitNote()` into `audio.noteBus` (gain 1.0, i.e. exactly the
captured-stem level; `hitBus` at 0.9 now carries only break feedback).
Backing pattern events are scheduled **only when their phrase is inside
a captured window** (`scheduleStep`): never schedule events into a muted
`tr._gain` "just in case" — a muted-scheduled voice becomes an audible
attack/tail bleed (double trigger) when a capture lands inside the
scheduler lookahead. Uncaptured events near now are recorded in
`tr._skipped`; `flushSkippedEvents()` replays the still-future ones at
capture time, excluding steps the player's own hits just performed.
Misses and empty-lane presses stay non-musical.
