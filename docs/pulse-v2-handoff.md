# PULSE — V2 Handoff Document

**Purpose of this doc:** Brief a planning conversation on the current state of PULSE so it can run a V2 feature discussion, then produce a V2 spec for implementation in Claude Code. Read this fully before proposing features.

**Workflow:** (1) This doc + `pulse-v2.html` go to a planning thread. (2) Planning thread debates/prioritizes V2 features and outputs a tight V2 spec doc in the same style as the V1 spec. (3) Spec + file move to Claude Code in a real repo for implementation.

-----

## 1. What PULSE is

A browser rhythm game inspired by Frequency (PS2, 2001). Player flies down an octagonal tunnel; each wall is an instrument track with 3 lanes of gems. Completing a full 2-bar phrase with zero misses “captures” the track — its part unmutes for 8 bars, then remutes and reopens. Goal: keep as much of the song unmuted as possible, chase score.

V1 is **feature-complete and working**: full game flow (title → instructions → count-in → play → results), scoring with multiplier, energy/fail state, grades S–F, pause/retry, and a polished hit-zone UI with per-press timing feedback.

## 2. Hard constraints (do not violate in V2 proposals)

- **Single self-contained HTML file** (V1 requirement; V2 may revisit — see §7, “repo structure” is an open question for planning).
- **Three.js r128 from cdnjs** — the only external request. r128 quirks: no `CapsuleGeometry`, no bundled `OrbitControls`.
- **Web Audio API only**, all sound synthesized procedurally. No audio files in V1.
- **AudioContext is the master clock.** All gameplay timing derives from `ctx.currentTime` via `nowSong()`. Never use rAF timestamps or `Date.now()` for game timing.
- **No localStorage/sessionStorage** (claude.ai artifact constraint — fine to add once self-hosted, flag it as a V2 unlock).
- AudioContext starts only on user gesture (title screen click/keypress).

## 3. Architecture map (single file: `pulse-v2.html`, ~1,330 lines)

Order within the one `<script>` block:

1. **Constants & CONFIG** — timing math (BPM 120, 4/4, 96 bars, 2-bar phrases), `CONFIG`: `speed:18` (world units/sec), `spawnAhead:7.0`s, `hitZ:-11`, `tunnelRadius:6`, `rotateTween:0.15`s, `countInBeats:3`, plus `keymap` and `inputLabels`. Hit windows: `HIT_WINDOW` ±90ms, `PERFECT_WINDOW` ±40ms.
1. **INSTRUMENTS registry** — 13 named synth patches (kick909, snareNoise, clap, hatClosed, hatOpen, bass808, bassSaw, leadSquare, padTriangle, arpPluck, fxSweep, breakBuzz, tickHi, pulseTick). Each is a data object interpreted by ONE generic `playVoice()` function. New sounds = new registry entries, not new code paths.
1. **SONG package** — “NEON CIRCUIT”: meta + 5 tracks (Drums, Bass, Synth Lead, Synth Pad, Arp/FX) on walls 0–4 of 8. Each track: color, instrument refs, `pattern` (16th grid for the backing loop) and a chart authored as a 2-bar `_chartLoop`, expanded by `prepareSong()` into canonical `[{bar, beat, lane}]`. Per-track `synth` instrumentId OR `stemUrl` switch — **stem path is stubbed** (`playStemWindow()`) but the code path is clean; this is the V2 hook for real audio.
1. **Audio engine** — `initAudio()` (compressor → master, plus hitBus/pulseBus, shared noise buffer), `playVoice()`, lookahead scheduler (`schedulerTick` every 25ms scheduling ~100ms ahead — “Tale of Two Clocks” pattern). Quiet always-on pulse tick (gain 0.06) so the grid is audible pre-capture. Capture unmutes via `setValueAtTime`/`linearRamp`; remute scheduled at capture time.
1. **Three.js scene** — `initScene` (camera at tunnel center, `lookAt(0,-2.2,-30)`), `buildWalls` (octagon, per-wall group: floor plane, lane grid lines, hit zone), `buildRings` (depth rings), gem pooling per track (`getGemMesh`/`releaseGemMesh`), `updateTrackGems` (spawn/position/cull; gems cull at z > -0.6 after passing the hit zone), `rotateTunnelTo` (150ms Z-rotation tween), `updateWallVisuals` (per-frame opacity/pulse driving).
1. **Hit-zone UI** (added post-V1-spec, see §5) — per populated wall: timing-window band, perfect strip, and 3 lane target circles (ring + fill + center dot) **in the gem flight plane** at `y = -R + 0.4`, `z = HIT_Z`. `pressFeedback()` + `showJudge()` handle per-press feedback.
1. **Game state** — `G` object; `newGame`, `setupAttempt`, `onPhraseBoundary`, `breakPhrase`, `captureTrack`, `onLaneInput`, `missCheck`, `rotate`, `finish`. Capture = locked through phrase P+4 (8 bars from next phrase boundary); gems hidden while captured. Full-spectrum bonus +5000 when all 5 locked simultaneously. Empty-lane press breaks the phrase (Frequency-strict). Rotation mid-phrase invalidates the attempt unless no gems have slipped past.
1. **INPUT layer** — keyboard events → semantic actions (`lane0/1/2`, `rotateLeft/Right`, `pause`) via `CONFIG.keymap`; game logic never sees keycodes; HUD labels come from `CONFIG.inputLabels`. **This abstraction exists specifically so touch/gamepad can be added without touching game logic.**
1. **HUD & flow** — DOM-based: score/mult, SVG status ring (rotates in sync with tunnel), progress bar, bar count, track name/state, energy bar, key hints, `showMsg` (big center messages), `showJudge` (timing readout). Pause via `ctx.suspend()/resume()` (ESC, auto-pause on `visibilitychange`). R = retry.

