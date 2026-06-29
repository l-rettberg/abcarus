# Renderer Modularization Roadmap

Date: 2026-06-28
Status: Proposed inventory and execution plan
Branch: `renderer-modularization`

## Goal

Reduce the size and blast radius of `src/renderer/renderer.js` by extracting coherent renderer components one at a time, without a big-bang rewrite and without changing user behavior as part of move-only work.

The current renderer entry point is about 32k lines and owns too many unrelated concerns:
- CodeMirror setup and editor helpers.
- Main DOM references and global UI state.
- render/playback payload construction and abc2svg integration.
- playback transport, follow/highlight/autoscroll, A-B/focus/selection playback.
- working-copy sync/save flows.
- library tree, tune selection, context menu, file/tune actions.
- source link, YouTube preview, QR/print markup.
- error scanning, popover, score/editor error highlights.
- optional tools such as Intonation Explorer, Makam DNA, Payload Mode, Templates, Set List, Drum Helper, MIDI input.
- import/export flows and debug dump assembly.

The objective is not to replace all of this with a framework. The objective is to make boundaries explicit enough that future changes can land in small, reviewable slices.

`renderer.js` should remain the renderer composition root. A good final shape is allowed to keep startup sequencing, module initialization, callback wiring, and cross-feature orchestration in the entry point. The success criterion is not "delete `renderer.js`"; it is "remove feature/domain logic from the entry point and make ownership auditable."

## Non-Goals

- No broad renderer rewrite.
- No dependency injection framework.
- No UI redesign.
- No new runtime dependencies unless a specific extraction proves one is needed.
- No IPC channel renames and no menu action string renames.
- No direct disk I/O from tool modules. Renderer file operations continue through preload/main APIs and existing `src/renderer/io/file_ops.js` wrappers.
- No behavior changes hidden inside "move-only" commits.

## Existing Rails

This plan builds on:
- `docs/adr/ADR-0010-renderer-tool-modules-and-stability-rails.md`
- `docs/adr/ADR-0012-feature-gating-and-lazy-loading.md`
- `docs/roadmaps/20260305/rewrite-roadmap-core-engine.md`

Important constraints from those docs:
- Core open/save/working-copy/library/render/playback flows stay stable.
- Tool modules can move under `src/renderer/tools/<toolName>/...`.
- Optional tools should be gated and lazy-loaded where practical.
- Split move-only commits from behavior commits.
- Preserve tolerant-read / strict-write behavior and safe writes.

## Current Module Baseline

Already separate from `renderer.js`:
- `src/renderer/settings.js`, `src/renderer/settings_store.js`
- `src/renderer/library/store.js`
- `src/renderer/library/actions.js`
- `src/renderer/library/path_utils.js`
- `src/renderer/io/file_ops.js`
- `src/renderer/drums.js`
- `src/renderer/measures.mjs`
- `src/renderer/transpose.mjs`
- `src/renderer/abc_decorations_abc2svg.js`
- `src/renderer/note_preview/abc_note_parse.mjs`
- `src/renderer/audio/note_preview_audio.mjs`
- `src/renderer/makam_suggestion.mjs`
- `src/renderer/makam_dna/*.mjs`
- `src/renderer/perde*.mjs`
- `src/renderer/library_modal.js`

`src/renderer/index.html` already exposes stable DOM ids for most panels and modals. That makes DOM contract extraction possible without changing markup first.

## Proposed Directory Shape

Use boring, shallow folders:

