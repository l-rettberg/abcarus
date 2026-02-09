<p align="center">
  <img src="assets/icons/abcarus_96.png" width="96" height="96" alt="ABCarus logo" />
</p>
<h1 align="center">ABCarus</h1>

ABCarus is a desktop application for working with music encoded in ABC notation.

ABCarus is designed for navigating, editing, rendering, and organizing large collections of `.abc` files. It treats each tune (from `X:` to the next `X:`) as an independent unit, which supports archival workflows and large libraries.

## Status

Early-stage release. The app is actively developed; some workflows and UI details may still change. Keep backups of your data.

See [docs/DISCLAIMER.md](docs/DISCLAIMER.md) and [CHANGELOG.md](CHANGELOG.md).

## Downloads (latest)

- Release page: [GitHub Releases][releases-latest]
- Linux: [AppImage][dl-linux-appimage] · [Portable (AppDir tar.gz)][dl-linux-portable] · [SHA256][sha-linux]
- Windows: [Setup][dl-win-setup] · [Portable (.exe)][dl-win-portable] · [Portable (win-unpacked zip)][dl-win-unpacked] · [SHA256][sha-windows]
- macOS (experimental): [DMG (arm64)][dl-mac-arm64] · [DMG (x64)][dl-mac-x64] · [SHA256 (arm64)][sha-mac-arm64] · [SHA256 (x64)][sha-mac-x64]

macOS note: builds are currently not notarized. On some macOS versions, Gatekeeper may report the app as “damaged” and refuse to open it.
After verifying the SHA256 sums, you can remove the quarantine attribute:
`xattr -dr com.apple.quarantine /Applications/ABCarus.app`.

[releases-latest]: https://github.com/topchyan/abcarus/releases/latest

[dl-linux-appimage]: https://github.com/topchyan/abcarus/releases/latest/download/ABCarus-x86_64.AppImage
[dl-linux-portable]: https://github.com/topchyan/abcarus/releases/latest/download/ABCarus-x86_64-portable.tar.gz
[sha-linux]: https://github.com/topchyan/abcarus/releases/latest/download/SHA256SUMS-linux.txt

[dl-win-setup]: https://github.com/topchyan/abcarus/releases/latest/download/ABCarus-setup-x64.exe
[dl-win-portable]: https://github.com/topchyan/abcarus/releases/latest/download/ABCarus-portable-x64.exe
[dl-win-unpacked]: https://github.com/topchyan/abcarus/releases/latest/download/ABCarus-win-unpacked-x64.zip
[sha-windows]: https://github.com/topchyan/abcarus/releases/latest/download/SHA256SUMS-windows.txt

[dl-mac-arm64]: https://github.com/topchyan/abcarus/releases/latest/download/ABCarus-macos-arm64.dmg
[dl-mac-x64]: https://github.com/topchyan/abcarus/releases/latest/download/ABCarus-macos-x64.dmg
[sha-mac-arm64]: https://github.com/topchyan/abcarus/releases/latest/download/SHA256SUMS-macos-arm64.txt
[sha-mac-x64]: https://github.com/topchyan/abcarus/releases/latest/download/SHA256SUMS-macos-x64.txt

## Quick install (end users)

Use a release build from GitHub Releases (recommended for normal use).

- Linux: download the AppImage, make it executable, run it.
- Windows: download Setup (`ABCarus-setup-x64.exe`) or Portable (`ABCarus-portable-x64.exe`), then launch.
- macOS: download the DMG for your CPU (arm64/x64), install, then launch.

Release builds already bundle everything needed for normal use, including the Python runtime used by MusicXML import/export.

## Documentation

For users:
- User Guide (how to use ABCarus): [docs/USER_GUIDE.md](docs/USER_GUIDE.md)

For contributors:
- Quick workflow (dev + release): [WORKFLOW.md](WORKFLOW.md)
- Developer documentation index: [docs/README.md](docs/README.md)
- Detailed release checklist: [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md)
- Product + engineering invariants: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)
- Methodology (chat-driven, docs-backed): [docs/METHODOLOGY.md](docs/METHODOLOGY.md)

## Quick workflow

See [WORKFLOW.md](WORKFLOW.md) for:
- 3–5-command release flow (version → tag → push → verify)
- What we commit / keep local (e.g. `scripts/local/**`)
- Useful debug env vars (e.g. `ABCARUS_DEBUG_KEYS=1`)
- Fast local checks: `npm run test:quick` and `npm run test:ui-smoke`

## Quick start (development)

### Development setup
- Requirements: Node.js (LTS) and npm
- Install dependencies: `npm install`
- Run the app: `npm start`

Python is not required for basic editing/rendering/playback in development. It is only needed for MusicXML import/export.
For import/export in development, install PBS runtime for your current OS:
- Linux/macOS: `bash devtools/pbs/pbs-install-all.sh`
- Windows: `pwsh -ExecutionPolicy Bypass -File devtools/pbs/pbs-install-all.ps1`

### Soundfonts
ABCarus ships only one bundled soundfont (`TimGM6mb.sf2`). Additional soundfonts are optional and installed locally. See [docs/soundfonts.md](docs/soundfonts.md).

### Notation fonts (SMuFL)
ABCarus ships several bundled notation/text fonts (SIL OFL 1.1) for abc2svg rendering. See [docs/notation-fonts.md](docs/notation-fonts.md) and [NOTICE.md](NOTICE.md).

