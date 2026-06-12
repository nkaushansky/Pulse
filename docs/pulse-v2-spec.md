# PULSE — V2 Spec

**Input:** `pulse-v2.html` (V1 baseline, feature-complete) + V2 handoff doc. Read both before starting.
**Deliverable:** V2 of PULSE, developed in a git repo, deployable as a single HTML file to nk00.com.

All V1 hard constraints carry forward except where explicitly changed here: AudioContext is the master clock (all timing from `ctx.currentTime`), input flows only through the semantic input layer, Three.js r128 from cdnjs is the only external request, audio starts only on user gesture. **Changed in V2:** localStorage is now permitted (self-hosted); single-file is now a *build output*, not a source constraint.

-----

## 0. Foundation — repo + module split (do this first, no feature work mixed in)

- Init git repo with `pulse-v2.html` as baseline; tag `v1`.
- Split into `src/` modules along the handoff’s §3 architecture map (config, instruments, songs, audio engine, scene, hit-zone UI, game state, input, HUD/flow).
- Trivial build script (concat or esbuild) producing `dist/pulse.html` — single self-contained file, same external-request profile as V1.
- `CLAUDE.md` carries: master-clock rule, input-abstraction rule, the FOV lesson (any in-world UI must be checked against the ~36° half-FOV from the centered camera), and the SONG package format as the content contract.
- **Acceptance:** `dist/pulse.html` is byte-for-byte behaviorally identical to V1 (same gameplay, same audio) before any feature commit lands.

## 1. Per-hit note audio (feel fix — highest priority after foundation)

Faithful to original Frequency: every gem hit on an uncaptured track plays that track’s **actual pattern note for that grid position**, at musical volume (comparable to the captured-stem level, not a quiet tick). A correctly played phrase must sound like the stem being performed live; capture then transitions seamlessly to autoplay.

- If the current `hitBus` path already plays the correct note, this is a mix fix; if it plays a generic sound, route hit events through `playVoice()` with the track’s instrument + the pattern note at the gem’s grid position.
- Misses and empty-lane presses play nothing musical (existing break feedback unchanged).
- **Acceptance:** with audio only (eyes closed), a player can tell whether they are hitting correct notes on an uncaptured track. No double-trigger artifacts when a captured stem and late-scheduled hit notes overlap a phrase boundary.

## 2. Song select + second song

- **Select screen** between title and count-in: song list with title, BPM, difficulty label, track count, and (once persistence lands) best score/grade per song. Keyboard and touch navigable. Replaces the direct title→count-in flow; results screen offers retry and back-to-select.
- **Second song:** “easy” entry at 100 BPM, 4 tracks, sparser charts (no track denser than ~6 gems/phrase), gentler instrument palette. Authored as a SONG package — data only, zero new code paths. NEON CIRCUIT keeps its current charts and is labeled the harder song.
- **SONG format change:** `meta.difficulty` becomes a displayed enum (`easy | normal | hard`) and `meta` gains optional per-song overrides for `speed` (others may be added later only via this overrides object). Document the format in the repo as the canonical contract.
- **Acceptance:** adding a third song requires touching only song data, no logic.

## 3. Touch/mobile input

- New touch implementation of the existing input layer (no game-logic changes): three lane tap zones across the bottom third of the screen, swipe left/right anywhere above them = rotate, tap-and-hold or button = pause. Zones must be visually indicated and sized for thumbs (min ~80px tall).
- Responsive HUD: portrait and landscape layouts; HUD elements reposition, key-hint labels swap to touch labels via `CONFIG.inputLabels`.
- **Chart density review:** verify every track in both songs is physically playable with two thumbs at the relevant BPM; adjust charts (data-only) where not. Flag any track that requires >2 simultaneous lanes.
- Multi-touch must work (two lanes hit simultaneously).
- **Acceptance:** full game completable on a phone (test target: mid-range Android Chrome + iOS Safari) with no keyboard, including menus, pause, and retry.

## 4. Latency calibration

- Calibration screen reachable from select screen/settings: steady tick at a fixed BPM, player taps along, median signed offset computed over ~16 taps, with a manual ±ms nudge fallback.
- Offset applies as a global adjustment to judgment timing only (visuals and audio scheduling unchanged).
- Stored via persistence (§5); prompt suggested on first run on a touch device.
- **Acceptance:** setting an artificial +80ms offset shifts judgment by exactly +80ms; calibration round-trips through storage.

## 5. Persistence (localStorage)

- Versioned single-key JSON blob (`pulse.save.v1`): per-song best score/grade/accuracy, settings (difficulty options, calibration offset, input labels), nothing else.
- Graceful degradation if storage is unavailable (private browsing): game fully playable, settings session-only.
- **Acceptance:** scores/settings survive reload; corrupt or missing blob never breaks boot.

## 6. Difficulty & feel options

Settings screen (shared by desktop and mobile):

- **Speed multiplier** (0.75× / 1× / 1.25×) — scales tunnel speed/spawn distance, not audio.
- **Hit window scale** (Strict ±70ms / Normal ±90ms / Relaxed ±120ms; perfect window scales proportionally).
- **Lenient mode toggle:** empty-lane presses don’t break the phrase (default OFF — Frequency-strict remains the canonical feel).
- Non-default settings are marked on the results screen (e.g., “Relaxed” tag) and tracked separately or flagged in saved bests — pick one, but default-settings bests must never be overwritten by assisted runs.
- **Acceptance:** all options apply without restart side effects; defaults reproduce V1 feel exactly.

## 7. Non-goals (explicitly out of V2)

- Real-audio stems / `stemUrl` implementation (waits for Track Studio’s content pipeline; stub remains)
- Track Studio itself (separate app, separate planning)
- Gamepad support
- Visual themes / tunnel visualization growth on capture (noted v3 candidate)
- Instanced-gem performance pass (revisit only if a song exceeds 5 populated walls)
- Online/shared leaderboards

## 8. Suggested implementation order

Foundation → per-hit audio → persistence (small, unblocks others) → song select + second song → difficulty options → touch input → calibration. Tag releases; deploy `dist/pulse.html` to nk00.com via existing pipeline at the end.