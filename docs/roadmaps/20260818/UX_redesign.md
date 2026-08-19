You are working in the GitHub repository `topchyan/abcarus`, current `master`, ABCarus 1.5.x.

The task is to implement a **careful, user-driven UX improvement milestone** based on actual feedback from ABCarus users.

Do not redesign ABCarus broadly. Do not simplify the UI merely because something looks visually dense. Preserve useful one-click workflows unless the requested change clearly improves them.

The guiding principle is:

> Improve discoverability, consistency, and repetitive workflows without removing functionality or introducing unnecessary architecture.

Before editing anything, inspect the current repository and understand the actual implementations involved. Do not rely on assumptions from older versions of ABCarus.

---

# 1. Repository and branch safety

Start from a clean current `master`.

Create a dedicated branch, for example:

```text
ux-feedback-round-1
```

Do not modify `master` directly.

Before making changes, run and record the relevant baseline tests, including at minimum:

```bash
npm run test:renderer-build
npm run test:quick
npm run test:ui-smoke
npm run test:ui-playback-smoke
```

Also identify and run narrower harnesses relevant to each modified domain.

Do not weaken or delete tests merely to make the branch pass.

---

# 2. Source of the UX decisions

This work originates from GitHub feedback issue:

```text
#44 — UX feedback review: toolbar, Library, tune/header controls
```

and direct feedback from users of ABCarus 1.5.0.

Important: not every suggestion from #44 is approved for implementation.

Implement only the items explicitly listed below.

---

# 3. Playback controls: move them to the score area

## Problem

Multiple users independently reported that playback controls should have a stable location associated with the rendered score rather than appearing in different places depending on layout/mode.

The current top-center transport location is less intuitive because playback conceptually belongs to the sheet-music pane.

## Required change

Move the primary playback controls:

```text
Play / Pause
Stop
Start Over
```

from the global top toolbar to a compact toolbar located immediately above the rendered sheet-music pane.

The playback controls must stay in the same logical position in:

* normal split view;
* vertical split;
* horizontal split;
* Focus mode;
* when Library is open or hidden.

The controls should visually belong to the render pane.

Do not duplicate the controls permanently in both locations.

Keyboard shortcuts must remain unchanged:

```text
F4 — Start Over
F5 — Play / Pause
Esc — Stop
```

Existing menu commands must remain functional.

Preserve all existing playback behavior.

---

# 4. Add practical tempo control near playback

Users specifically requested interactive tempo control during playback/practice.

Current relative percentage controls are useful but insufficient because musicians often need to know the actual BPM in order to reproduce the tempo with an external metronome.

Implement a compact tempo control beside the transport controls.

Conceptually:

```text
[ Play ] [ Stop ] [ Start Over ]

Tempo  [──────●──────]   112 BPM   [−] [+]
```

Exact visual design may be adapted to ABCarus styling, but behavior must satisfy the requirements below.

## Requirements

Provide:

1. a slider for convenient coarse adjustment;
2. visible effective BPM;
3. small decrement/increment controls for fine adjustment.

The effective BPM must be calculated from the tune's playback tempo and the selected playback speed.

For example, if the tune contains:

```abc
Q:1/4=120
```

and playback speed is 75%, the UI should display an effective tempo corresponding to approximately:

```text
90 BPM
```

Do not rewrite the tune's `Q:` field merely because the user changes practice tempo.

Tempo adjustment is a playback/runtime control unless an existing explicit feature says otherwise.

The control must therefore not make the ABC document dirty.

## Fine adjustment

The `−` / `+` controls should change the effective tempo in useful small increments.

Prefer a simple musical/user-facing unit such as 1 BPM when feasible.

Avoid floating-point drift.

## Slider

Choose sensible lower and upper bounds for practice.

Do not make extreme ranges that render most of the slider useless.

Reuse the existing playback speed mechanism wherever possible instead of introducing a second competing tempo engine.

If the current architecture fundamentally represents tempo as a playback multiplier, keep that authority and map the new BPM UI onto it.

There must be only one playback-speed authority.

## Tunes without a simple BPM

Inspect how abc2svg / ABCarus currently interprets `Q:`.

Some ABC tempo declarations may not map trivially to a single quarter-note BPM.

Handle such cases gracefully.

Do not invent a misleading BPM.

If exact effective BPM cannot be derived reliably, retain usable relative speed control and display an appropriate neutral representation.

Document the behavior in code/tests.

---

# 5. Selection-specific playback controls should be contextual

Current selection-related controls can consume permanent toolbar space.

Users indicated they are useful but need not always be visible.

