# Playback — Manual Test Cases

These are manual regression checks (no automated playback tests are currently set up).

## Automated Focus Regression Kit

For Issue #21 style regressions (Focus From/To boundary drift around repeats/voltas and muted-voice behavior),
run:

```bash
npm run test:focus-playback
```

Harness location:
- `devtools/focus_playback_harness/run_tests.js`
- Fixture tune: `devtools/focus_playback_harness/fixtures/bouchard_x16_issue21.abc`

The harness validates:
- Segment mode boundary resolution for ranges before/through/after reprise sections.
- Deterministic mapping for `1-2`, `3-6`, `8-18`, `15-16`, `17-18`.
- Loop ON/OFF invariance for resolved playback bounds.
- Visible mode (no From/To) planning.
- Fail-closed invalid range handling.
- Muted voices filtering, including implicit/malformed `V:1` behavior.

## PB-01 — Focus loop must not persist after exit

Goal: Ensure leaving Focus mode resets any pending Focus-derived loop playback plan.

Steps:
1. Open an `.abc` tune with multiple measures.
2. Enter Focus mode.
3. Enable Loop and set From/To to a non-trivial range (e.g. 5–8).
4. Press Play and confirm playback starts at the loop range.
5. Stop playback.
6. Exit Focus mode.
7. Press Play.

Expected:
- Playback starts from the normal transport start (beginning of tune, or the current transport playhead if you moved it),
  not from the previous Focus loop range.

## PB-DRUM-01 — `%%MIDI drum +:` lines collapse into one payload line

Goal: Ensure multiline drum definitions are merged into a single `%%MIDI drum` line for playback payload.

Steps:
1. Open `/home/avetik/Projects/ABC/abc/Ara_Dinkjian_etc.abc`.
2. Select the tune `X:160` (Bu akşam gün batarken gel).
3. Open **Help → Diagnostics → Payload mode** and switch to **Playback payload**.
4. Find the `%%MIDI drum` definition block in the payload.

Expected:
- No `%%MIDI drum +:` lines remain.
- A single `%%MIDI drum` line contains the rhythm, drum map numbers, and velocities appended in order.

## PB-DRUM-02 — V:DRUM preserves bar/repeat/volta skeleton of V:1

Goal: Ensure V:DRUM mirrors the barline/repeat/volta structure exactly.

Steps:
1. Use the same tune as PB-DRUM-01.
2. In **Playback payload**, locate `V:1` and `V:DRUM`.
3. Compare barlines (`|`, `||`, `|:`, `:|`) and voltas (`[1`, `[2`) visually.

Expected:
- V:DRUM has the same barline + volta positions as V:1.
- Pattern resets at repeats/voltas; there are no missing or extra bars.

## PB-DRUM-03 — No extra V:DRUM content after `|]`

Goal: Ensure drum generation stops at the final tune terminator.

Steps:
1. Use any tune with `|]` end (X:160 is sufficient).
2. Inspect the end of the V:DRUM payload.

Expected:
- V:DRUM ends cleanly at `|]` with no trailing generated bars.

## PB-SEL-01 — Selection playback: loop off plays once

Goal: Verify selection playback obeys `Loop selection = off`.

Steps:
1. Open a tune with several bars and clear any Focus loop.
2. Select 1-2 bars in the editor.
3. In Settings -> Playback -> Selection, set `Loop selection` OFF.
4. Press Play.

Expected:
- Playback starts at selection start and stops at selection end.
- Selection does not loop.

## PB-SEL-02 — Selection playback: loop on repeats selected range

Goal: Verify selection playback obeys `Loop selection = on`.

Steps:
1. Use the same tune and select a short 1-2 bar range.
2. In Settings -> Playback -> Selection, set `Loop selection` ON.
3. Press Play and wait past one pass.

Expected:
- Playback repeats the selected range until Stop.

## PB-SEL-03 — Suppress repeats toggle affects repeat-crossing selection

Goal: Verify repeat markers in selection are flattened only when enabled.

Steps:
1. Select a range that includes `|:`, `:|`, or volta markers (`[1`, `[2`).
2. Set `Selection: suppress repeats` OFF, press Play, note behavior/warning.
3. Stop, set `Selection: suppress repeats` ON, press Play again.

Expected:
- OFF: playback may follow repeat semantics and can warn about repeat crossing.
- ON: playback is linearized through selection, with repeat markers flattened.

## PB-SEL-04 — Mute chord symbols toggle

Goal: Verify gchords can be suppressed during selection playback.

Steps:
1. Use a tune containing chord symbols.
2. Select a range with visible chord symbols.
3. Toggle `Selection: mute chord symbols` OFF/ON and play each time.

Expected:
- OFF: chord symbols are audible as usual.
- ON: chord-symbol playback is muted for selection playback.

## PB-SEL-05 — Muted voices list (best-effort)

Goal: Verify voice muting by IDs and document known inline limitation.

Steps:
1. Use a multi-voice tune (e.g. `V:1`, `V:2`).
2. Select a range covering both voices.
3. Set `Selection: muted voices` to `2`, play.
4. Repeat with inline voice switches inside note lines (`[V:...]`) if present.

Expected:
- Voice IDs listed in the setting are muted in selection playback.
- Voice `1` mutes the de-facto first voice even if there is no explicit `V:1` line.
- Inline `[V:...]` switching is not guaranteed (best-effort limitation).

## PB-SEL-06 — Allow MIDI drums toggle (best-effort)

Goal: Verify opt-in behavior for keeping `%%MIDI drum*` directives in selection playback.

Steps:
1. Use a tune with `%%MIDI drum*`.
2. Select a short drum-active range.
3. Set `Selection: allow MIDI drums` OFF, play.
4. Set `Selection: allow MIDI drums` ON, play again.

Expected:
- OFF: selection playback suppresses drum directives for stability.
- ON: selection playback attempts to keep drum directives (best-effort), which may behave inconsistently on short ranges/repeats.
