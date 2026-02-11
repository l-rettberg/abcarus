# MIDI <-> ABC Microtones (User Notes)

This note explains practical expectations for microtones when using MIDI import
and playback in ABCarus.

## What works

- Microtonal accidentals can be displayed and played.
- Playback can preserve non-equal pitch detail when the playback path supports
  tuning messages (SysEx).
- Equal-temperament and temperament-related ABC directives are supported by the
  bundled notation/playback engine.

## Practical limits of MIDI -> ABC

From a plain MIDI file, some notation intent cannot be recovered reliably:

- exact accidental spelling chosen by the editor,
- original microtonal notation style,
- explicit temperament declarations used in the source ABC.

Because of this, roundtrip `ABC -> MIDI -> ABC` is usually musically close, but
not text-identical.

## How ABCarus treats conversion quality

- Priority is musical fidelity first (timing, pitch, voice flow).
- ABC spelling is reconstructed with heuristics for readability.
- Macro-style ABC directives are not inferred from generic MIDI note streams:
  - `%%MIDI gchord`
  - `%%MIDI drum`

## What users should expect

- Simple tonal material usually converts cleanly.
- Complex microtonal pieces may need manual cleanup after import.
- If your workflow depends on exact symbolic spelling, keep the original ABC as
  the canonical source and treat imported ABC as an editable draft.