```text
src/renderer/
  app/
    dom_refs.js
    renderer_state.js
    status.js
    startup.js
  editor/
    codemirror_setup.js
    abc_completion.js
    abc_hover.js
    abc_decorations.js
    search_shortcuts.js
    text_commands.js
  render/
    abc2svg_loader.js
    header_layers.js
    payload.js
    render_now.js
    source_offsets.js
  playback/
    payload.js
    sanitize.js
    transport.js
    follow_highlight.js
    focus_plan.js
    selection_ab.js
    soundfont.js
  library/
    tree_view.js
    sorting_filtering.js
    tune_selection.js
    context_menu.js
  files/
    working_copy_controller.js
    save_flows.js
    tune_file_ops.js
    import_export.js
  print/
    source_link_markup.js
    print_current.js
    print_all.js
    set_list.js
  diagnostics/
    errors.js
    debug_dump.js
    payload_mode.js
  tools/
    templates/
    intonation_explorer/
    makam_dna/
    midi_input/
    drum_helper/
    chordpro/
```

This is a target map, not a mandate to create every folder up front.

Create a target directory only when the first real module lands there. Do not pre-create empty folders or placeholder files. Some boundaries, such as Set List being `print/` versus `tools/`, should be proven by dependency inventory instead of predicted up front.

Avoid turning `app/dom_refs.js` or `app/renderer_state.js` into a renamed monolith. Shared DOM refs should cover only genuinely global elements, such as layout roots, status areas, and editor hosts. Feature-owned elements should either be grouped by feature, for example `playbackDom` or `libraryDom`, or collected by the feature module during `init()`.

Avoid a single broad renderer state store at the start. Prefer explicit callbacks and readers:

```js
initTemplates({
  getEditorView,
  insertText,
  showToast,
  api: window.api,
});
```

Only introduce a shared state owner after repeated call patterns prove that one component really owns that state.

## Ownership Checklist

Before moving a stateful component, write down:

| Question | Example |
| --- | --- |
| What does it read? | current editor text, active tune id |
| What does it mutate? | playback state, library selection |
| What does it own? | A-B markers, transport state, modal-local selection |
| What does it publish? | `onPlaybackStopped`, `onTuneActivated` |

Distinguish dependencies from ownership. For example, `playback/transport.js` may own transport state, while `playback/follow_highlight.js` should react to playback/render events and update highlights; it should not decide whether playback is active.

For high-risk areas, move complete transitions instead of loose helper clusters. Tune activation, raw mode entry/exit, save/save-as, working-copy conflict resolution, playback start/stop/restart, render success/failure, and close/quit flows should each preserve the transition from one consistent state to the next.

## Dependency Direction

Use one-way imports:

```text
pure helpers
    ^
feature modules
    ^
orchestrators
    ^
renderer.js
```

Rules:
- Pure helpers do not import DOM, `window.api`, or `renderer.js`.
- Render/playback payload helpers do not import DOM.
- Tool modules do not import the menu router.
- The menu router may call public commands exposed by feature modules.
- Feature modules should not reach sideways into unrelated features; use explicit callbacks/events from the composition root.
- If an import would point "up" toward `renderer.js`, keep that code in `renderer.js` until a cleaner boundary exists.

## Component Inventory

