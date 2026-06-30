# PULSE — V2 Completion & Handoff

**Purpose of this doc:** Record the finished state of PULSE V2 and brief
the next phase (V3 planning) the same way `pulse-v2-handoff.md` briefed V2
planning. Read this fully before proposing V3 features.

**Workflow (unchanged from V1→V2):** (1) This doc + `dist/pulse.html` go to
a planning thread. (2) Planning debates/prioritizes V3 features and outputs
a tight V3 spec in the V1/V2 style. (3) Spec + repo move to Claude Code for
implementation, starting **fresh from `main`**.

**Companion docs:** `docs/pulse-v2-spec.md` (the spec V2 was built against),
`docs/pulse-v2-handoff.md` (V1 architecture / why-it-is-like-this),
`CLAUDE.md` (the living rules — authoritative; this doc is a point-in-time
snapshot).

-----

## 1. Status at a glance

- **V2 is feature-complete and play-tested.** Every spec section (§0–§6)
  plus two post-spec items (run timer, early-tap audio feedback) is on
  `main` and approved by the owner on a phone.
- **`main` is at `ffab73e`** (V2-complete functional line is `7c60f61`
  §4 calibration; `ffab73e` adds the doc status bump).
- **Deploy is on hold**, not blocked — the owner is holding the nk00.com
  deploy while scoping V3. The only remaining roadmap step is Release
  (tag + deploy); see §10.
- **No open work on `main`.** The session work branch
  `claude/pulse-v2-audio-calibration-b0ck5u` is merged into `main` by
  fast-forward and carries nothing extra.

## 2. What PULSE is now

A browser rhythm game inspired by Frequency (PS2, 2001). The player flies
down an octagonal tunnel; each wall is an instrument track with 3 lanes of
gems. Rotate to face a track, hit its gems in time, and clearing a full
2-bar phrase with zero misses **captures** the track — its part unmutes
(autoplays) for 8 bars, then remutes and reopens. Keep as much of the song
unmuted as possible; chase score and grade.

Since V1 this is now: a **two-song** game with a **song-select** flow,
**touch/mobile** support, **persistence** (per-song top-5 leaderboards +
settings), **difficulty/feel options**, **latency calibration**, and
faithful **per-hit note audio** (hitting an uncaptured gem performs that
track's real note at musical level). Flow: **title → select → (options /
calibrate) → count-in → play → results**.

## 3. Hard constraints (carried forward — do not violate in V3)

These are the V1 rules as amended by V2. `CLAUDE.md` is the authority.

- **AudioContext is the master clock.** All gameplay timing/judgment/
  scheduling derives from `audio.ctx.currentTime` via `nowSong()`. Never
  use rAF timestamps, `performance.now()`, or `Date.now()` for game
  timing. rAF is visuals-only. Audio is scheduled ahead via the lookahead
  scheduler (25 ms tick, ~120 ms lookahead — "A Tale of Two Clocks").
  Pause = `ctx.suspend()` (freezes `currentTime`, so the whole game
  freezes in sync). *Accepted exception:* the 150 ms rotation tween uses
  `performance.now()` — cosmetic only.
- **All input flows through the semantic input layer** (`INPUT.emit`,
  `src/input.js`). Game logic only ever sees `lane0/1/2`, `rotateLeft`,
  `rotateRight`, `pause`. No keycode/touch detail leaks past `input.js`.
  HUD labels come from `CONFIG.inputLabels`. New backends (gamepad, tilt)
  are new emitters — zero game-logic change.
- **The FOV lesson.** Camera sits at tunnel center (FOV 72° → ~36°
  half-FOV) looking at `(0,-2.2,-30)`. Any in-world UI (receptors, bands,
  markers) must be verified to fall inside that half-FOV. The hit zone
  lives at `z=-11` for this reason; target circles live in the gem flight
  plane (`y=-R+0.4, z=hitZ`) so "gem centered in circle" *is* the hit
  moment.
- **The SONG package is the content contract** (`src/song.js`). New songs
  are data only — zero new code paths. See §6.
- **Three.js r128 from cdnjs is the only external request** (r128 quirks:
  no `CapsuleGeometry`, no bundled `OrbitControls`). Audio is synthesized;
  no audio files. AudioContext starts only on a user gesture.

**Changed in V2 (now permitted):** localStorage (self-hosted, no longer
the claude.ai artifact constraint); single-file is now a **build output**
(`dist/pulse.html`), not a source constraint.

## 4. What shipped in V2 (by spec section)

