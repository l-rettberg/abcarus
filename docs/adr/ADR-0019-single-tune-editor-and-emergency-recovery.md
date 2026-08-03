# ADR-0019 — Single-Tune Editor and Emergency Recovery

Status: Accepted  
Date: 2026-08-03  
Decision Owner: Project architecture  
Refines: ADR-0018  
Supersedes: conflicting Save and external-change details in ADR-0018

## Context

ABCarus is used as a single-tune editor in normal mode:

```text
At any moment exactly one tune is being edited.
```

The file may contain many tunes, but only the selected tune is editable. A
global mutable file session, Working Copy, or full-file Save cache is not
needed for this workflow. Such layers create additional authorities and make
it difficult to determine whether a file operation is using editor state,
Library state, or an intermediate copy.

Raw mode is an explicit exception: it edits the complete file and has
file-level dirty state. ChordPro is a hybrid case: one ABC component is
edited inside a complete non-ABC document.

## Decision

### 1. Single-tune editing is the core document model

Normal mode owns exactly one editable tune. The current document is represented
by four parts:

```text
Header
Stuff Before
Active Tune
Stuff After
```

The four parts are the current editor document state. They are not a cache and
are not a second mutable file authority.

The active document also contains the file path, session-only tune identity,
tune boundaries, dirty state, and optional header dirty state. The tune
identity exists only for the current application session and is never written
into ABC source files. Tune identity and offsets are load/navigation metadata,
not Save inputs: Save uses the already prepared four document parts.

### 2. Tune lifecycle

#### Open tune

1. Read the file from disk.
2. Segment the file into tunes and metadata.
3. Split the selected tune into the four document parts.
4. Load `Active Tune` into the editor.
5. Mark the document clean.

#### Edit

Editor changes affect only `Active Tune` or the explicitly editable header.
The document is dirty exactly when its current editable text differs from the
last loaded or successfully saved text. Undoing changes back to that text
clears dirty state. No hidden full-file synchronization occurs.

#### Save

1. Compose `Header + Before + Active Tune + After`.
2. Atomically write the composed file to the original path.
3. If the write succeeds, mark the document clean.
4. Re-read and re-index the saved file for Library state.
5. Rebuild the active tune context from the saved file.

The current editor buffers are authoritative for Save. Disk text is not merged
into them and is not silently substituted for them.

#### Switch tune

1. If the current document is clean, discard its buffers.
2. If it is dirty, show `Save / Don't Save / Cancel`.
3. On `Save`, complete Save before switching.
4. On `Don't Save`, discard the entire current four-part document and all of
   its unsaved editor/header changes.
5. On `Cancel` or Save failure, keep the current tune active.
6. Only then read the target file from disk and split the new tune.

There must never be two simultaneously dirty tunes in memory.

### 3. External file changes

The application does not maintain a separate signature or full-text baseline
for deciding whether the current editor state is valid. If the file was
changed or deleted externally, the current editor buffers remain the user's
active work.

On Save:

- if the original directory is available, write the composed buffers to the
  original path, recreating or replacing the file as necessary;
- intentionally replace external file content with the current editor
  document;
- do not attempt an automatic merge;
- do not silently replace dirty editor content with external content.

This is an explicit overwrite policy, not accidental conflict resolution.

### 4. Emergency recovery

If the target file cannot be written because its directory was deleted,
renamed, or became inaccessible, ABCarus must:

1. keep the editor document dirty;
2. write an emergency copy to a safe application-owned directory;
3. include the original path and creation timestamp in recovery metadata;
4. report the emergency-copy path clearly;
5. offer recovery of the emergency copy when the application later returns to
   an active file workflow.

Emergency recovery is a failure path for the original write. It is not a
Working Copy and must not become a parallel editing session.

Creating an emergency copy does not change the active file path, does not
select the emergency copy, and does not clear dirty state. The user must
explicitly choose recovery before the copy becomes an active document.

Emergency copies preserve the complete composed document. For Raw mode this
is the complete Raw document; for ChordPro this is the complete hybrid file.

### 5. Raw mode

Raw mode edits one complete file document: full file text plus file-level dirty
state. Tune-level selection and structural Library operations are disabled or
deferred while Raw mode is active. Save writes the complete Raw text
atomically. Leaving Raw mode re-reads and re-indexes the complete file.

### 6. ChordPro

ChordPro edits one ABC component inside a hybrid file. The active component is
represented relative to the full document by content before, the active ABC
component, and content after. Only one component is editable at a time.
Switching components while dirty uses `Save / Don't Save / Cancel`. Save
reconstructs and atomically writes the complete ChordPro file.

### 7. Library operations

The Library represents saved disk state. Move, copy, duplicate, delete, rename,
append, and structural renumber operations require the active document to be
clean. If it is dirty, the operation must request Save or cancel before
touching the file. After every successful structural operation, affected files
are re-read and re-indexed.

## What this decision removes

The active architecture must not contain:

- a global Working Copy;
- a full-file mutable session for ordinary tune editing;
- a full-text cache used as Save authority;
- file signatures used as a second document identity mechanism;
- repeated tune search during Save when four-part boundaries are valid;
- automatic merging of external file content.

A file-content cache may temporarily exist for non-critical Library or
diagnostic performance work, but it must not participate in Save authority,
dirty state, tune switching, or conflict decisions.

## File-write requirements

- All writes remain atomic where possible.
- Temporary files and rename operations use the main-process file I/O layer.
- Failed writes never clear dirty state.
- Emergency copies use a safe application-owned path.
- A successful write is followed by Library re-indexing before the UI is
  marked clean.

## Verification

Required tests include clean and dirty tune switching, exact `Don't Save`
discard behavior, dirty clearing after undo to the loaded text, four-part Save
reconstruction, deleted-file recreation, external replacement overwrite,
inaccessible-directory emergency copy and recovery, Raw Save/re-index,
ChordPro component Save/switching, dirty structural-operation rejection,
move/copy/delete re-indexing, and paths with spaces or non-ASCII characters.

## Consequences

### Positive

- Exactly one dirty tune exists at a time.
- Save has one obvious source: current editor buffers.
- No hidden file session or baseline cache competes with the editor.
- Tune switching follows the familiar single-document editor model.
- Library reflects saved disk state after successful operations.
- Deleted files can be deliberately recreated from active editor work.
- Unavailable paths have an explicit recovery path.

### Trade-offs

- External changes are intentionally overwritten on Save.
- Users need emergency recovery or Raw inspection when preserving external
  content matters.
- Emergency-copy UX and recovery tests are required.
- Long-running multi-file operations need explicit snapshots and transactional
  file handling; they must not reuse the active tune document.

## Relationship to previous ADRs

- ADR-0006 remains historical and superseded.
- ADR-0017 continues to govern renderer/domain ownership.
- ADR-0018 remains the foundation for removing global Working Copy state;
  this ADR defines the stricter single-tune Save and recovery contract.
- Earlier requirements to preserve a file fingerprint or full-text Save
  baseline are superseded by this ADR.