## 4. Controls

J/K/L or ←/↓/→ = lanes 0/1/2 · Q/E or A/D = rotate active wall · ESC = pause · R = retry.

## 5. Decisions made during V1 (context for “why is it like this”)

- **Hit zone moved from z=-6 to z=-11**: at -6 it was physically below the camera’s FOV — invisible. Lesson: any HUD-in-world element must be checked against the ~36° half-FOV from the centered camera.
- **Target circles live in the gem flight plane** (not painted on the wall floor) — eliminates parallax so “gem centered in circle” is literally the hit moment.
- **Per-press feedback** (every keypress, not just hits): PERFECT (white) / signed “N ms EARLY/LATE” readout (lane color) / MISS (red, breaks phrase) / dead-phrase press (grey, no penalty, no text).
- Hit gems sound their note through `hitBus` even on uncaptured tracks (faithful Frequency feel).
- Arp is the hard track (12 gems/phrase), Pad the easy one (3 gems/phrase).
- Early hits across a phrase boundary are accepted (candidate search spans phrase p and p+1).

## 6. Known soft spots / tech debt

- Difficulty is fixed; no speed or window options.
- One hardcoded song; no song-select; charts hand-authored in source.
- `playStemWindow()` stub untested against real audio buffers.
- No persistence of any kind (scores, settings, calibration).
- No audio latency calibration offset — synth latency is near-zero so it’s fine now, but real stems + Bluetooth audio will need an adjustable offset.
- Performance untested beyond 5 populated walls.

## 7. V2 candidate directions (seed list — planning thread should prioritize, prune, and add)

Already anticipated by V1 architecture:

- **Real-audio stems** via `stemUrl` (decode to AudioBuffers, windowed playback in `playStemWindow`; needs latency calibration setting).
- **Touch/mobile input** (input abstraction ready; needs lane tap zones + swipe rotate + responsive HUD).
- **Track Studio** — in-browser chart/pattern editor exporting the SONG package format.

Natural additions to evaluate:

- Song select + multiple songs (SONG package format already supports it).
- Difficulty options (speed, hit windows, lenient mode where empty presses don’t break).
- Persistence: high scores, settings, calibration (unlocked by self-hosting on nk00.com).
- Gamepad support; remix/freestyle mode; visual themes; performance pass (instanced gems) if wall count grows.

**Open question for planning:** keep single-file build (with a build script concatenating modules) vs. proper module structure once in a repo. Single-file is great for deployment to nk00.com; modules are better for Claude Code iteration. A `src/ → build → dist/pulse.html` pipeline gets both.

## 8. Claude Code transition notes

When implementation starts:

- Init a git repo with `pulse-v2.html` as the V1 baseline (tag it `v1`).
- First task: the structure decision from §7 (likely split into `src/` modules + trivial build script).
- `CLAUDE.md` should carry forward: the master-clock rule (§2), the input-abstraction rule (§3.8), the FOV lesson (§5), and the SONG package format as the contract for all content.
- Deployment target: DreamHost at nk00.com (existing upload pipeline; single-file output preferred for that).

## 9. The deliverable expected from the planning thread

A V2 spec in the same style as the V1 build prompt: scoped feature list with priorities, acceptance criteria per feature, explicit non-goals, and any changes to the SONG package format spelled out. Implementation details stay out of the spec except where they’re contracts (file formats, input actions, timing rules).