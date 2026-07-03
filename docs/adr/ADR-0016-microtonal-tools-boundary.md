# ADR-0016 — Microtonal Tools Boundary

Date: 2026-07-03
Status: Proposed

## Context

ABCarus supports a small but important set of microtonal workflows:

- EDO-53 / makam notation and practical transpose behavior,
- Perde lookup and ABC-to-Perde naming,
- Makam DNA data and editing,
- Intonation Explorer analysis, overlays, pitch sets, and seyir/DNA summaries,
- makam candidate suggestions and key-signature associations.

These workflows are important for specialized users, but they are not needed by most
users who edit ordinary EDO-12 ABC. Historically this code grew through `renderer.js`
and adjacent modules under names such as "Makam Tools" or "Intonation Explorer". That
name is too narrow: the real boundary is the whole microtonal notation domain.

## Decision

Introduce one user-facing umbrella:

**Support microtonal notation**

This is the canonical setting and feature boundary for all makam/perde/EDO-53/
microtonal tooling. Existing settings keys such as `makamToolsEnabled` and
`studyToolsEnabled` are legacy aliases and must continue to be read for backwards
compatibility.

When the umbrella setting is OFF:

- specialized microtonal tools are hidden or blocked,
- Intonation Explorer and Makam DNA UI must not open,
- makam/perde datasets should not load eagerly for UI-only features,
- core EDO-12 editing should remain simple and stable.

When it is ON:

- Microtonal/Makam tools are exposed,
- Intonation Explorer and Makam DNA are available,
- Perde and makam datasets may be lazy-loaded,
- microtonal helper UI and analysis features may run.

The app remains tolerant when the setting is OFF. Opening a file that already contains
microtonal notation must not corrupt or reject the file. Core parsing/render/playback
paths should continue to read what is present. The setting gates specialized tooling,
not basic file tolerance.

## Module Boundary

Use a microtonal domain boundary:

- `src/renderer/microtonal/` for shared domain logic, datasets, and services.
- `src/renderer/tools/microtonal/` or focused submodules for UI feature glue.

`renderer.js` may keep only host adapters and global routing:

- menu/settings gate,
- current editor text/selection,
- working-copy snapshot,
- rendered SVG offset mapping and highlight adapters,
- status/toast/log callbacks.

`renderer.js` must not own:

- `intonationExplorer*` state,
- Makam DNA store/controller lifecycle,
- Perde lazy-loading/index state,
- makam candidate UI rendering,
- seyir/DNA/pitch-set builders,
- microtonal scanner/plot/table/event-listener graphs.

## Relationship to Existing ADRs

- Supersedes the narrower "Makam Tools" term in ADR-0012.
- Extends ADR-0015 feature ownership: microtonal features should be plugin-like and
  self-contained, not split into many renderer-owned fragments.
- Keeps ADR-0014 practical microtonal transpose as domain behavior under the same
  umbrella, even when some transpose code remains shared command/domain code rather
  than UI-only tooling.

## Verification

- Default settings keep `supportMicrotonalNotation` OFF.
- Legacy settings with `makamToolsEnabled` or `studyToolsEnabled` ON enable the new
  canonical setting.
- Disabling the setting hides/blocks Intonation Explorer and closes open microtonal UI.
- Tail audit:

```sh
rg -n "intonationExplorer|makamDna|perde|supportMicrotonal|makamToolsEnabled|studyToolsEnabled" src/renderer/renderer.js
```

Remaining renderer matches must be menu/settings routing or host adapters only.
