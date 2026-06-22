# Code Review: Working Copy Sync Fixes

**Date:** 2026-06-21  
**Files changed:** `src/renderer/renderer.js`, `scripts/check_renderer_build.mjs`  
**Branch:** master (unstaged changes)

## Summary

This change hardens working-copy save behavior:
1. **Pre-commit sync guard** — save operations wait for in-flight tune sync and inspect the result
2. **Post-commit verification** — save operations verify that the committed working copy reached disk and contains the active editor text before clearing dirty state

The temporary post-barline grace playback workaround was removed. Playback should stay closer to abc2svg defaults.

## Findings

### [MEDIUM] Early return in epoch-mismatch path does not reset `inFlight` flag

**File:** `src/renderer/renderer.js:3775-3777`

```javascript
if (epoch !== workingCopyTuneSyncEpoch) {
  result = { ok: false, stale: true, error: "Working copy tune sync was superseded." };
  return result;
}
```

This early return happens **inside the `runPromise` IIFE**, but **before** the `finally` block that resets `workingCopyTuneSyncInFlight`. This is correct because the finally block wraps the entire `runPromise`.

However, if the `epoch` check fails early (at line 3775-3777), the `inFlight` flag will be reset by the finally block. This is the intended behavior.

**Verdict:** OK — the finally block correctly handles this case.

---

### [LOW] Potential stale state in `performAppendFlow` without explicit sync

**File:** `src/renderer/renderer.js:21696-21698`

```javascript
const nextX = getNextXNumber(String(snap.text || ""));
const prepared = ensureXNumberInAbc(editorText, nextX);
const afterTuneIndex = Array.isArray(snap.tunes) ? (snap.tunes.length - 1) : -1;
```

**Observation:** Unlike `performSaveFlow` which now calls `flushWorkingCopyTuneSync()`, `performAppendFlow` does not. However, `performAppendFlow` already has its own logic to get the snapshot and refresh it. This may be intentional since appending adds a new tune rather than updating an existing one.

**Verdict:** OK — append reads the current editor text directly and inserts it as a new tune, while replace-save must synchronize an existing tune slice before commit.

---

## Verification Results

- ✅ All tests pass (`npm run test:renderer-build`)
- ✅ All quick tests pass (`npm run test:quick`)
- ✅ Save intent guards are enforced correctly
- ✅ Working copy sync returns explicit result objects
- ✅ Post-commit verification refuses to clear dirty state if disk content does not match the committed working copy

## Recommendations

1. Keep save verification in the strict-write path; false-success Save is a data-loss bug.
2. Continue simplifying playback toward upstream abc2svg behavior in a separate branch.

## Positive Observations

- The explicit result object pattern (`{ ok: true/false, error?, stale? }`) improves error handling
- The `finally` block correctly cleans up the `runPromise` reference
- The post-commit verification gives the UI a chance to report failure instead of silently clearing dirty state
