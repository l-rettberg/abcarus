# ADR-0018 — Remove the Global Working Copy Model

Status: Accepted; refined by ADR-0019
Date: 2026-08-02
Decision Owner: Project architecture
Supersedes: ADR-0006 for the active product architecture
Amends: ADR-0017

## Context

ABCarus is an editor for ABC files, but its normal workflow edits one tune at
a time. A tune belongs to a file and the Library is the index and presentation
of the saved file contents. Raw mode is an explicit exception: it gives the
user full-file control and does not promise tune-level protection.

The global Working Copy model was adopted in January 2026, when the project
was still organized around a disk-first design and anticipated long-running
jobs, transforms, and multi-file workflows. Since then the application
architecture and workflow have changed substantially. The current Working
Copy implementation is now a second mutable authority alongside the editor,
Library cache, active tune metadata, and main-process file state.

This has produced recurring high-risk failures:

- stale or contradictory dirty state;
- save and Save As prompt loops;
- lost or duplicated tunes during move and file transitions;
- failures caused by switching one global Working Copy between files;
- renderer/main-process snapshot races;
- slower open, tune selection, and file operations;
- difficult-to-audit code paths for otherwise simple file mutations.

The costs now exceed the value provided by the global Working Copy abstraction.

## Decision

ABCarus removes the global Working Copy as a product-level state model.

The active document model becomes:

```text
disk file -> Library/index -> active tune document in the editor
```

There is one authoritative editable document for the active tune. Its state is
owned by the document/editor layer:

- active file path;
- active tune identity and offsets;
- editor text;
- dirty state;
- optional header dirty state;
- explicit save status.

The main process remains responsible for safe filesystem operations and atomic
writes. It does not own a parallel mutable copy of the active file.

## Normal Tune Workflow

1. Library reads and indexes files from disk.
2. Selecting a tune loads its text into the active editor document.
3. Editing changes only the active editor document and marks it dirty.
4. Save writes the reconstructed file atomically and verifies the result.
5. After successful Save, the Library entry is refreshed from the saved file.
6. The editor and Library are marked clean only after disk verification and
   metadata refresh succeed.

No background or hidden synchronization may write user data.

## Move, Copy, Delete, and Similar Operations

Before changing a file that contains the active tune:

- if the active document is dirty, ask the user to Save or cancel;
- if the user cancels or Save fails, perform no structural operation;
- never modify a file behind an unsaved active editor document.

For a move between files:

1. Confirm that the source active document is clean or explicitly saved.
2. Read and validate source and destination files.
3. Remove the selected tune from the source text.
4. Append the tune to the destination text.
5. Assign the destination tune the next sequential `X:` number.
6. Write the affected files using atomic writes and expected-content checks.
7. Refresh both Library entries from disk.
8. Select the moved tune in the refreshed destination entry.

The existing `X:` value is user data and is not treated as a persistent
identity. Duplicate or malformed `X:` values remain valid input; explicit
renumbering may offer a repair, but move does not need to solve that problem.

If a multi-file operation cannot complete safely, it must fail closed and must
not silently leave a duplicate or partial move. Where rollback is possible,
the operation must restore the already-written file; otherwise it must report
the affected paths clearly.

## External Changes on Disk

The active Save and external-change policy is defined by ADR-0019. In
particular, the current single-tune editor buffers are authoritative for Save;
file fingerprints are not required, and external disk content is not merged
into dirty editor state. If the original path is unavailable, ADR-0019
requires an emergency copy.

## Raw Mode

Raw mode edits the complete file and is intentionally outside tune-level
protection. It retains its own document text, dirty state, Save, and Reload
behavior. Raw mode must not depend on a hidden Working Copy and must not be
silently reconciled with a tune editor document.

## What Is Removed

The migration must remove, rather than rename, the global Working Copy
concept from active workflows:

- main-process Working Copy state and switching;
- renderer snapshot, lazy-open, and debounced tune-sync machinery;
- Working Copy-specific save/conflict dialogs and context guards;
- APIs whose only purpose is to mutate or commit the Working Copy;
- duplicate dirty-state calculations based on editor plus Working Copy.

Atomic file writes, expected-content checks, file locks where needed, disk
fingerprints, and Library refreshes remain. These are filesystem safety
properties, not Working Copy features.

## Migration Rules

- Do not perform a big-bang rewrite.
- Keep the application buildable after each migration slice.
- Migrate one complete workflow at a time: tune load, Save, Save As, move,
  copy/delete, Raw mode, then import/export.
- Do not leave a compatibility layer that continues to act as a second mutable
  authority.
- During migration, any temporary adapter must have a named removal milestone.
- Add regression tests for save, external replacement, move, duplicate `X:`
  values, missing files, permission errors, and cancel paths.

## Consequences

### Positive

- One clear source of truth for the active tune.
- Fewer dirty-state and identity races.
- No global WC switching during move or file selection.
- Simpler Save, Save As, and Library refresh semantics.
- Better alignment with the actual one-tune-at-a-time user workflow.
- Less renderer/main-process coupling and lower maintenance risk.

### Negative

- Long-running multi-file jobs must use explicit snapshots and transactional
  file operations instead of relying on WC versioning.
- External-change handling must be designed directly in Save and file
  operation flows.
- Existing Working Copy tests and IPC APIs must be retired or rewritten.
- Migration can temporarily expose inconsistencies if domains are converted in
  the wrong order.

## Acceptance Criteria

The migration is complete only when:

- no active user workflow requires a global Working Copy;
- `src/main/workingCopyStore.js` and Working Copy IPC channels are removed or
  reduced to unused migration code and then deleted;
- Save and Save As perform verified atomic writes and refresh Library state;
- moving a clean tune works without Working Copy state or prompts;
- moving a dirty tune requires Save or cancel and never partially moves it;
- external replacement is detected without silent data loss;
- Raw mode remains independently usable;
- the file-operation, save-flow, startup, renderer-build, and UI smoke suites
  pass;
- the final code audit finds no duplicate editor/Working Copy authority.

## Superseded Decision

ADR-0006 remains in the repository as historical context. Its global Working
Copy decision, JobManager assumption, and acceptance criteria that require a
Working Copy are superseded by this ADR. Atomic writes, explicit user choice
for destructive reload/overwrite, snapshot validation for long operations, and
strict-write behavior remain required independently of that model.
