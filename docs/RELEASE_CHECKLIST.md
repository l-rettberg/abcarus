# Release checklist (practical)

This is a step-by-step guide for making a release build and pushing it to GitHub.

## TL;DR (3–5 commands)

1) Update [CHANGELOG.md](../CHANGELOG.md) under `## [Unreleased]`.
2) Run `npm run test:release-preflight` and resolve every failure.
3) Run one:
   - `npm run release:patch`
   - `npm run release:minor`
   - `npm run release:major`
4) Push commit + tag:
   - `git push`
   - `git push origin vX.Y.Z`
4) Verify the GitHub Actions run for tag `vX.Y.Z` is green (all jobs), then do a quick sanity check.

CLI alternative (no browser, using GitHub CLI):
- `gh auth status`
- `gh run list -L 10 --workflow release-assets.yml`
- `gh release view vX.Y.Z`

Where to find:
- High-level policy: [docs/RELEASES.md](RELEASES.md)
- This checklist: [docs/RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)
- User-facing changelog: [CHANGELOG.md](../CHANGELOG.md)
- Generated release notes (per release): [docs/RELEASE_NOTES.md](RELEASE_NOTES.md)

---

## 0) Preconditions

- You are on the right branch (usually `master`).
- You can run the app locally: `npm start`
- AppImage toolchain is available (see [scripts/README.md](../scripts/README.md)).

## Local-only files (do not commit)

This repo intentionally keeps some things local (debug dumps, personal scripts, etc.).

- Repo-shared ignores live in `.gitignore` (tracked and pushed to GitHub).
- Personal/host-specific ignores should NOT go into `.gitignore`.
  Use one of:
  - `.git/info/exclude` (applies only to your clone)
  - your global git ignore file (e.g. `~/.config/git/ignore`)

## 1) Prepare the release message

You typically want:
- a short commit subject (used on GitHub commit list)
- an optional longer body (details)

Example:
- Subject: `release: v0.12.2`
- Body: a few bullet points, one per major change.

## 2) Update CHANGELOG (and optional local devlog)

The repository release flow is driven by `scripts/release.mjs` (via `npm run release:*`), which:
- requires a non-empty `## [Unreleased]` section and an unused next tag before running preflight or changing files
- bumps versions in `package.json` (+ `package-lock.json`)
- moves the current [CHANGELOG.md](../CHANGELOG.md) `## [Unreleased]` section into a dated `## [X.Y.Z] - YYYY-MM-DD` entry
- creates an annotated git tag `vX.Y.Z`
- verifies that the new tag points to the release commit before reporting success
- requires a clean git working tree (no uncommitted changes)
- runs the release preflight before changing the version or creating a tag

Manual (optional):
- Append local devlog entry:
  - `node scripts/chat-log.mjs -m "your message" --notes "optional notes"`
- Edit [CHANGELOG.md](../CHANGELOG.md):
  - Ensure `## [Unreleased]` exists.
  - Add a new `## [X.Y.Z] - YYYY-MM-DD` section right under it.

## 3) Release (recommended)

This flow bumps the version, updates release docs, commits, and creates a tag:

1) Ensure the changelog update is committed and the working tree is clean.
2) Run one of:
   - `npm run release:patch`
   - `npm run release:minor`
   - `npm run release:major`

3) Push commit and tag only after the release command reports success:
   - `git push`
   - `git push origin vX.Y.Z`

Notes:
- The user-facing release notes are the [CHANGELOG.md](../CHANGELOG.md) entry for `vX.Y.Z`.
- Tag pushes trigger GitHub Actions (including `.github/workflows/release-assets.yml`) which builds and uploads artifacts to the GitHub Release for that tag.

Tip: if you don’t want to use the browser, you can confirm the release and attached assets via:
- `gh release view vX.Y.Z`

## 4) Push (if skipped earlier)

- `git push origin master`
- `git push origin vX.Y.Z`

## 5) GitHub Release notes (automatic)

Release notes are now generated automatically from [CHANGELOG.md](../CHANGELOG.md):
- workflow: `.github/workflows/release-assets.yml`
- source: section `## [X.Y.Z] - ...` that matches the pushed tag `vX.Y.Z`

What this means:
- Keep `## [Unreleased]` accurate before running `npm run release:*`.
- After tag push, the workflow creates/updates the GitHub Release body from that changelog section.
- Assets are uploaded by CI in the same workflow.

Manual rebuild/re-upload (if needed):
- run workflow `release-assets.yml` with:
  - `ref: vX.Y.Z`
  - `publish: true`

## 6) Troubleshooting AppImage build

If you see errors about FUSE (/dev/fuse) or runtime download:

- You can run AppImage-based tools without FUSE via:
  - `APPIMAGE_EXTRACT_AND_RUN=1`
- `appimagetool` may need a runtime file (`runtime-x86_64`).
  - Place it at: `dist/appimage/runtime-x86_64`
  - Then rebuild using `appimagetool --runtime-file dist/appimage/runtime-x86_64 ...`

## Local helpers (not in git)

Some contributors keep optional convenience scripts under `scripts/local/` (gitignored).
They are not required for the release process.

## 7) Cross-platform file-open sanity checks (.abc association)

Before publishing, quickly verify that opening an `.abc` file from the OS shell/file manager
routes into ABCarus correctly (especially when one instance is already running).

- Linux (AppImage / desktop entry):
  - Double-click an `.abc` in file manager.
  - Expected: ABCarus opens that file.
  - If ABCarus is already open: no second UI instance; existing window focuses and opens the requested file.
- Windows (portable / installer build):
  - Use "Open with ABCarus" on a `.abc`.
  - Expected: file opens directly; repeated open requests route to the same running instance.
- macOS (`.dmg` app):
  - Open `.abc` from Finder ("Open with ABCarus").
  - Expected: existing app instance receives file-open event and opens requested file.

Failure hints:
- If app opens but wrong file is loaded, inspect startup argv handling in `src/main/index.js` (`parseCliOptions`, second-instance flow).
- If file association exists but nothing opens, verify platform launcher metadata (`.desktop` on Linux, app registration on Windows/macOS).
