ADR-0017 — Renderer Domain Modularization Contract

Date: 2026-07-16
Status: Proposed

## Context

`src/renderer/renderer.js` has historically carried too much responsibility:
application bootstrap, DOM wiring, file/library workflows, render preparation,
playback coordination, diagnostics, optional tools, modal internals, and many
feature-specific helpers.

During the `renderer-modularization` branch, the file has already been reduced
substantially, but the remaining work must avoid two failure modes:

- extracting isolated functions while leaving feature-specific tails in
  `renderer.js`;
- replacing one large renderer file with new domain monoliths or vague facades.

The purpose of the remaining work is not to make `renderer.js` small at any
cost. The goal is a clear ownership model:

```text
renderer.js = app shell / bootstrap / feature construction / callback wiring / unavoidable orchestration
domain modules = feature-specific logic, state transitions, internal helpers
```

This ADR turns that refactoring contract into a project rule.

## Decision

### 1) Modularize by domain ownership, not by line-count alone

The preferred long-term shape is:

```js
const documentFeature = initDocumentFeature({
  getEditorText,
  getActiveTune,
  showStatus,
  showToast,
  api: window.api,
});

documentFeature.save();
documentFeature.saveAs();
documentFeature.newFile();
```

Avoid module APIs that recreate global mutable access:

```js
export {
  setState,
  getState,
  mutateThing,
  updateButtons,
  runInternalStep1,
  runInternalStep2,
  syncLocalFlag,
};
```

A facade is justified only when it owns a coherent workflow boundary. It should
be the public entry point for a domain, not a dumping ground of unrelated
callbacks.

### 2) Keep renderer.js as app shell

`renderer.js` may keep:

- DOM lookup/bootstrap;
- feature construction;
- callback wiring between features;
- app-level menu/IPC event routing;
- unavoidable orchestration between domains;
- small compatibility bridges with a named cleanup path.

`renderer.js` should not keep:

- modal internals for a specific feature;
- file/library/save workflow internals;
- render payload construction internals;
- playback sequencing internals;
- diagnostic parsing/navigation/highlight internals;
- optional tool logic;
- feature-specific helper algorithms.

### 3) Use health targets, not artificial gates

The preferred line-count target for `renderer.js` is:

```text
preferred: 4000-5000 lines
target ceiling: around 6000 lines
```

This is a health target, not an absolute release gate. Do not extract honest
app-shell orchestration merely to satisfy a number.

At the same time, a large renderer file is not acceptable if it still contains
domain internals that belong in feature modules.

### 4) Do not create new monoliths

Do not cheat by moving a monolith into another monolith.

- If a new implementation file grows beyond about 2000 lines, stop and explain
  why before continuing.
- If a facade approaches about 800-1000 lines, split domain internals behind it.
- Thin wrappers are acceptable temporarily only when they replace local
  `renderer.js` internals and have a named cleanup path.

### 5) Inventory before extraction

Before each domain extraction, do a short inventory:

```text
Domain:
Candidate tails in renderer.js:
Files/modules already owning part of the domain:
Reads:
Mutates:
State owned:
Events/callbacks published:
High-risk invariants:
```

This inventory may live in the milestone report or commit message. It does not
need to become a separate document for every small commit.

Do not extract by randomly pulling functions. Extract workflow boundaries or
clearly related domain internals.

### 6) Classify tails after each milestone

An already extracted area is not considered complete merely because some code
has moved out of `renderer.js`.

After each milestone, classify relevant remaining renderer matches as:

```text
Expected app-shell wiring
Expected facade call
Temporary wrapper with cleanup path
Accepted orchestration
Unexpected domain logic
```

A milestone is incomplete if unexpected domain logic remains without being
moved, explicitly deferred, or explained.

### 7) Preserve high-risk invariants

#### Tune activation

- active tune id matches editor contents;
- working-copy snapshot and active metadata refer to the same file/tune;
- dirty state is preserved;
- render payload is based on current editor text;
- library selection matches the active tune.

#### Save/save-as

- disk write is verified;
- file cache and library metadata match saved content;
- dirty flags are cleared only after success;
- conflict paths are updated consistently;
- duplicate prompts are not reintroduced.

#### Render

- render payload, diagnostics, error offsets, and score/editor highlights agree
  about the text rendered or failed;
- abc2svg fallback behavior remains unchanged.

#### Playback

- stop prevents further note events;
- transport UI reflects stopped/playing/paused state accurately;
- follow/playhead highlights are cleared or preserved according to existing
  behavior;
- Focus/selection/repeat behavior remains unchanged unless a separate behavior
  commit explicitly changes it.

### 8) Treat document/save/working-copy as high risk

Any change touching working copy, save, save-as, file lifecycle, dirty state,
missing-file handling, conflict handling, or tune/file metadata is high-risk.

For such changes, explicitly verify or mark unverified this scenario:

```text
edit
save
reopen
move tune
save as
restart app
reopen saved result
```

Also check that duplicate save prompts, save prompt loops, stale dirty flags,
and missing-file conflict paths are not reintroduced.

### 9) Keep third-party components read-only

