# ADR-0015 — Feature Ownership Boundaries

Date: 2026-07-03
Status: Proposed; extended by ADR-0017

Update 2026-07-16: ADR-0017 extends this feature-boundary rule into the active
renderer domain modularization contract. Keep using this ADR for the principle
that feature extraction means ownership extraction, but use ADR-0017 for
milestone process, tail classification, line-count health targets, performance
guardrails, and stop/rollback rules.

## Context

ABCarus is modularizing large renderer-side files, especially `src/renderer/renderer.js`.
Earlier refactoring moved several helpers and controllers into modules, but some feature
state and lifecycle logic remained in `renderer.js`. That reduces line count without
creating a durable module boundary.

The goal is not simply smaller files. The goal is feature ownership that is clear enough
that future work can happen in the feature module instead of returning to the renderer
entry point.

## Decision

Feature extraction is considered complete only when feature ownership moves, not only
when helper functions move.

A feature module should own:

- feature-local state,
- feature-local DOM rendering,
- feature-local DOM event listeners,
- feature-local commands and lifecycle,
- feature-specific persistence,
- feature-specific pure helpers unless they are genuinely shared.

`renderer.js` is the composition root. It may:

- create feature modules,
- pass explicit dependencies and host adapters,
- route global menu actions to public feature methods,
- fan out settings changes,
- provide shared editor/render/playback/file adapters,
- coordinate cross-feature transitions that are truly application-level.

`renderer.js` should not own:

- feature state bags such as `let setListItems = []`,
- private feature render methods such as `renderSetList()`,
- private feature event graphs,
- feature-specific scanners/export builders/injectors,
- large feature-specific workflows hidden inside generic renderer functions.

## Dependency Classification

Before extracting a feature, classify its dependencies:

| Class | Rule |
| --- | --- |
| Feature-owned | Used by one feature; move into that feature. |
| Shared utility | Used by multiple features; move into a shared lower-level module. |
| Host adapter | Editor/current tune/file/render/playback/status bridge; passed into the feature. |
| Core domain | Library, working-copy, playback, render, save flows; modularize as core services, not as tool internals. |
| Static surface | HTML/CSS/menu/preload boundaries; can remain until a separate UI/resource split. |

## Public API Shape

Feature modules should expose a small public surface such as:

```js
const feature = createSomeFeature({
  elements,
  api,
  editor,
  files,
  render,
  showToast,
});

feature.open();
feature.close();
feature.applySettings(settings);
feature.dispose();
```

Avoid exporting many internal mutation helpers. If a future change to the feature must
start in `renderer.js`, the extraction is incomplete unless the change is a host-adapter
or global-routing change.

## Verification

Each feature extraction must include a tail audit:

```sh
rg -n "featurePrefix|Feature Name" src/renderer/renderer.js
```

Remaining matches must be classified as:

- `OK wiring`,
- `OK host adapter`,
- `OK global menu/settings routing`,
- `BAD state`,
- `BAD private function`,
- `BAD listener graph`,
- `BAD domain logic`.

If many `BAD` matches remain, do not call the extraction complete.

## Consequences

Positive:

- New agents have a clearer destination for feature changes.
- Optional tools become easier to gate or disable.
- `renderer.js` remains an app shell instead of a feature bucket.

Trade-offs:

- Some moves must be larger than pure helper extraction.
- Feature factories need explicit dependency objects.
- A few host adapters may temporarily be verbose while core services are still being
  modularized.

## Migration Rule

Do not continue extracting isolated helpers unless they are part of a named feature
boundary plan. Prefer completing one feature boundary over spreading partial extractions
across many features.