### Release builds
Release builds bundle a local Python runtime (PBS) for MusicXML import/export. See [docs/python-build-standalone.md](docs/python-build-standalone.md) and [docs/python-runtime.md](docs/python-runtime.md).

### Core features

- Recursive scanning of folders containing `.abc` files
- File + tune navigation (tunes are separated by `X:` headers)
- Text-first editing of ABC
- Notation rendering
- Print/export PDF for single tunes or full files
- Playback for editing/reference (including Focus/selection controls and soundfont-based output)
- Error scanning and grouped diagnostics

## Design goals

- Text-first workflow
- Predictable, reproducible behavior
- Minimal abstractions over the ABC format
- Suitability for large libraries
- Long-term maintainability

Playback and rendering are implemented to support reading and editing, not to replace musical interpretation.

### Rendering notes

- `%%sep` can trigger abc2svg errors in some scores. ABCarus first tries normal rendering; if that fails and `%%sep` is present, it retries with a length-safe `%%sep` fallback and shows a warning.
- Printing/exporting all tunes includes error summaries and inline error cards for tunes that fail to render.

### Versioning & Releases

- SemVer is used, with `package.json` as the source of truth.
- Releases are tagged `vX.Y.Z` and documented in [CHANGELOG.md](CHANGELOG.md).
- See [docs/VERSIONING.md](docs/VERSIONING.md) and [docs/RELEASES.md](docs/RELEASES.md).

### Technology

- Electron
- JavaScript
- ABC notation
- abc2svg (rendering and basic playback)

### Import/Export prerequisites

Import/Export uses external Python converters stored under `third_party/`:

- `third_party/abc2xml/abc2xml.py` (ABC → MusicXML)
- `third_party/xml2abc/xml2abc.py` (MusicXML → ABC)

By default, ABCarus prefers a bundled Python runtime (PBS). In development, install PBS with:

- Linux/macOS: `bash devtools/pbs/pbs-install-all.sh`
- Windows: `pwsh -ExecutionPolicy Bypass -File devtools/pbs/pbs-install-all.ps1`

System Python fallback is opt-in only via `ABCARUS_ALLOW_SYSTEM_PYTHON=1`.

### Platforms

- Linux, Windows, macOS (release builds provided; Linux is the primary development platform)

### Credits

Major third-party components used by ABCarus:

- abc2svg — https://chiselapp.com/user/moinejf/repository/abc2svg/doc/trunk/README.md
- abc2xml — https://wim.vree.org/svgParse/abc2xml.html
- xml2abc — https://wim.vree.org/svgParse/xml2abc.html
- CodeMirror — https://codemirror.net/
- Tabulator — https://tabulator.info/
- Electron — https://www.electronjs.org/
- Node.js — https://nodejs.org/
- Python — https://www.python.org/
- TimGM6mb.sf2 (soundfont) — https://timbrechbill.com/saxguru/

See [NOTICE.md](NOTICE.md) for licenses and attribution details.

### Inspiration

| Name | Project(s) | Why it matters to ABCarus | Link |
|---|---|---|---|
| Chris Walshaw | ABC notation | Where ABC comes from and where the spec lives | https://abcnotation.com/ |
| Jean‑François Moine | abc2svg, txtmus, abcm2ps | The rendering engine we build on (abc2svg) and a lot of ABC craft around it | http://moinejf.free.fr/ |
| Seymour Shlien | EasyABC, runabc, midiexplorer | A long-running desktop editor that shaped many real-world workflows | https://ifdo.ca/~seymour/runabc/top.html |
| James Allwright | abcMIDI | The classic ABC→MIDI toolbox many people still rely on | https://abcmidi.sourceforge.io/ |
| Michael Eskin | ABC Transcription Tools | A huge set of practical online helpers for everyday ABC work | https://michaeleskin.com/abctools/abctools.html |
| Paul Rosen | abcjs | One of the most common ABC renderers on the web | https://www.abcjs.net/ |
| Johan Vromans | ChordPro | A strong song/chords world that overlaps with ABC use cases | https://www.chordpro.org/ |
| Willem Vree | abc2xml, xml2abc | The MusicXML bridge (ABC ↔ MusicXML) | https://wim.vree.org/ |
| Sergio Di Mico | AbcToSheet | Another take on turning ABC into sheet music | https://abctosheet.my.to/ |
| Benoît Rouits | qabc, redrose | Small, sharp ABC projects worth studying | https://github.com/be1 |
| MTG | SymbTr | Research angle on symbolic music data | https://github.com/MTG/symbtr |

### Personal acknowledgements

These are personal sources of inspiration and gratitude, separate from the technical projects above:

- [Houshamadyan](https://www.houshamadyan.org/home.html) — a project to reconstruct Ottoman Armenian town and village life.
- [Ara Dinkjian](https://www.aradinkjian.com/) — composer, musician, and oud teacher.
- [Corpus Musicae Ottomanicae](https://corpus-musicae-ottomanicae.de/content/index.xml) — critical edition of Near Eastern music manuscripts.
- My Lord and Savior Yeshua

### Licensing

ABCarus source code is licensed under the MIT License.

This project uses third-party components, including abc2svg (LGPL) and CodeMirror (MIT).
See [NOTICE.md](NOTICE.md) for details.
