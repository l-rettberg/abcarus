ADR-0013 — Agent “State Claims” Require Verification

Date: 2026-01-31  
Status: Accepted

## Context

In ABCarus we frequently discuss whether a feature/change is:
- already implemented on `master`,
- only present on a feature branch, or
- present in code but not wired into the runtime.

We observed unproductive loops when an agent answers “yes/no” based on an incomplete signal:
- looking only at the currently checked-out branch,
- searching for code symbols without checking merge history,
- or assuming a feature is “not merged” because it is also present on a named branch.

This wastes time and increases mistrust, especially because ABCarus has:
- many long-lived branches,
- frequent merges,
- large renderer files where small wiring changes are easy to miss.

## Decision

When making any **state claim** (e.g., “X is merged”, “X is not merged”, “X exists only in branch Y”, “X is already in master”), the agent must perform and cite (in the response) **both** of the following checks:

1. **Merge-history check (source of truth for branch inclusion)**
   - Inspect the `master` graph for merges that include the relevant commit(s) or branch merges.
   - Example commands:
     - `git log --graph --oneline --decorate -30`
     - `git merge-base --is-ancestor <commit> master`

2. **Code-presence check (source of truth for runtime availability)**
   - Verify that the relevant symbols/wiring exist in the working tree.
   - Example commands:
     - `git grep -n "<symbol>" -- <paths...>`
     - `git show master:<path> | grep ...` (if needed)

### Required response format (minimal)

State claims must include a short “evidence line”:

- `Evidence: merged=<yes/no> (commit/merge id …); code=<yes/no> (files …).`

## Consequences

Positive:
- Fewer “yes/no” flips and rework loops.
- Faster diagnosis when the real issue is runtime wiring vs merge state.
- Higher user trust in agent answers.

Negative / trade-offs:
- Slightly slower first response (two quick checks).
- Requires discipline even under time pressure.

## Notes

This ADR does not change how features are designed; it only constrains how agents **assert implementation state** during coordination and debugging.