Review controls such as:

```text
Loop selection
No repeats
Chords
Drums
Voices
```

Make selection-specific controls appear only when they are relevant to the current playback context.

At minimum, avoid permanently displaying `Loop selection` when there is no editor selection for it to act upon.

Do not remove functionality.

Do not move important configuration permanently out of reach; Settings/menu access may remain.

Avoid layout jumping that causes the primary transport controls themselves to move.

The transport toolbar position must remain stable even when contextual controls appear/disappear.

---

# 6. Library button: remove hidden Shift-click dependency

## Current issue

The main `Library` button currently has hidden modified-click behavior:

```text
click       → toggle Library tree
Shift-click → Library Catalog
```

Users confirmed that Shift-click is not discoverable.

## Required change

Keep normal click behavior:

```text
Library → toggle Library tree
```

Add a discoverable secondary affordance, preferably a small dropdown/chevron associated with the Library control.

The dropdown should expose at least:

```text
Library Catalog…
Open Folder as Library… / Open Library Folder…
```

Do not remove menu access.

The Shift-click shortcut may remain for backward compatibility if it costs essentially nothing, but it must no longer be the only obvious direct path to Library Catalog.

Do not create two large permanent Library buttons unless the existing layout clearly benefits from it.

---

# 7. Clarify the Library-folder command

A user reported not understanding what:

```text
Open Library Folder…
```

means.

Review the wording in the UI.

Prefer wording that communicates the action rather than requiring prior knowledge of ABCarus terminology.

Candidate wording:

```text
Open Folder as Library…
```

or another equally clear phrase.

Do not rename internal APIs unnecessarily.

This is primarily user-facing terminology.

Maintain existing behavior and shortcuts unless there is a strong reason not to.

Also inspect the initial directory used by this dialog on macOS.

A user reported that it opens Downloads even though that was not their ABCarus working folder.

ABCarus already persists navigation/history state; use the most appropriate existing remembered folder if one exists.

Do not introduce a new path-history subsystem just for this.

---

# 8. New Tune / Templates consolidation

Users found the relationship among:

```text
New Tune
New Tune From Template
Templates
```

somewhat fragmented.

Implement a compact split/dropdown control in the tune toolbar.

Desired concept:

```text
[ + New Tune ] [▼]
```

Primary click:

```text
create blank tune
```

Dropdown:

```text
Blank Tune
From Template…
Templates Library…
```

It is acceptable to preserve the current separate underlying commands internally.

Do not change the actual New Tune lifecycle or Save semantics as part of this UX task.

Do not alter template data architecture.

Keyboard shortcuts and menu commands should continue working.

---

# 9. Print Preview: interactive output scale

This is one of the most concrete user pain points.

A user described this repeated workflow:

```text
Print Preview
→ final line spills onto page 2
→ exit preview
→ add/change %%scale
→ reopen preview
→ repeat
```

They sometimes need 7–10 iterations to obtain the largest readable single-page result.

## Required feature

Add an interactive scale control directly to Print Preview.

Conceptually:

```text
Scale:  [──────●──────]  92%
```

or an equivalent compact UI.

Changing the control must update the preview immediately or with a small debounce.

The user should be able to visually find the largest scale that still fits the desired pagination without closing the preview.

## Critical semantic requirement

Preview scale is a **print/export presentation override**.

Changing the Print Preview scale must NOT automatically insert or modify:

```abc
%%scale
```

in the source tune.

It must not set the tune dirty.

Do not silently modify ABC source.

If there is already an explicit mechanism for committing print settings into source, keep it separate.

## Behavior

The preview scale should affect the rendered print output produced from the current preview session.

It should work with:

* current tune print preview;
* normal printing from that preview, if supported;
* PDF export from the same preview path where appropriate.

Do not unintentionally change `Print All Tunes` semantics unless the code naturally shares the same preview layer and the behavior is clearly correct.

## Range

Choose a useful bounded scale range.

Avoid arbitrary extreme values.

If abc2svg's existing `%%scale` semantics can be reused internally, use them as a temporary render override rather than modifying source text.

Prefer injecting an ephemeral render directive/payload over rewriting the editor buffer.

Ensure repeated preview adjustments do not accumulate duplicate scale directives.

---

# 10. Do NOT remove Settings from the toolbar

A previous UX review suggested that Settings might be removable from the permanent toolbar.

That is **not approved**.

The project owner finds one-click Settings access useful.

Keep it for this milestone.

Do not move or remove it.

---

# 11. Do NOT remove Reset View yet