| Component | Current area in `renderer.js` | Proposed destination | Dependencies | Risk |
| --- | --- | --- | --- | --- |
| DOM refs | top-level `document.getElementById` block | `app/dom_refs.js` | `index.html` ids | Low, if kept as a plain object |
| Status/toast/hover/buffer UI | status helpers and unified status | `app/status.js` | DOM refs, current state readers | Medium, many call sites |
| Startup/perf/dev flags | startup status, perf logs, auto dumps | `app/startup.js`, `diagnostics/debug_dump.js` | `window.api`, debug globals | Medium |
| CodeMirror completions/hover | `buildAbcCompletionSource`, `buildAbcHoverTooltip` | `editor/abc_completion.js`, `editor/abc_hover.js` | CodeMirror imports, settings | Low |
| CodeMirror decorations | ABC decorations, measure/bar/payload/intonation decorations | `editor/abc_decorations.js`, later split by feature | CodeMirror `Decoration`, shared state | Medium |
| Editor commands/search | find/replace/goto, comment toggle, indent, line move | `editor/text_commands.js`, `editor/search_shortcuts.js` | `editorView`, CodeMirror APIs | Low to Medium |
| Layout/split panes | pane/sidebar/right split resizers | `app/layout.js` | DOM refs, settings persistence | Low to Medium |
| Source link and YouTube preview | `normalizeSourceUrl`, YouTube parsing, panel rendering | `tools/source_link/` or `print/source_link_markup.js` for print-only helpers | `parseAbcHeaderFields`, `window.api.openExternal`, DOM refs | Low |
| Library sorting/filtering | group/tune sort, filters, labels | `library/sorting_filtering.js` | library index, path utils | Low for pure helpers |
| Library tree rendering | `renderLibraryTree`, active marks, events | `library/tree_view.js` | DOM refs, context menu, tune selection | Medium |
| Tune selection/navigation | tune select, active tune metadata, raw mode selection | `library/tune_selection.js` | working copy, editor, render, state | High |
| Context menu | library/editor/templates context menu and tune actions | `library/context_menu.js` | many file/tune ops, set list, templates | High unless action callbacks are explicit |
| Working copy sync | snapshot refresh, tune/full sync, conflict paths | `files/working_copy_controller.js` | `window.api`, library sync, editor state | High |
| Save/new/open/close flows | save, save as, append, new tune/file, close/quit | `files/save_flows.js`, `files/tune_file_ops.js` | working copy, library, dialogs, state | High |
| Import/export | MusicXML, MIDI, ChordPro PDF, MIDI/MP3 export | `files/import_export.js` | `window.api`, transforms, playback/render payload | Medium to High |
| Raw mode | raw file editor mode and save flow | `files/raw_mode.js` | editor, active tune, save flow | High |
| ChordPro mode | ChordPro parse/select/full-view/PDF | `tools/chordpro/` | `window.api`, editor, library controls | Medium |
| Templates modal | templates state/load/select/insert | `tools/templates/` | editor insertion, file ops, settings/templates APIs | Medium |
| Set List | storage, modal rendering, drag/drop, export/print | `print/set_list.js` or `tools/set_list/` | localStorage/settings, print renderer, library tune text | Medium |
| Print current/all | current tune print, print-all modal/options, QR/source markup | `print/print_current.js`, `print/print_all.js`, `print/source_link_markup.js` | abc2svg render helper, settings, file cache | Medium |
| Error diagnostics | error model, popover, nav, active highlights, scan file | `diagnostics/errors.js` | render, library, editor/score highlights | High |
| Measure/bar analysis | meter/bar mismatch, gutter highlights | `diagnostics/bar_mismatch.js` | measures, render offsets, error diagnostics | Medium |
| Debug dump | debug log, recent actions, dump snapshot, auto dump | `diagnostics/debug_dump.js` | state readers across many subsystems | Medium |
| Payload Mode | diagnostics bar, render/playback payload views, read-only mode | `diagnostics/payload_mode.js` or `tools/payload_mode/` | render/playback payloads, editor read-only, settings gate | Medium |
| Render payload and abc2svg | header layers, offset maps, renderNow, module loading | `render/payload.js`, `render/abc2svg_loader.js`, `render/render_now.js` | abc2svg globals, editor, errors, drums | High |
| Header layers | global/user/file header merge and dedupe | `render/header_layers.js` | settings APIs, file reads | Medium |
| Playback sanitize/payload | repeat expansion, drum injection, lyric/chord stripping | `playback/sanitize.js`, `playback/payload.js` | drums, settings, header layers | High |
| Playback transport | player state, play/pause/stop/restart, soundfont | `playback/transport.js`, `playback/soundfont.js` | abc2svg/snd globals, UI state, settings | High |
| Follow/highlight/autoscroll | SVG/editor highlight and autoscroll | `playback/follow_highlight.js` | render offset maps, DOM refs | High |
| A-B / selection playback | A-B markers, scoped selection, voice mute options | `playback/selection_ab.js` | editor selection, playback plan, UI controls | Medium to High |
| Focus playback | focus mode UI, visible range, loop measure plan | `playback/focus_plan.js`, later pure planner | render SVG, playback state, settings | High |
| MIDI input and typing preview | Web MIDI input, note spelling, beep audio | `tools/midi_input/` | NotePreviewAudio, note parse helpers, settings | Medium |
| Drum Helper / MIDI drum conversion | drum edit models, `%%MIDI drum` parsing/injection | `tools/drum_helper/` plus `playback/drums_payload.js` | `drums.js`, playback sanitizer, editor popovers | Medium to High |
| Intonation Explorer | EDO-53 scan/table/plot/Makam candidates | `tools/intonation_explorer/` | makam/perde dynamic imports, working copy snapshot, SVG highlights | Medium |
| Makam DNA modal | edit/reset/save user makam DNA | `tools/makam_dna/` | `window.api`, makam DNA loaders | Medium |
| Menu action router | `wireMenuActions` | `app/menu_actions.js` | all high-level commands | High if moved too early |
| Settings hooks | `set*FromSettings` functions | keep near owning modules, with aggregator in `app/settings_apply.js` | settings controller, UI modules | Medium |

