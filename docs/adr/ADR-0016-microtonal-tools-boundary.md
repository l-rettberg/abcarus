# ADR-0016 — Microtonal Tools Boundary

Date: 2026-07-03
Status: Accepted

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

`renderer.js` may keep only construction of `microtonalDomain`, host adapters,
the editor extension reference, and global routing:

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

Remaining renderer matches must be the `microtonalDomain` import/construction,
its editor extension, menu/settings routing, or host adapters only. Direct
construction of Intonation Explorer, Makam DNA, Perde, and their DOM references
is forbidden by `test:renderer-boundaries`.

## Known Concerns: Intonation Explorer

Intonation Explorer should be treated as a specialized analysis tool, not as a
musically verified makam detector. The current candidate ranking is heuristic: it
scores pitch-class weight, final note, phrase endings, güçlü/yeden activity, common
`K:` signatures, and coarse seyir signals. This can produce useful suggestions, but
it can also rank unexpected makams above the makam a user intentionally selected for
comparison.

Future work should separate these two workflows in the UI and code:

- **Inspect selected makam**: show the declared/overlay makam against the selected
  tonal base, with transposed durak/güçlü/yeden roles and clear evidence.
- **Guess makam from tune**: present ranked candidates as heuristic hypotheses, with
  confidence labels that do not overstate certainty.

Specific follow-up items:

- keep selected `Declared makam` and `Compare to` entries visible even when they fall
  outside the top candidate limit;
- make candidate evidence easier to read and explain why a makam ranked above or
  below another;
- audit tonal base / durak handling, especially manual bases such as `E` in EDO-53
  contexts;
- review whether confidence labels such as `Strong` and `Likely` are too assertive
  for the present scoring model;
- build a small regression corpus of known Uşşak, Beyati, Hüseyni, Rast, Hicaz, and
  related tunes, with expected display behavior and candidate sanity checks;
- keep Intonation Explorer plugin-like under the `supportMicrotonalNotation` umbrella
  so this experimental complexity does not leak into ordinary EDO-12 editing.