| Section | What | Key code |
|---|---|---|
| **§0 Foundation** | V1 single file split into `src/` modules + concat build; verified byte-identical to the `v1` baseline | `build.js`, `src/template.html` |
| **§1 Per-hit note audio** | A gem hit on an uncaptured track performs that grid step's actual pattern slice at stem level; capture is a seamless handoff with no double-trigger at phrase seams | `playHitNote`, `scheduleStep`, `flushSkippedEvents` (`src/audio.js`) |
| **§2 Song select + 2nd song** | Title→select flow; LUNAR DRIFT (easy); `meta.difficulty` enum + `meta.overrides.speed` | `buildSelect` (`src/hud.js`), `SONGS` (`src/song.js`) |
| **§3 Touch/mobile** | Lane tap-zones, swipe + round buttons to rotate, pause button, responsive HUD, first-touch mode flip | touch backend in `src/input.js`, `#touch` DOM + CSS in template |
| **§5 Persistence** | One versioned localStorage blob; top-5 scores/song + results leaderboard; settings object | `SAVE` (`src/save.js`) |
| **§6 Difficulty & feel** | Speed (0.75/1/1.25×), hit window (strict/normal/relaxed), lenient mode; non-default runs tagged + never ranked | `OPTIONS` (`src/hud.js`), `applySettings` (`src/config.js`) |
| **Run timer** (post-spec) | Results shows run length `M:SS` (display only) | `formatTime`, `runSec` (`src/game.js`) |
| **Early-tap audio** (post-spec) | Non-musical `tapTick` on dead/miss presses + iOS audio warm-up | `pressFeedback` (`src/hitzone.js`), `warmUpAudio` (`src/audio.js`) |
| **§4 Latency calibration** | CALIBRATE screen: 120 BPM tap-along, 16-tap median + ±5 ms nudge, judgment-only offset, first-touch suggestion | `src/calibrate.js`, `applyCalibration`/`judgeNow` (`src/game.js`) |

**Milestone commits** (oldest → newest):

```
22f2345  v1 baseline (pulse-v2.html at repo root)
567e3ca  §0 foundation (src/ split + build)
9d6ef9c  §1 per-hit note audio + capture-seam fix
76e2c28  §5 persistence blob
c939100  §5 top-5 scores + results leaderboard
6227a0e  §2 song select + LUNAR DRIFT
0df20ad  §6 difficulty & feel options
2e2fead  §3 touch input   (+ 0161dea, 6cf671e polish)
07b6f97  run timer (M:SS)
58de742  early-tap audio feedback + iOS warm-up
7c60f61  §4 latency calibration       ← V2-complete functional line
ffab73e  docs: V2 feature-complete    ← current main
```

## 5. Architecture map (`src/` modules → `dist/pulse.html`)

No module system — `build.js` concatenates the files **in MODULES order**
into the `{{MODULES}}` slot of `src/template.html`, producing one
self-contained file in one script scope, top-to-bottom (exactly like the
V1 single `<script>`). **Load order = MODULES order.** A module may only
reference earlier modules' top-level bindings *at load time*; function
bodies may reference anything (the whole concatenated script's function
declarations are hoisted).

Order and role:

1. **config.js** — timing constants, `CONFIG` (keymap, `inputLabelSets`),
   `HIT_WINDOW`/`PERFECT_WINDOW`, `CALIB_OFFSET`, `applySettings()`.
2. **save.js** — `SAVE`: the versioned localStorage blob (bests +
   settings). Never throws past this file.
3. **instruments.js** — `INSTRUMENTS` synth-patch registry (interpreted by
   one generic `playVoice`). V2 added a gentle palette (`kickSoft`,
   `hatSoft`, `pluckSoft`, `padWarm`) and the non-musical `tapTick`.
4. **song.js** — `SONGS` packages, `prepareSong()` (chart expansion),
   `applySongTiming()`, `selectSong()`.
5. **audio.js** — audio graph (`master`/`hitBus`/`noteBus`/`pulseBus`),
   `playVoice`, lookahead scheduler, `playHitNote`, `flushSkippedEvents`,
   `warmUpAudio`, the `stemUrl` stub (`playStemWindow`).
6. **scene.js** — three.js tunnel, walls, gem pooling, rotation tween,
   wall visuals.
7. **hitzone.js** — `showJudge` + `pressFeedback` (per-press feedback,
   incl. the tap tick).
8. **game.js** — state `G` + rules: `newGame`, `setupAttempt`,
   `onPhraseBoundary`, `breakPhrase`, `captureTrack`, `onLaneInput`,
   `missCheck`, `rotate`, `finish`, `formatTime`, and the calibration
   judgment helpers `applyCalibration`/`judgeNow`.