One GitHub respondent said Reset View could move to the View menu, but the project owner finds one-click Reset View useful.

There is not enough user feedback to justify removal.

Keep the current Reset View button for this milestone.

Do not make speculative cleanup changes around it.

---

# 12. Do NOT redesign Header Save semantics

A GitHub user explicitly reported that the current Header behavior is clear.

The project owner also considers the Header conceptually similar to a special or “pseudo-tune” editable unit whose scope affects the whole file.

Therefore:

* do not remove `Save Header`;
* do not merge Header Save into normal tune Save in this UX milestone;
* do not redesign Header dirty behavior;
* do not modify single-tune architecture to solve a nonexistent UX problem.

If current code must be touched incidentally, preserve behavior exactly.

---

# 13. Library sorting by arbitrary ABC metadata field

A user requested the ability to sort/group using arbitrary ABC metadata fields rather than only a predefined list.

Example:

```abc
A:
```

may be repurposed by a user's collection as a custom sorting field.

This is useful, but it is a larger feature than the quick UI changes above.

For this milestone:

1. inspect how Library metadata fields, grouping, and sorting are currently modeled;
2. determine whether arbitrary metadata-field grouping/sorting can be added cleanly without destabilizing Library behavior;
3. if it is genuinely small and fits the existing model, implement it;
4. otherwise do NOT force it into this branch.

If deferred, document a precise implementation recommendation suitable for a separate issue.

Do not add a large generic metadata framework merely for this request.

---

# 14. Library Tree vs Library Catalog

Users like both.

One respondent had not discovered Catalog before the feedback thread but liked it once found.

Therefore:

* keep Tree;
* keep Catalog;
* do not merge them into one view;
* improve discoverability through the Library dropdown described above.

Treat them as complementary views over the same collection.

Do not perform architectural consolidation in this milestone.

---

# 15. Toolbar design principle

Do not perform a broad toolbar redesign.

The intended result is:

* playback actions are associated visually with the score;
* playback controls do not jump around between modes;
* contextual options appear only when useful;
* Library secondary actions become discoverable;
* existing useful one-click actions are preserved unless specifically approved for removal.

Do not pursue minimalism for its own sake.

ABCarus is a specialist desktop application used by experienced musicians and ABC users. Efficient direct access is often preferable to hiding everything inside menus.

---

# 16. Accessibility and interaction details

For all new controls:

* use proper `<button>`, `<input>`, `<label>`, etc.;
* provide `aria-label` where visual text is insufficient;
* preserve keyboard navigation;
* preserve focus visibility;
* ensure controls work in light/dark themes if ABCarus supports both;
* do not rely solely on color to communicate state;
* use existing ABCarus button/icon styling rather than introducing a new visual language.

For dropdown/split buttons:

* keyboard opening must work;
* Escape should close;
* clicking elsewhere should close;
* focus should not be lost unpredictably.

Do not introduce a large UI framework.

Use the existing renderer architecture and CSS conventions.

---

# 17. Layout constraints

Test at least:

```text
1200 × 800
```

which is the current default window size, plus a meaningfully narrower window.

The score playback toolbar must not force horizontal scrolling or cause major wrapping.

Contextual controls may collapse/wrap, but the primary transport must remain easy to locate.

Test:

* Library visible;
* Library hidden;
* horizontal split;
* vertical split;
* Focus mode;
* Raw mode where applicable;
* no active file;
* normal active tune;
* active text selection;
* playback running;
* playback paused/stopped.

Do not expose irrelevant score playback controls in modes where there is no rendered score unless existing behavior requires them.

---

# 18. Architecture constraints

Respect current renderer/domain boundaries.

Before implementation inspect at least the relevant parts of:

```text
src/renderer/index.html
src/renderer/style.css
src/renderer/renderer.js
src/main/menu.js
```

and the actual current playback, render, Library, print-preview, settings, and command controllers/domains.

Do not place substantial new behavior into `renderer.js` merely because it is convenient.

If a domain/controller already owns playback state, tempo state, print preview, Library actions, etc., extend that owner.

Keep `renderer.js` as composition/wiring where the current architecture intends that.

Avoid:

* duplicate state authorities;
* parallel tempo state;
* DOM state used as canonical playback state;
* hidden mutable globals;
* speculative framework abstractions;
* unrelated refactors.

---

# 19. Dirty-state constraints

Playback tempo adjustment:

```text
must NOT dirty the tune
```

Print-preview scale adjustment:

```text
must NOT dirty the tune
```

Library dropdown:

```text
must NOT affect document state
```