## Extraction Order

### Phase 0: Baseline Inventory and Guardrails

Deliverables:
- This roadmap.
- Keep branch separate from release branch work.
- Do not touch runtime code yet.

Exit gates:
- `npm run -s test:renderer-build`
- `npm run -s test:quick`

### Phase 1: Low-Coupling Helpers

Start with functions that can move without owning DOM or global mutable state.

Good candidates:
- Source URL parsing and YouTube URL helpers.
- ABC header parsing/name sanitization helpers.
- Library sorting/filtering pure helpers.
- Small localStorage JSON helpers if scoped to one feature.

Rules:
- Move only, export functions, update imports.
- Add or reuse harnesses where practical.
- No behavior edits in the same commit.
- Judge candidates on two axes: state coupling and semantic criticality. A pure helper can still be high-risk if it affects playback, save paths, or offset mapping.
- Do not move repeat expansion, save path normalization, or offset mapping as "easy pure helpers" unless the corresponding harness/manual gates are ready.

Suggested destinations:
- `src/renderer/source_link.js` or `src/renderer/tools/source_link/source_link.js`
- `src/renderer/library/sorting_filtering.js`
- `src/renderer/abc/header_fields.js`
- later, with playback gates: `src/renderer/playback/repeats.js`

Verification:
- `npm run -s test:renderer-build`
- targeted harness if touched area has one, then `npm run -s test:quick`

### Phase 2: DOM Ref and Small UI Services

Extract stable DOM ids and small UI helpers after pure moves have reduced noise.

Good candidates:
- grouped DOM refs for genuinely shared elements and feature-local refs for feature modules.
- simple status/toast/hover display functions if call sites can be updated cleanly.
- `app/layout.js` for pane resizers and persisted split settings.
- Generic draggable modal/tool-panel helpers.

Rules:
- Keep DOM ids unchanged.
- Avoid a global framework. A plain object and explicit function imports are enough.
- Do not move command behavior with DOM refs in the same commit.
- Do not create a smart cross-cutting `status` service early. Preserve current helper behavior first; only consolidate semantics after repeated usage proves the need.

Verification:
- renderer build check.
- manual smoke: launch app, resize panes, open/close common modals, check status/toast display.

### Phase 3: Independent Tools and Modals

Extract optional or mostly self-contained tools before core file/playback flows.

Good candidates:
- Templates modal.
- Source link / YouTube preview panel.
- ChordPro UI state.
- MIDI input and note typing preview.
- Makam DNA modal.
- Intonation Explorer.
- Payload Mode UI shell.
- Set List modal, after print helpers are separated.