9. **input.js** — `INPUT.emit` + keyboard backend + touch backend + flow
   (select/options/calibrate/results) event wiring.
10. **hud.js** — DOM HUD, status ring, title/select/options builders,
    `OPTIONS` table.
11. **calibrate.js** — the §4 CALIBRATE screen (tick scheduler, tap
    capture, median, nudge, first-run suggestion, DOM wiring).
12. **main.js** — rAF loop (visuals only) + boot.

## 6. Content & the SONG package format (the contract)

Two songs ship: **NEON CIRCUIT** (hard, 120 BPM, 96 bars, 5 tracks) and
**LUNAR DRIFT** (easy, 100 BPM, 64 bars, 4 tracks, `speed` override 15).
Adding a third song is **data only** — push a package into `SONGS`.

```js
{
  meta: { title, bpm, timeSignature, lengthBars,
          difficulty: 'easy'|'normal'|'hard',   // displayed enum
          overrides?: { speed } },              // world units/sec; else CONFIG.speed
  tracks: [{
    name, color, wall,
    synth: "instrumentId"  /* OR */  stemUrl: "...",   // exactly one
    pattern: [{ step, note, len, inst? }],  // 16th grid, 2-bar backing loop (0–31)
    _chartLoop: [{ step, lane }]            // authored 2-bar gem loop
  }]
}
```

- `prepareSong()` expands `_chartLoop` into canonical `[{bar,beat,lane}]`
  and runtime gems; each gem takes its note/instrument from the pattern
  event at the same loop step.
- A track is **either** synth-pattern-driven **or** stem-driven. `stemUrl`
  is a clean but **stubbed** code path (`playStemWindow`) — the V3 hook
  for real audio.
