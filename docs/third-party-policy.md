# Third-Party Boundary Policy

`third_party/**` is a vendored upstream area. Treat it as read-only during feature work.

## Allowed Changes

- A coherent upstream upgrade from a source/archive/build snapshot.
- Version/provenance metadata that belongs with the vendored artifact.
- License and notice updates required by the upstream component.
- Deterministic lock files for external runtimes, such as `third_party/python-embed/*/python-build-standalone.lock.json`.

## Not Allowed

- Hand-editing vendored runtime files to fix ABCarus behavior.
- Keeping local build state, caches, logs, temporary archives, or extracted workdirs in git.
- Placing ABCarus-owned adapters, recipes, wrappers, or tests inside `third_party/**`.
- Mixing a third-party upgrade with app behavior changes in the same commit.

## If Upstream Behavior Needs Adjustment

Prefer this order:

1. Fix ABCarus adapter/payload code outside `third_party/**`.
2. Report or verify the issue upstream with a minimal reproduction.
3. Upgrade to an upstream snapshot that contains the fix.
4. Use a local third-party patch only as a documented exception with an upstream artifact ID and removal plan.

## Review Rule

Before committing any `third_party/**` change, run the third-party boundary check and the relevant component harnesses.
