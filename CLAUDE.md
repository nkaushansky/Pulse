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
  bounds are enforced by `test/charts.test.js`. Owner play-test landed
  rotate buttons + portrait zone-to-hit-line; **landscape framing left
  as-is by owner's call** (see "deferred" below).
- **Run timer (post-spec)** — results screen shows the run length as
  `M:SS` (`#r-time`); `formatTime()` in `src/game.js`, fed by `runSec`
  captured off the master clock at `finish()` (song time, clamped to
  the song on a clear). Display only — not saved, not ranked.
- **Early-tap audio feedback (feel follow-up to §1)** — a subtle
  non-musical `tapTick` on `'dead'`/`'miss'` presses, centralized in
  `pressFeedback` (`src/hitzone.js`) so all input backends inherit it and
  it stays off `'good'`/`'perfect'` (those already sound the note via
  `playHitNote`). Plus an iOS AudioContext warm-up (`warmUpAudio()`, a
  silent single-frame buffer fired on the start gesture). See "Audio
  routing" below.
- **§4 Latency calibration** — `CALIBRATE` screen reachable from OPTIONS
  (`C`): a steady 120 BPM tick, tap-along, median signed offset over 16
  taps, plus a manual ±5 ms nudge. The offset shifts **judgment timing
  only** (`applyCalibration`/`judgeNow` in `src/game.js`), never audio or
  visual scheduling; stored as the `calibrationMs` `SAVE` setting; a
  one-time prompt is suggested on the first touch run. See "Latency
  calibration" below. **Play-tested & approved; on `main`.**

**V2 is feature-complete** — every spec section (§0–§6) plus the
post-spec run timer and early-tap audio feedback is on `main` and
play-tested. The only roadmap item left is Release, which is on hold (see
below).

Remaining:

- **Release** — tag the V2-complete commit + deploy `dist/pulse.html` to
  nk00.com. **On hold** — owner is holding deploy while scoping V3, so the
  release is paused (not blocked). The tag is just a marker and can wait;
  when ready it must be pushed from the owner's machine (this remote
  rejects tag pushes — see process notes).

Next up (V3 — owner scoping):

- Owner has V3 thoughts that fold in the deferred candidates below
  (landscape reframe, accelerometer row-switching, haptics) and the V2
  non-goals (real-audio stems / `stemUrl`, Track Studio, gamepad, visual
  themes / capture-driven tunnel growth, instanced-gem perf pass, online
  leaderboards). Await the owner's V3 spec before starting; V3 work begins
  fresh from `main`.

Deferred candidates (owner-acknowledged, not scheduled):

- **Landscape tunnel framing** — owner wants the active wall to fill
  the screen in landscape; impossible by zoom under the fixed-camera +
  FOV rule (wide aspect → wide horizontal FOV → narrow active wedge;
  zooming enough drops the hit zone out of frustum). Needs a camera
  reframe (highway-style look just for landscape) + FOV re-validation.
  Owner chose "leave it" for now; portrait frames the active path well.
- **Mobile expansion (future)** — accelerometer/tilt to switch the
  active wall (experimental; must not fight deliberate play — gate
  behind a setting and validate against the buttons/swipe); haptic
  feedback via the Vibration API on zone tap and on gem hit. Haptics
  would also give tactile confirmation that complements the early-tap
  audio fix above (a tap you can feel even mid-broken-phrase).

Process notes:

- Work lands on the session work branch; `main` is fast-forwarded only
  after the owner's play-test passes. §4 latency calibration (`7c60f61`)
  passed, so `main` is fast-forwarded to the V2-complete line. Release is
  paused for V3 scoping (deploy is the only remaining step).