- Tempo globals (`SPB`, `S16`, `PHRASE_SEC`, `TOTAL_PHRASES`,
  `TOTAL_STEPS`, `SPEED`) follow the selected song via `applySongTiming()`;
  nothing caches them across selection. Grade thresholds scale with
  `TOTAL_PHRASES` (ratios preserve NEON CIRCUIT's V1 values).
- **Chart density bound (enforced by `test/charts.test.js`):** ≤2
  simultaneous lanes, ≥240 ms same-lane gap, ≥200 ms between any hits
  (two-thumb playable).

## 7. Persistence, settings & audio routing (the subtle parts)

**Persistence:** one key `pulse.save.v1`, owned solely by `src/save.js`.
Contents: per-song bests keyed by title (top-5, highest score wins) + a
flat `settings` object. Degrades to session-only if storage is
unavailable; a corrupt/missing blob never breaks boot.

**Settings keys in use:** `speedMult`, `windowMode`, `lenient` (§6);
`calibrationMs` (signed int — §4 latency offset); `calibPrompted` (bool —
one-time first-touch suggestion). Defaults reproduce V1 feel exactly
(`calibrationMs` 0 = no offset). **Runs with any non-default setting are
tagged on results and never recorded to bests** (default records can't be
displaced by assisted/hardened runs).

**Audio routing (§1):** uncaptured gem hits perform the pattern slice into
`noteBus` (gain 1.0 = captured-stem level). Backing events are scheduled
**only inside a captured window** — never into a muted `tr._gain` (a
muted-scheduled voice would bleed as a double-trigger when a capture lands
inside the lookahead). Uncaptured near-now events are recorded in
`tr._skipped`; `flushSkippedEvents()` replays still-future ones at capture,
excluding steps the player's own hits performed. `hitBus` (0.9) carries
break feedback + the non-musical `tapTick`.

**Calibration (§4) — judgment-only:** `CALIB_OFFSET` (seconds, from
`calibrationMs`) shifts **only** hit/miss judgment via
`applyCalibration(t)=t−CALIB_OFFSET` / `judgeNow()`, applied in exactly
three spots: `onLaneInput` (match `dt` + signed `off`), `missCheck`
(auto-miss boundary), `setupAttempt` (slipped-past check). Gem positions,
scheduling, `playHitNote`, count-in, and the phrase index stay on the raw
clock — so `0` is byte-identical to V1, and +80 ms moves the on-time
moment exactly +80 ms.

## 8. Testing

Node tests run logic that can execute outside the browser (stubbed
`window`/`localStorage`); song packages are validated against the contract
the same way. Run before every push:

```
node test/touch.test.js && node test/charts.test.js \
  && node test/results.test.js && node test/calibrate.test.js
```

- **touch.test** — pure gesture math (`touchLane`, `swipeDir`,
  `swipeCooldownOk`) + label-set contract.
- **charts.test** — SONG contract + the two-thumb density bounds for every
  track in both songs.
- **results.test** — `formatTime` M:SS edge cases.
- **calibrate.test** — `calibMedian`/`calibClamp` math, the **+80 ms
  judgment shift**, and the **storage round-trip** (spec §4 acceptance).

Anything genuinely browser-only (WebAudio graph, three.js, DOM) is
verified by owner phone play-test, not Node.

## 9. Build / run / verify

- **Build:** `node build.js` → writes `dist/pulse.html` (~79 KB of
  script). **Rebuild and commit `dist` whenever `src/` changes** — it is
  the deployable.
- **Run locally:** open `dist/pulse.html` (needs network for the r128 CDN
  script). Audio unlocks on the first gesture.
- **Verify on a phone:** the owner uses a temporary-public-repo +
  `raw.githack.com/<user>/<repo>/<branch>/dist/pulse.html` flow. Test
  targets: mid-range Android Chrome + iOS Safari, portrait and landscape,
  menus/pause/retry, multi-touch chords.

## 10. Release process (pending — owner-gated)

Two steps, both deferred while V3 is scoped:

1. **Tag** the V2-complete commit. A tag is a permanent named bookmark
   (`v2 → ffab73e`) — *not* a deploy, and not required to preserve the
   work. **This remote rejects tag pushes**, so tags must be created and
   pushed from the owner's machine:
   ```
   git tag v2 ffab73e && git push origin v2
   # pending backfill from earlier:
   git tag v1 22f2345; git tag v2-foundation 567e3ca
   git push origin v1 v2-foundation
   ```
2. **Deploy** `dist/pulse.html` to nk00.com (DreamHost, existing upload
   pipeline; single-file output is exactly why the build emits one file).

## 11. Known edges, gotchas & tech debt

- **Landscape tunnel framing** (deferred): the active wall doesn't fill the
  screen in landscape. Impossible by zoom under the fixed-camera/FOV rule
  (wide aspect → wide horizontal FOV → narrow active wedge; zooming enough
  drops the hit zone out of frustum). Needs a camera reframe just for
  landscape + FOV re-validation. Owner chose "leave it"; portrait frames
  the active path well.
- **Calibration boundary leniency** (benign): under a *large positive*
  offset, a gem within ~`offset` of a phrase boundary can slip past the
  auto-miss because the visual phrase advances first. Leniency only, never
  a false break; real offsets are tens of ms.
- **`stemUrl` is stubbed** — `playStemWindow` is a clean code path but
  untested against real decoded buffers. Real stems will also lean on §4
  calibration (Bluetooth latency).
- **Performance** untested beyond ~5 populated walls; instanced gems were
  explicitly deferred (revisit only if a song exceeds 5 populated walls).
- **Tag pushes** can't happen from this remote (branches only) — see §10.

## 12. V3 candidate directions (seed list — planning should prune/prioritize/add)

The owner has V3 thoughts that fold in everything previously parked. Start
**fresh from `main`**; await a V3 spec before implementing.

**Deferred V2 candidates (owner-acknowledged):**
- Landscape camera reframe (highway-style look for landscape) + FOV
  re-validation.
- Accelerometer/tilt to switch the active wall (experimental — must not
  fight deliberate play; gate behind a setting, validate vs buttons/swipe).
- Haptics via the Vibration API on zone tap + gem hit (tactile complement
  to the early-tap audio fix).

**Former V2 non-goals (now V3 candidates):**
- Real-audio stems via `stemUrl` (decode to AudioBuffers, windowed
  playback; needs the §4 calibration it now has).
- Track Studio — in-browser chart/pattern editor exporting the SONG
  package format.
- Gamepad support (another `INPUT.emit` backend).
- Visual themes / capture-driven tunnel growth.
- Instanced-gem performance pass.
- Online / shared leaderboards.

## 13. Transition notes for V3 implementation

- V3 begins fresh from `main` (currently `ffab73e`). Keep the play-test
  gate: land work on a session branch, fast-forward `main` only after the
  owner approves each item on a phone.
- `CLAUDE.md` carries the live rules (master clock, semantic input, FOV,
  SONG contract, persistence, audio routing, calibration) — keep it
  current as the source of truth; this doc is a snapshot.
- Every outside-the-browser bit of logic gets a Node test before pushing;
  rebuild + commit `dist/pulse.html` with any `src/` change.
- Deploy target stays DreamHost / nk00.com, single-file output.
