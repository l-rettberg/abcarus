# Module Boundary Audit

Date: 2026-07-03
Branch: `renderer-modularization`
Status: Boundary audit after initial renderer extractions

## Why This Exists

The first modularization phase reduced `src/renderer/renderer.js`, but the result is uneven. Some changes created real component boundaries. Others only moved helper code while leaving state, UI orchestration, event listeners, and feature lifecycle in `renderer.js`.

That is not sufficient for the long-term goal. A feature is not meaningfully modularized if future work still has to start by editing the renderer entry point.

This audit changes the success criterion from "line count went down" to "feature ownership moved."

## Boundary Standard

A feature extraction is considered complete only when:

- `renderer.js` does not own the feature's local state.
- `renderer.js` does not contain the feature's DOM rendering logic.
- `renderer.js` does not contain the feature's event listener graph, except for global menu routing.
- `renderer.js` does not contain the feature's domain model.
- The feature has a small public API, for example `open()`, `close()`, `toggle()`, `applySettings()`, `dispose()`.
- The feature can be feature-gated or disabled through one obvious host call.

Acceptable renderer responsibilities:

- Composition-root wiring.
- Passing stable dependencies into a feature factory.
- Global menu action routing.
- Shared editor/render/playback adapters.
- Calls that cross real feature boundaries, such as "save current tune before opening another file."

Unacceptable renderer responsibilities:

- Feature-local state bags.
- Modal/panel render methods.
- Feature-specific copy/export builders.
- Feature-specific parser/scanner internals.
- Feature-specific playback compatibility logic hidden inside generic playback functions.

## Current Status

| Area | Current status | Problem | Next action |
| --- | --- | --- | --- |
| App diagnostics/debug dump/layout/about/go-to-measure | Good | These are small app-level controllers/builders with clear ownership. | Leave as-is unless a specific issue appears. |
| Third-party boundary | Good | Policy and checks exist; no feature lifecycle issue. | Keep enforcing read-only third-party rule. |
| Templates | Partial | Controller/view/model exist, but insert/replace/append and file mutation orchestration still live in `renderer.js`. | Convert to a feature factory that receives file/editor adapters and owns modal commands. |
| Set List | Partial | Model/controller exist, but `renderer.js` owns state, persistence, print/export orchestration, and mutation helpers. | Move state+persistence+commands into `tools/set_list/set_list_feature.js`; renderer supplies tune/file/print adapters. |
| Print All | Partial | Options modal is modular, but the print-all flow remains renderer-owned. | Move print-all orchestration to `print/print_all_feature.js`; keep browser print host call in renderer if needed. |
| Source Link | Partial | Panel/controller/markup helpers exist, but renderer owns update flow and print integration. | Move source-link feature state/update into `tools/source_link/source_link_feature.js`. |
| Payload Mode | Partial | Controller/model/state object exist, but enter/exit/editor mutation/playback view orchestration remain in renderer. | Create a `payload_mode_feature` host object that owns enter/exit/view switching and receives editor/playback adapters. |
| MIDI input / note typing preview | Partial to poor | Popover controller exists, but state, Web MIDI handling, note preview, settings patching, and command handling remain in renderer. | Treat as one feature; move state and commands behind `createMidiInputFeature()`. |
| Drum/Gchord helpers and playback compatibility | Poor | Helper UI/model exists, but drum playback extraction/injection, mismatch state, diagnostics state, gchord injection, and preview remain in renderer. | Do not add more drum helpers until playback drum/gchord domain code moves into a dedicated feature/service. |
| Makam DNA | Partial | Store/controller are moved, but it is still tightly driven by Intonation Explorer and renderer callbacks. | Accept for now as a subcomponent; revisit after Intonation Explorer boundary is real. |
| Intonation Explorer | Poor | Model helpers moved, but panel state, scan pipeline, table/plot rendering, copy builders, Perde overlay, SVG score highlighting, event listeners, and lifecycle remain in renderer. | Move as a complete feature, not more helpers. |
| ChordPro | Poor | Parser model exists, but mode state, availability checks, full-view UI, PDF flow, and interaction with library/render/playback remain renderer-owned. | Later phase: move to `tools/chordpro/chordpro_feature.js` after print/playback boundaries are clearer. |
| Library move/X issues/errors popover | Mixed | Modal/popover controllers exist, but file/tune operations are necessarily tied to library/working-copy state. | Do not force plugin shape yet; first isolate library feature ownership. |

## Renderer Hotspots From Audit

These are the main feature-owned blocks still in `renderer.js`:

- Set List state and commands: around `setListItems`, storage, `renderSetListSvgMarkupForPrint`, `openSetList`, `buildSetListExportAbc`.
- Intonation Explorer: panel state around `intonationExplorer*`, scanner/render/refresh/show/hide/event listeners.
- MIDI input and note typing preview: `midiInput*`, `noteTypingPreview*`, Web MIDI handlers, settings patching.
- Drum/Gchord playback: legacy `V:DRUM` injection is removed; remaining scope is native abc2svg `%%MIDI drum*` helper UI, `injectGchordOn`, and `playDrumPreview`.
- Payload Mode commands: `setPayloadModeView`, `enterPayloadMode`, `exitPayloadMode`.
- Templates file integration: `insertSelectedTemplateFromModal`, `appendTuneTextToFileNow` usage, context menu hooks.
- ChordPro mode: `chordpro*` state and mode/render/playback interactions.

## Large Files Outside Renderer

Not every feature-specific line outside `renderer.js` is bad.

- `src/renderer/index.html` is the current static DOM contract. Feature markup lives there today. Moving markup is optional and lower priority than moving state/lifecycle.
- `src/renderer/style.css` contains feature styles. This is a large file, but CSS modularization should follow JS ownership, not lead it.
- `src/main/menu.js` should keep menu action strings. This is an app boundary, not feature logic.
- `src/preload.js` should keep IPC exposure. This is also a boundary file, not a feature module.
- `src/main/ipc.js` has ChordPro/template IPC handlers. Those are main-process service boundaries and should be audited separately before moving.

## Revised Work Rule

Do not continue moving isolated helpers from `renderer.js` unless they are part of a specific component boundary plan.

For each feature, use this sequence:

1. Name the feature owner directory.
2. Identify renderer-owned state, commands, view functions, event listeners, and domain helpers.
3. Create one public feature factory or controller.
4. Move state and lifecycle first, not just pure helpers.
5. Leave renderer with host adapters and global command routing only.
6. Run checks and require a manual verification list for that feature.

## Recommended Repair Order

1. **Set List**
   Best repair candidate. It is self-contained, already has model/controller, and the renderer state/export/print commands can move without touching playback or core tune activation.

2. **MIDI input / note typing preview**
   Self-contained feature with clear settings and UI. Risk is moderate because it touches editor insertion and Web MIDI, but it can be moved behind explicit editor/audio/settings adapters.

3. **Payload Mode**
   Already partly structured. The remaining work is to move enter/exit/view orchestration behind the feature API.

4. **Templates**
   Move modal commands and file/editor integration into the feature, but keep actual safe file writes through renderer-provided adapters.

5. **Intonation Explorer**
   Needs one larger extraction, not helper-by-helper moves. Higher risk due to scan/highlight/render coupling.

6. **Drum/Gchord playback domain**
   Important, but high risk. Should be planned as a playback-domain service, not a helper UI cleanup.

7. **ChordPro**
   High coupling with render/playback/library/print. Leave until the simpler feature boundaries above are repaired.

## Stop Criteria

If a proposed extraction leaves most of the feature state and event graph in `renderer.js`, do not do it. Either widen the component boundary or defer the feature.