- This remote rejects tag pushes (branches only). Tags must be pushed
  from the owner's machine: `git tag v1 22f2345; git tag v2-foundation
  567e3ca; git push origin v1 v2-foundation`.
- Logic that can run outside the browser gets a Node test (stubbed
  `window`/`localStorage`) before pushing; song packages are validated
  against the contract the same way. Current suite:
  `node test/touch.test.js && node test/charts.test.js && node test/results.test.js && node test/calibrate.test.js`.

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

Settings keys in use: `speedMult` (0.75|1|1.25), `windowMode`
(`strict|normal|relaxed`), `lenient` (bool) — all V2 §6; `calibrationMs`
(signed int, V2 §4 latency offset); `calibPrompted` (bool, one-time
first-touch calibration suggestion). Defaults reproduce V1 feel exactly
(`calibrationMs` 0 = no offset). Runs with any non-default setting are tagged on the results
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

## Latency calibration (V2 §4)

A `CALIBRATE` screen (`src/calibrate.js`, `#calib` in the template) reached
from OPTIONS (`C` key or the button). A steady tick at `CALIB_BPM` (120)
is scheduled on the master clock by a lookahead scheduler (same 25 ms /
120 ms pattern as the game — the `setInterval` is only the driver). Each
tap reads `audio.ctx.currentTime` and records its **signed** distance to
the nearest scheduled tick; after `CALIB_TAPS` (16) the rolling median
becomes the value, with a manual ±5 ms nudge (`calibClamp`, bound ±200).
`SAVE` (`calibrationMs`).

The offset shifts **judgment timing only** — never audio or visual
scheduling, never the phrase index. `applySettings()` derives
`CALIB_OFFSET` (seconds) from `calibrationMs`; `applyCalibration(t) =
t - CALIB_OFFSET` and `judgeNow() = applyCalibration(nowSong())`
(`src/game.js`). It is applied in exactly three judgment spots:
`onLaneInput` (the gem-match `dt` and the signed `off`), `missCheck`
(the auto-miss boundary, so it tracks the shifted hit window), and
`setupAttempt`'s slipped-past check. Everything else — gem positions,
`scheduleStep`, `playHitNote`, count-in, the phrase index `p` and the
attempt/break bookkeeping — stays on the raw `nowSong()` clock. So
`CALIB_OFFSET = 0` is byte-identical to V1 feel, and a +80 ms offset moves
the on-time moment exactly +80 ms later (the spec acceptance, covered by
`test/calibrate.test.js` along with the storage round-trip). Edge note:
under a large *positive* offset a gem within ~`offset` of a phrase
boundary can slip past the auto-miss (the visual phrase advances first) —
benign leniency, never a false break; real offsets are tens of ms.

First-run suggestion: `maybeSuggestCalibration()` (called from
`enterSelect`) shows a one-time `#calibprompt` on touch devices that
haven't calibrated, gated by the `calibPrompted` flag.

## Audio routing (V2 §1 — per-hit note audio)

A gem hit on an uncaptured track performs the track's **actual pattern
content at that grid step** — the full slice (chords, layered drums) —
via `playHitNote()` into `audio.noteBus` (gain 1.0, i.e. exactly the
captured-stem level; `hitBus` at 0.9 carries break feedback + the tap tick).
Backing pattern events are scheduled **only when their phrase is inside
a captured window** (`scheduleStep`): never schedule events into a muted
`tr._gain` "just in case" — a muted-scheduled voice becomes an audible
attack/tail bleed (double trigger) when a capture lands inside the
scheduler lookahead. Uncaptured events near now are recorded in
`tr._skipped`; `flushSkippedEvents()` replays the still-future ones at
capture time, excluding steps the player's own hits just performed.

Misses and empty-lane presses stay non-musical, but they are still
*acknowledged*: `pressFeedback` (`src/hitzone.js`) plays a soft
non-musical `tapTick` on every `'dead'`/`'miss'` press (into `hitBus`,
never `noteBus`), so taps aren't silent for the rest of a broken phrase.
It is deliberately off `'good'`/`'perfect'`, which already sound the note
via `playHitNote`, so it can never overlap or muddy the per-hit note
audio. `warmUpAudio()` (`src/audio.js`) plays one silent single-frame
buffer on the start gesture (iOS unlock) so the first real note after
`ctx.resume()` isn't swallowed.
