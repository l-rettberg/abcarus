# Renderer Modularization Final Audit

Date: 2026-07-29

Branch: `renderer-modularization`

Baseline: approximately 32,000 lines in `src/renderer/renderer.js`

Audited state: 4,262 physical lines in `src/renderer/renderer.js`

## Result

The renderer modularization acceptance criteria in ADR-0017 are met.

`renderer.js` now acts primarily as the renderer composition root:

- imports concrete controllers, features, and domain facades;
- collects DOM references;
- constructs domains and supplies explicit host adapters;
- wires cross-domain callbacks and startup order;
- retains only unavoidable orchestration where two or more domains meet.

Further line-count reduction is not a goal by itself. Moving constructor
arguments, DOM references, or short initialization-order adapters into an
arbitrary bootstrap file would hide the composition root rather than improve
ownership.

## Domain Status

| Domain | Primary owner | Renderer tail classification | Status |
| --- | --- | --- | --- |
| Library | `src/renderer/library/` and `library_ui_domain.js` / `library_crud_domain.js` | DOM inputs, facade construction, command callbacks | Complete |
| Document, file, save, working copy | `src/renderer/app/document/` | Controller construction and explicit cross-domain adapters | Complete |
| Render | `src/renderer/render/` | Pipeline construction, DOM output target, callbacks into errors/playback | Complete |
| Playback, Focus, Follow | `src/renderer/playback/` and `playback_domain.js` | Controller construction and transport/UI wiring | Complete |
| Editor and errors | `src/renderer/editor/` | Editor host construction and callbacks into render/library | Complete |
| Settings and app commands | `src/renderer/app/ui/` and `src/renderer/app/commands/` | DOM element map and facade wiring | Complete |
| Microtonal tools | `src/renderer/microtonal/` and `src/renderer/tools/` | Feature construction and Settings gate callbacks | Complete |
| Print, Set List, import/export | `src/renderer/print/` and `src/renderer/tools/` | Command dispatch and shared file/render adapters | Complete |
| Templates, Drum/GChord, MIDI input, ChordPro, Raw, Payload | respective `src/renderer/tools/` folders | Feature construction and global command routing | Complete |
| Diagnostics and status UI | `src/renderer/app/diagnostics/` and `src/renderer/app/ui/` | Startup calls and status callback wiring | Complete |

## Tail Classification

The final domain searches still find names such as `selectTune`,
`performSaveFlow`, `renderPayload`, `focusMode`, and `intonationExplorer`.
Those matches are expected and fall into these categories:

- **Expected app-shell wiring:** DOM references and feature construction.
- **Expected facade calls:** menu commands call public domain methods.
- **Accepted orchestration:** render completion feeds errors/highlights;
  document selection feeds render and library state; Settings feeds optional
  feature gates.
- **Initialization-order adapters:** short named callbacks allow controllers
  created earlier to call controllers attached later. They contain no domain
  algorithm or independently owned state.

No unexpected library, document/save, render, playback, errors, or microtonal
algorithm was found in `renderer.js`.

## State Ownership

The large mutable state clusters have explicit owners:

- active tune/file identity: `active_tune_context_store.js`;
- current document and dirty state: document controllers;
- working-copy snapshot/conflict/sync: working-copy controllers;
- library index/visibility: `library_runtime_store.js`;
- settings snapshot: `settings_snapshot_store.js`;
- playback transport/follow/range state: playback domain/controllers;
- render state and payload: render runtime/controllers;
- editor view and editor-local state: editor runtime/controllers.

`renderer.js` keeps references to constructed controllers and features. Those
references are composition-root dependencies, not duplicate domain state.

## Guardrails

`test:renderer-boundaries` now enforces:

1. `renderer.js` remains at or below 5,000 lines.
2. No new JavaScript module under `src/renderer/` exceeds 2,000 lines.
3. Previously extracted state and algorithms cannot return through the known
   forbidden patterns.
4. Core domain facades remain present in the composition root.

The 5,000-line ceiling is intentionally above the current 4,262 lines. It
allows honest wiring changes while preventing a return to unbounded growth.
The 2,000-line module ceiling prevents solving the problem by moving the old
monolith into a differently named file. The existing
`src/renderer/transpose.mjs` is the sole legacy exception at 2,568 lines and is
capped at that exact size, so it cannot grow without an explicit guardrail
decision.

## Remaining Work

No further renderer extraction is required to satisfy ADR-0017.

Future work should be ordinary maintenance:

- consider a separate, behavior-preserving decomposition of the legacy
  `transpose.mjs` module; it is not a remaining `renderer.js` tail;
- split a domain-internal file only when its cohesion or testability warrants
  it;
- remove a composition-root adapter when initialization order naturally allows
  a direct facade method;
- add new behavior inside its owning domain, not in `renderer.js`;
- treat performance or user-data regressions as defects, independently of
  modularization.

Any proposed new extraction must identify actual domain logic still owned by
`renderer.js`. A line-count-only proposal should be rejected.