New Tune behavior must preserve the existing dirty/save lifecycle.

Do not change document dirty semantics as part of these UX features.

---

# 20. Test requirements

Add focused automated tests where practical.

At minimum cover:

## Playback toolbar

* controls are wired to existing commands;
* Play/Pause state remains correct;
* Start Over and Stop behavior unchanged;
* toolbar remains available in Focus mode;
* no duplicate command execution.

## Tempo

* effective BPM computation;
* slider → playback multiplier mapping;
* `+` / `−` adjustment;
* reset/default behavior;
* tune switch updates displayed base/effective tempo;
* tempo UI changes do not dirty the document;
* unusual/unsupported `Q:` cases degrade safely.

## Contextual selection controls

* hidden when irrelevant;
* visible when relevant;
* options retain state correctly;
* appearance/disappearance does not move the primary transport unexpectedly.

## Library

* normal Library button still toggles tree;
* dropdown opens;
* Catalog action works;
* Open Folder action works;
* existing shortcuts/menu commands still work.

## New Tune dropdown

* primary action creates blank tune;
* template action uses existing flow;
* template library still opens;
* no regression in dirty/new-tune/save tests.

## Print Preview scale

* preview scale changes output;
* source text unchanged;
* dirty state unchanged;
* repeated changes do not accumulate directives/state;
* print/export path uses selected preview scale where intended.

Run relevant existing harnesses plus:

```bash
npm run test:renderer-build
npm run test:quick
npm run test:ui-smoke
npm run test:ui-playback-smoke
```

Run any print/export tests currently present.

---

# 21. Manual verification

After automated tests pass, manually verify the following workflows:

### Playback

```text
Open Library Folder
→ select tune
→ Play
→ adjust tempo slider
→ use ± BPM
→ pause
→ Start Over
→ switch Focus mode
→ verify controls remain in the same logical score location
```

### Selection playback

```text
select ABC text
→ selection options appear
→ play selection
→ clear selection
→ contextual controls disappear
→ main transport does not move
```

### Print

```text
open tune
→ Print Preview
→ adjust scale until pagination changes
→ close preview
→ verify ABC source unchanged
→ verify document is not dirty
```

### Library

```text
click Library
→ tree toggles

open Library dropdown
→ Catalog opens

open dropdown
→ Open Folder as Library works
```

### New Tune

```text
New Tune primary click
→ blank tune

dropdown → From Template
→ template workflow

dropdown → Templates Library
→ template library
```

---

# 22. Commit structure

Keep commits logically separable.

Suggested structure:

```text
ux: relocate playback transport to score pane
ux: add effective BPM playback control
ux: make selection playback controls contextual
ux: add discoverable Library actions dropdown
ux: consolidate New Tune entry points
ux: add print preview scale control
test: cover UX feedback milestone
docs: document updated playback and print-preview controls
```

Do not combine large unrelated changes into one opaque commit.

---

# 23. Documentation

Update the User Guide after implementation.

Document:

* new playback-control location;
* tempo slider;
* displayed BPM;
* fine tempo adjustment;
* distinction between runtime tempo and source `Q:`;
* Print Preview scale control;
* fact that preview scale does not edit the ABC source;
* Library dropdown;
* New Tune dropdown if implemented.

Do not document behavior that is not actually implemented.

---

# 24. Final audit

Before considering the milestone complete:

1. inspect the diff for accidental unrelated changes;
2. verify Settings remains on toolbar;
3. verify Reset View remains on toolbar;
4. verify Header Save semantics are unchanged;
5. verify Library Tree and Catalog both remain;
6. verify no new duplicate playback-speed authority was introduced;
7. verify runtime tempo does not dirty source;
8. verify print-preview scaling does not dirty source;
9. verify no command became accessible only by mouse;
10. verify no existing shortcut was lost.

---

# 25. Deliverable

At the end, provide a concise engineering report containing:

```text
Implemented
Deferred
Behavior intentionally preserved
Tests added
Tests run
Manual checks performed
Known limitations
```

For any item you deliberately defer, explain why in concrete implementation terms.

Do not open a PR until the implementation and regression checks are complete.

Do not merge anything into `master`.

The goal is not to make ABCarus visually “minimal.”

The goal is to make the workflows that actual users identified as awkward:

```text
playback positioning
tempo adjustment
print-preview scaling
Library discoverability
New Tune discoverability
```

more direct while preserving the efficient specialist controls that existing users already rely on.

---

# 26. Repository-aware review (2026-08-18)

This section is the response to the draft above. It was written after inspecting
the current working branch and therefore supersedes assumptions in the draft
that were based on ABCarus 1.5.0 before the latest Library work.

