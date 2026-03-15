# ABCarus Rewrite Roadmap (Core Engine, UI Preserved)

Date: 2026-03-05  
Status: Proposed (execution-ready baseline)

## Goal
Rebuild moving core logic of ABCarus with a simpler, more deterministic architecture while preserving the current UI as the working prototype.

Primary principles:
- Simplicity
- Minimalism
- Efficiency
- Maintainability

## Scope
In scope:
- Playback planning/execution core (ranges, repeats, looping, mutes, stop boundaries).
- File/tune state transitions tied to open/close/new/save flows.
- Startup sequencing/status pipeline where needed for deterministic behavior.
- Test harness expansion for rewritten modules.

Out of scope:
- Full UI redesign.
- Big-bang rewrite of all modules in one release.
- New feature expansion unrelated to stability/clarity.

## Strategy
Use an incremental strangler approach:
1. Keep existing UI and user flows.
2. Introduce new core modules behind clear interfaces.
3. Switch one subsystem at a time.
4. Keep old path as fallback until parity is proven.
5. Remove old path only after test + manual parity gates pass.

## Architecture Target
Target boundaries:
- `UI layer` (existing renderer controls, minimal logic).
- `Core domain layer` (pure plan/build/resolve logic).
- `Execution layer` (player adapters, scheduling, cancellation).
- `I/O/state layer` (working copy + file operations + settings).

Rules:
- Prefer pure functions for planning/resolution.
- Single source of truth per concern.
- No hidden side effects in planning stage.
- Fail closed on ambiguous ranges.

## Phased Plan

### Phase 0 — Baseline & Freeze
Deliverables:
- Freeze current behavior with explicit test matrix:
  - Focus playback cases (existing harness + missing edge cases).
  - Open/close/new/save state transitions.
- Add/refresh fixtures from real debug dumps.

Exit criteria:
- Current known behavior captured in tests (including known quirks).
- Red/green confidence before rewrite starts.

### Phase 1 — Playback Plan Core (Pure)
Deliverables:
- New pure `playback plan builder` module:
  - scope resolution (visible/segment),
  - bar index map,
  - repeat policy handling,
  - mute policy mapping.
- No direct UI or player calls from this module.

Exit criteria:
- Module passes full playback harness suite.
- Deterministic output snapshots for identical inputs.

### Phase 2 — Bounded Execution Engine
Deliverables:
- New execution wrapper:
  - strict start/end boundaries,
  - deterministic stop/cancel,
  - loop restart semantics.
- Player adapter abstraction (minimal, explicit contract).

Exit criteria:
- No overshoot regressions in automated cases.
- Stop/reset semantics stable under repeated manual stress runs.

### Phase 3 — File/Tune State Machine Cleanup
Deliverables:
- Consolidated transitions for:
  - empty/untitled states,
  - close/new/open/save/save-as,
  - dirty/unsaved markers.
- Remove duplicated transition logic.

Exit criteria:
- Transition table documented and covered by regression tests.
- No silent no-op save paths in empty/untitled scenarios.

### Phase 4 — Cutover & Removal
Deliverables:
- Make new core path default.
- Remove deprecated old branches and dead flags.
- Update docs and release notes.

Exit criteria:
- All targeted harnesses green.
- Manual smoke passes on Linux + Windows + macOS.
- Old path removed or explicitly gated only for emergency rollback.

## Prioritization (Impact / Effort / Risk)
- Playback plan core: Impact H / Effort M / Risk M
- Bounded execution: Impact H / Effort M / Risk H
- File/tune state machine: Impact H / Effort M / Risk M
- Startup status integration: Impact M / Effort L / Risk L

## Acceptance Criteria (Program-Level)
- Determinism: same input state => same playback/file transition result.
- Boundedness: no playback outside selected/visible scope.
- Recoverability: clear fail-closed messages, no silent broken state.
- Operability: tests/harnesses detect regressions before release.

## ADR Policy for This Roadmap
This document is a roadmap, not an ADR.
Create/update ADRs when a phase introduces durable architecture decisions (module boundaries, contracts, rollback policy, ownership model).

## First Execution Slice (recommended)
Start with Phase 1 using existing Focus playback harness and real-world regression dumps. Keep UI unchanged; only replace plan computation path behind a feature flag until parity is proven.