Rules:
- Follow ADR-0010: module under `src/renderer/tools/<toolName>/`.
- Tool `init(...)` receives explicit callbacks/state readers instead of importing core mutable state directly.
- Follow ADR-0012 for optional tools: no top-level Makam/Payload dataset imports on default startup once extracted.
- Fail closed with toast/status if a lazy import fails.
- Prefer Templates before MIDI input unless dependency inventory proves otherwise. MIDI input crosses Web MIDI lifecycle, permissions, audio preview, note spelling, settings, popovers, and editor insertion; Templates is likely a smaller modal-controller extraction.

Verification:
- renderer build check.
- `npm run -s test:quick`.
- manual smoke for each extracted tool.
- for Makam/Payload: verify disabled settings gate still hides/blocks entry points and does not load tool code on startup where enforceable.

### Phase 4: Render and Print Boundaries

Split abc2svg loader, render payload construction, header layer composition, and print rendering.

Good candidates:
- `render/abc2svg_loader.js`
- `render/header_layers.js`
- `render/source_offsets.js`
- `print/print_current.js`
- `print/print_all.js`
- `print/set_list.js`

Rules:
- Keep `renderNow` orchestration in `renderer.js` until payload/header/error/score-highlight contracts are explicit.
- First extract pure payload/header functions, then move orchestration.
- Preserve offset-map compatibility for follow/highlight/playback.

Verification:
- `npm run -s test:renderer-build`
- `npm run -s test:abc2svg-playback`
- `npm run -s test:focus-playback`
- manual: render tunes with file header, global header, `%%sep`, source links, print current, print all, set list print/PDF.

### Phase 5: Playback Subsystems

Playback is high value but high risk. Do it after render payload boundaries are clearer.

Good candidates:
- soundfont loading/status.
- playback sanitizers and repeat expansion.
- transport UI state.
- follow/highlight/autoscroll.
- selection/A-B helpers.
- focus playback pure planner.

Rules:
- Prefer pure planner extraction before transport extraction.
- Keep old behavior as the default unless a focused change is explicitly planned.
- Add harness cases before changing range/focus/repeat semantics.
- Separate owners: transport owns playing/paused/waiting state; follow/highlight owns only visual response; focus/selection modules produce plans and options, not player lifecycle decisions.

Verification:
- `npm run -s test:focus-playback`
- `npm run -s test:abc2svg-playback`
- manual: play, pause/resume, stop, restart, loop selection, focus loop, follow/autoscroll, soundfont switch, MIDI drums.

### Phase 6: Working Copy, Save, and Library Actions

These are the most sensitive areas because they can corrupt user data if boundaries are wrong.

Good candidates after previous phases:
- working-copy snapshot/sync controller.
- file locks and save session model.
- simple tune save/save-as/new/open/close command grouping.
- tune copy/duplicate/move/delete/paste flows.
- library context menu as an action shell.

Rules:
- No direct disk I/O from UI modules.
- Preserve atomic replace and verification behavior in main/preload-backed paths.
- Do not weaken dirty/conflict checks.
- Test read-only, conflict, path-with-spaces, and non-ASCII paths when changing file operations.

Verification:
- `npm run -s test:fileops`
- `npm run -s test:quick`
- manual file-operation matrix from `AGENTS.md`.

### Phase 7: Menu Router and Renderer Entry Point

Move `wireMenuActions` only after major command handlers have explicit homes.

Target:
- `renderer.js` becomes a composition root that imports modules, initializes DOM/editor/settings, wires command handlers, and owns only unavoidable cross-cutting state.

Exit target:
- `renderer.js` below 8k-12k lines without hiding complexity in one giant "services" object.
- Each extracted module has a clear owner and a small public surface.

## Dependency Notes

Known dependency clusters:
- `render` and `playback` both depend on header prefix construction and source/render offset maps.
- `errors` depends on render success/failure, editor decorations, library error index, and score highlights.
- `working copy` depends on library index refresh, active tune identity, editor dirty state, and main-process APIs.
- `Intonation Explorer` depends on working-copy snapshot and score highlight helpers, but should not mutate files.
- `Drum Helper` has two faces: editor/UI helper for directives and playback payload sanitizer/injector.
- `Menu actions` should remain a late extraction because it touches nearly every feature.