The draft remains useful as a source of UX proposals, but it must not be used as
a single implementation prompt. Each accepted item needs a fresh audit against
the post-merge `master` and its current domain boundaries.

## Changes already present in the current branch

The `library-catalog-facets` branch already extends the Library model beyond the
baseline assumed above:

- valid namespaced `G:[namespace]` metadata is discovered dynamically and
  becomes available in the Library **Group by** control;
- namespaced `G:`, plain `G:`, and `C:` categories can be renamed or merged;
- category merge is available by drag and drop and by context menu;
- replacements are exact, restricted to tune headers, and never rewrite file
  headers or unrelated namespaces;
- multi-file updates use guarded writes and application-level rollback;
- multiple `C:` fields are indexed without changing the existing primary
  composer display contract;
- the bundled editor font and Raw-mode active state have also changed, so visual
  work must use the post-merge UI as its baseline.

Consequently, the proposed arbitrary metadata grouping is no longer one
undifferentiated task. Custom namespaced `G:` grouping is implemented. General
support for arbitrary ABC fields such as `A:` remains a separate design issue
and should not be folded into the first UX milestone.

## Corrected assessment of the proposed work

### Accept as a small first milestone

1. Clarify the Library open-folder command without removing Tree or Catalog.
2. Replace hidden Library mode behavior with an explicit compact selector, if
   the audit confirms that no existing one-click workflow is lost.
3. Move only controls whose ownership is unambiguous. `Loop selection` may be
   contextual to an actual text selection.

Opening a Library folder already uses saved dialog preferences and recent-folder
fallbacks. The reported macOS behavior must therefore be reproduced before a
new persistence mechanism is introduced.

### Accept with an explicit playback contract

Moving the transport above the score is reasonable, but tempo work must reuse
the existing `practiceTempoMultiplier`; it must not introduce a second speed
authority. The current multiplier is primarily associated with Focus playback.
Before implementation, decide and test whether the new control applies to both
normal and Focus playback.

The displayed tempo must include its beat unit. A numeric BPM can be derived
only from supported simple `Q:` forms; otherwise the UI should show the runtime
percentage rather than presenting a misleading BPM value. Runtime tempo changes
must remain non-destructive and must never dirty the ABC source.

`No repeats`, `Chords`, `Drums`, and `Voices` are Focus options, not merely
selection options. They should stay available in the Focus context even when no
text selection exists.

### Preserve the actual New Tune semantics

The current commands are not interchangeable:

- **New Tune** appends a tune to the active file;
- **Templates** opens the template library with Insert, Replace, and Append;
- **New Tune From Template** creates a new file from the bundled starter
  template.

Any new dropdown must name these actions according to their real effects. A
safe candidate vocabulary is:

```text
Blank Tune
Insert from Templates...
Templates Library...
New File from Starter Template...
```

The final item may remain in the File menu if combining file creation with
tune insertion makes the local control less clear.

### Defer to a dedicated Print Preview milestone

The current Print Preview produces a PDF and opens it in the operating system's
external viewer. There is no internal preview surface on which ABCarus can place
a live scale slider. Implementing the proposed interaction therefore requires
an ABCarus-owned preview window or modal, preview-only render state, regeneration
and cancellation behavior, and cross-platform validation.

This is a useful feature, but it is not a toolbar adjustment. Treat it as a
separate higher-risk milestone. It must not modify the tune text or reuse the
source `%%pagescale` directive as hidden mutable state.

## Recommended sequence

1. Merge and verify the current Library metadata branch.
2. Create a new branch from the resulting `master`.
3. Implement Library wording and explicit mode selection as UX-A.
4. Implement score transport and one authoritative runtime tempo control as
   UX-B.
5. Revisit New Tune entry points as UX-C after documenting command semantics.
6. Design and implement an internal interactive Print Preview separately as
   UX-D.
7. Track arbitrary non-namespaced ABC metadata grouping as a separate Library
   issue, informed by the existing namespaced `G:` implementation.

Tests should accompany each feature commit rather than being postponed to one
large final test commit. Every milestone must preserve keyboard access, Header
save behavior, Settings, Reset View, Library Tree and Catalog, and the existing
single source of truth for playback speed.

## Decision

The draft is accepted as UX input, not as an executable all-at-once plan. Its
goals are compatible with the current architecture after the corrections above.
Implementation should proceed as independent, reviewable milestones from the
post-Library `master`, with Print Preview and arbitrary ABC-field grouping kept
out of the first milestone.
