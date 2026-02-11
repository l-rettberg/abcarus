# midi2xml (ABCarus wrapper)

Small Python wrapper used by ABCarus for MIDI import via:

`MIDI -> MusicXML (midi2xml) -> ABC (xml2abc)`

## Runtime dependency

- `music21` (installed into bundled PBS runtime from `requirements.txt`)

## Usage

```bash
python3 third_party/midi2xml/midi2xml.py input.mid output.musicxml
```

Optional:

```bash
python3 third_party/midi2xml/midi2xml.py input.mid output.musicxml --quarter-divisors 4,6
```

Version:

```bash
python3 third_party/midi2xml/midi2xml.py --version
```

## Upgrade policy

- Keep this wrapper minimal and stable.
- Upgrade parser behavior by bumping `music21` version in `requirements.txt`.
- Keep conversion pipeline wiring in `src/main/conversion/` only (no direct edits to external tools).