Treat `third_party/` and vendored components as read-only during renderer
modularization.

Do not patch vendor code locally unless a separate ADR or explicit exception
approves it. Renderer modularization should adapt around third-party behavior,
not silently modify it.

### 10) Stop before stacking regressions

Stop the current milestone and fix or rollback before continuing if a refactor
introduces any of the following:

```text
crash on startup
crash on open file/folder
data-loss risk
save prompt loop
duplicate destructive confirmation
broken save/save-as
broken tune switching
broken render of ordinary ABC
broken normal playback
noticeable open/switch/render slowdown
```

Do not continue extracting more code on top of a known regression. Stabilize
first, then resume with a smaller slice.

## Recommended Order

For the remaining renderer work, prefer this order unless a defect forces a
safer detour:

1. Consolidate library/document workflows from already extracted pieces.
2. Clean up document/file/save/working-copy ownership.
3. Extract render domain internals behind a render facade.
4. Extract playback core behind a playback facade.
5. Add static boundary checks and final tail audits.

Playback core is high risk. Do not start with playback sequencing, Focus
playback, selection playback, repeat logic, or transport lifecycle unless
earlier domain boundaries are clean enough. Small isolated playback-adjacent
services may be extracted earlier if they are discrete, low-risk, and pass tail
audit.

Do not try to separate Library and Working Copy in one big cut. They share
important invariants around active tune, active file, editor content, dirty
state, and metadata. Prefer workflow slices:

```text
select tune
move tune
save file
refresh metadata
delete/duplicate/copy/paste tune
```

Each slice must preserve the full transition from one consistent state to the
next.

## Verification

Run these checks after each milestone:

```sh
npm run -s test:renderer-build
npm run -s test:renderer-boundaries
npm run -s test:quick
git diff --check
```

`test:renderer-boundaries` enforces the 5000-line composition-root ceiling,
prevents a new renderer-side JavaScript module from growing beyond 2000 lines,
caps the legacy `transpose.mjs` exception at its existing size, and prevents
already-extracted editor, playback, header, error-location, and disclaimer
internals from returning to `renderer.js`.

Run UI smoke when the local UI environment supports it:

```sh
npm run -s test:ui-smoke
```

If UI smoke cannot run because of display/Electron/environment limitations,
report it explicitly. Do not imply it passed if it was not run.

Run size inspection:

```sh
wc -l src/renderer/renderer.js

find src/renderer -type f \( -name "*.js" -o -name "*.mjs" \) -print0 \
  | xargs -0 wc -l \
  | sort -nr \
  | head -30
```

Run domain-specific tail audits for touched areas. A regex match is not
automatically a defect; classify it using the tail categories above.

Performance regressions are regressions even when automated tests pass. For
large milestones, compare open folder, open file, tune switching, and render
timing with available debug instrumentation such as:

```js
window.__abcarusPerfFiles = true;
window.__abcarusPerfRender = true;
```

## Milestone Report

After each milestone, report:

```text
Milestone:
Files changed:
renderer.js line count before:
renderer.js line count after:
Largest renderer-side files after change:
New or changed facades:
What domain logic left renderer.js:
What remains in renderer.js and why:
Temporary wrappers and cleanup path:
Tail audit results:
Tests/checks run:
Manual workflows checked:
Known risks:
```

Manual verification must be explicit. Mark workflows as done, not done, or not
relevant.

Relevant workflows include:

```text
open folder
open file
switch tunes
edit and save
Save As
New File
New File From Template
move/copy/delete/duplicate tune
render error navigation
normal playback
Focus playback
selection playback
Print All / Set List if touched
ChordPro open/save if touched
```

## Consequences

Positive:

- `renderer.js` can keep shrinking without losing architectural clarity.
- Future agents get a concrete rule for what belongs in renderer and what does
  not.
- Tail audits make incomplete extractions visible.
- High-risk file/save/playback/render behavior gets explicit protection.

Trade-offs:

- Some milestones will be slower because inventory and tail classification are
  required.
- A facade may need internal splits earlier than would be convenient.
- Refactor commits may need to stop for bug-fix commits when regressions are
  uncovered.

## Relationship to Other ADRs

- ADR-0010 defines the original renderer tool-module direction and stability
  rails.
- ADR-0012 defines feature gating and lazy-loading for optional tools.
- ADR-0015 defines feature ownership boundaries.
- ADR-0016 defines the microtonal tools boundary.

This ADR does not replace those decisions. It defines the contract for the
remaining renderer/domain modularization work.

## Acceptance Criteria

The remaining effort is successful when:

```text
renderer.js trends toward 4000-5000 lines, with ~6000 as an acceptable ceiling
AND renderer.js reads as app shell / wiring
AND no major render/playback/library/save internals remain in renderer.js
AND each major domain has a small coherent facade or controller boundary
AND no new oversized domain monolith or mega-facade appears
AND tests/checks pass or skipped checks are honestly reported
AND touched manual workflows are verified or explicitly marked unverified
AND performance remains acceptable for open/switch/render workflows
```

Final principle:

If a change reduces line count but makes ownership harder to understand, reject
that approach and choose a smaller, clearer slice.
