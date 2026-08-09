# Soundfonts

ABCarus uses a General MIDI `.sf2` soundfont for abc2svg playback.

## Bundled soundfont
- The repo bundles `third_party/sf2/TimGM6mb.sf2`.
- Default selection is controlled by settings (`soundfontName`).

## Optional local soundfonts
You can add additional soundfonts locally without committing them to the repo:
- Add the `.sf2` file path to settings (`soundfontPaths`).
- Select the active soundfont via `soundfontName`.

Settings are persisted in `abcarus-profile.json` (under `app.getPath("userData")` for installed builds; see `src/main/index.js`).

## Notes
- Not all soundfonts include good (or any) drum mappings. If drums seem missing, first verify the chosen soundfont supports drums.
- Known limitation: the current vendored abc2svg SF2 runtime can reject looped samples from otherwise valid external soundfonts. This may appear only with particular MIDI programs or notes because samples are initialized lazily. The bundled `TimGM6mb.sf2` is the supported fallback. This is tracked for a future abc2svg qualification or playback fallback improvement; copying the same SF2 into a temporary or app-managed folder does not resolve it.
