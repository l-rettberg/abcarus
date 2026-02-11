# MIDI<->ABC Microtones in abc2svg (Implementation Notes)

This document captures the current understanding of how microtones work in
`third_party/abc2svg`, with emphasis on:

- score parsing and rendering,
- `abc2mid` generation,
- practical constraints for a future `MIDI -> ABC` converter in ABCarus.

The goal is to avoid re-discovery in future branches/chats.

## Scope and guardrails

- ABCarus **does not patch** files inside `third_party/abc2svg/`.
- Any converter/import logic must live in our own code/lab area.
- `%%MIDI gchord` / `%%MIDI drum` reconstruction from generic MIDI is out of
  scope (macro semantics cannot be recovered reliably from explicit MIDI notes).

See also: `kitchen/midi2abc-lab/POLICY.md`.

## End-to-end microtone path in abc2svg

## 1) Parse layer: accidental representation

In `third_party/abc2svg/core/parse.js`:

- `parse_acc_pit()` parses accidental + pitch.
- Regular accidentals are numeric (`-2..2`, natural `3`).
- Microtonal accidentals are represented as an object-like fraction `[num, den]`
  (JavaScript array), e.g. shorthand forms after `^` / `_`.

Key places:

- `parse_acc_pit` (`core/parse.js`)
- `nt_trans` (`core/parse.js`) handles transposition when accidental is
  microtonal (`typeof a == "object"`).

## 2) Pitch-to-MIDI mapping (fractional keys)

In `pit2mid()` (`third_party/abc2svg/core/parse.js`):

- output is a MIDI key with optional fractional part (cents),
- microtones are converted using:
  - explicit accidental fractions,
  - `cfmt.temper` (temperament table),
  - optional equal temperament path (`cfmt.nedo`).

Important implication: internal playback/generation keeps microtonal detail as
fractional semitone pitch, not only as textual accidental.

## 3) Rendering path (staff glyphs)

Microtonal accidentals are rendered natively:

- Glyph table in `third_party/abc2svg/core/svg.js` includes:
  - `acc-1_2` (quarter-tone flat),
  - `acc-3_2` (three-quarter flat),
  - `acc1_2` (quarter-tone sharp),
  - `acc3_2` (three-quarter sharp).
- Accidental drawing in `third_party/abc2svg/core/draw.js` has an explicit
  microtone branch (`typeof a == "object"`), converts fractions, then maps to
  `acc...` glyph ids.

Result: score display and playback share the same microtonal intent from parse.

## 4) MIDI generation path (`abc2mid`)

In `third_party/abc2svg/midigen.js`:

- `note_run()` gets a key `k` that may include fractional cents,
- `dt = Math.round((k * 100) % 100)` extracts detune in cents,
- integer key is separated (`k |= 0`),
- `mutone()` sends MIDI Tuning Standard SysEx "note change" before note-on.

`mutone()` uses a cache (`det_tb`) to avoid sending unchanged detunes.

Practical reading: microtones are emitted via per-note tuning SysEx, not only
by nearest-semitone pitch bend tricks.

## 5) Runtime playback path (WebMIDI/audio bridge)

Related files:

- `third_party/abc2svg/util/sndmid.js`
- `third_party/abc2svg/util/tomidi5.js`
- bundled form in `third_party/abc2svg/snd-1.js`

They use the same idea: extract cents and emit tuning SysEx when available.
If SysEx is unavailable (`Midi5.ma.sysexEnabled == false`), microtone fidelity
is reduced (or skipped), depending on path/device.

## Temperament modules and special systems

## `%%temperament`

`third_party/abc2svg/modules/temper.js`:

- accepts 12 integer cent offsets,
- builds `cfmt.temper` mapping table.

## `%%MIDI temperamentequal <nedo>`

`third_party/abc2svg/modules/MIDI.js`:

- supports equal temperament systems by division count,
- includes special glyph setup when `nedo == 53` (Turkish accidentals path).

There is also a transpose guard path in core (`notransp` message:
"Cannot transpose with a temperament"), so temperament/transposition
interactions must be treated carefully in tool logic.

## What this means for ABCarus `MIDI -> ABC`

## Hard constraints

- From plain MIDI note stream alone, we often cannot recover:
  - original accidental spelling,
  - original microtonal notation style,
  - original temperament declaration intent.
- Round-trip `ABC -> MIDI -> ABC` is not identity for notation semantics.

## Recommended converter policy

- Preserve timing/pitch faithfully first.
- Reconstruct readable ABC spelling heuristically.
- Treat microtones as:
  - nearest notated accidental + optional cent/fraction annotation strategy,
  - optional `%%temperament` emission only when input carries robust tuning info.
- Do not attempt to infer `%%MIDI drum/gchord` macros from explicit MIDI notes.

## Suggested engineering checkpoints

1. Implement converter stages explicitly:
   - parse MIDI events,
   - quantize/segment voices,
   - derive pitch class + cent offset,
   - spell notes to ABC with documented heuristics.
2. Add "explainability" in output metadata:
   - log which notes were approximated,
   - log when temperament could not be inferred.
3. Keep a corpus of known difficult tunes (multi-voice, ornaments, microtones)
   and track regressions by metrics, not only visual spot checks.

## Current lab location

- `kitchen/midi2abc-lab/`
- batch helper: `kitchen/midi2abc-lab/run_roundtrip.mjs`

Lab outputs should remain in `kitchen/` and not be treated as production code.