## Risk Register

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Hidden behavior change during move-only extraction | Users rely on fragile editing/save/playback behavior | One component per commit, no formatting churn, run renderer build and focused harnesses |
| Circular imports | Existing globals make components interdependent | Pass callbacks/readers explicitly for the first extraction; only introduce shared state modules after repetition proves need |
| State split-brain | Active tune/current doc/working copy can diverge | Keep state ownership in `renderer.js` until a component owns a complete transition boundary |
| Accidental mega-state module | A global `renderer_state.js` can recreate the monolith in another file | Delay shared state; document reads/mutates/owns/publishes before extraction |
| Over-wide DOM refs | A single all-DOM object preserves monolithic coupling | Group refs by feature or collect feature refs in `init()` |
| Offset mapping regression | Follow, errors, playback, print all rely on source/render offsets | Move offset helpers with tests or keep them near render until parity is proven |
| Optional tool startup regressions | Makam/Payload code and data should not load by default | Lazy import optional tool modules after settings gate |
| Save/file corruption | File operations are high stakes | Delay file-flow extraction; preserve locks, conflict checks, verification, and IPC-backed writes |
| UI drift | Existing UI is compact and task-oriented | Move existing DOM behavior first; no redesign in modularization commits |
| Test blind spots | Automated coverage is uneven | Pair each extraction with the closest harness and a short manual smoke checklist |

## Commit Discipline

Use small commits with messages like:
- `docs: plan renderer modularization`
- `refactor(renderer): move source link helpers`
- `refactor(renderer): move library sort helpers`
- `refactor(renderer): move templates modal`

For each component:
1. Inventory function/state dependencies.
2. Record reads, mutations, owned state, and published events/callbacks.
3. Move only.
4. Run checks.
5. Commit.
6. Make behavior changes later in a separate commit if needed.

## Standard Verification Gates

Always run after any extraction:

```sh
npm run -s test:renderer-build
```

Run before committing most extraction slices:

```sh
npm run -s test:quick
```

Focused gates:
- Editor/CodeMirror: `npm run -s test:codemirror`
- Playback/focus: `npm run -s test:focus-playback`, `npm run -s test:abc2svg-playback`
- Settings hooks: `npm run -s test:settings`
- Measures/bar transforms: `npm run -s test:measures`
- Transpose: `npm run -s test:transpose`
- Note typing preview parsing: `npm run -s test:note-preview`
- File operations: `npm run -s test:fileops`

Manual smoke by area:
- Startup and recent file/folder load.
- New/open/save/save-as/close/quit dirty prompts.
- Library scan, search, sort, context menu actions.
- Render current tune, follow highlight, error popover.
- Play/pause/stop/restart, focus mode, loop selection.
- Print/export current, print all, set list.
- Templates insert/replace/append.
- MIDI input popover and typing preview.
- Makam Tools disabled by default, enabled tool opens, failed import does not break core.
- Payload Mode disabled by default, enabled mode is read-only and exits cleanly.

## First Practical Slices

Recommended first five implementation slices:

1. Move only source URL/YouTube pure helpers: URL normalization, YouTube id parsing, embed URL construction, and search URL construction if it can accept parsed title/composer as inputs.
2. Move ABC header field helpers: parse title/composer/key/source fields, plus filename sanitization only if it remains policy-free.
3. Move library sorting/filtering pure helpers: comparators, labels, and filter predicates, without tree rendering or active selection.
4. Review the first three moves before choosing the next target: check for circular imports, argument count, global reads, and testability.
5. Move draggable modal/tool-panel helpers or Templates modal, depending on the dependency inventory. Prefer Templates over MIDI input unless the inventory shows Templates has hidden coupling.

Do not start with:
- working-copy save flows,
- renderNow,
- playback transport,
- menu router,
- tune selection core.

Those become much safer after the smaller modules expose the real dependency shape.
