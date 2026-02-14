# Focus Playback Harness

Automated regression kit for Focus mode playback edge cases from Issue #21.

Run:

```bash
npm run test:focus-playback
```

Fixture:
- `fixtures/bouchard_x16_issue21.abc` (problematic tune used for regressions)

Checks:
- Segment range planning for:
  - `1-2` (with fallback start for first bar)
  - `3-6` (before repeats)
  - `8-18` (across reprise/voltas)
  - `15-16` (between volta bars)
  - `17-18` (after reprise)
- Loop ON/OFF invariance for resolved bounds.
- Suppress repeats ON/OFF range planning acceptance.
- Visible mode planning (`From/To` unset).
- Fail-closed invalid range (`From > To`).
- Muted voices filtering:
  - `2,3`
  - `1`
  - implicit/malformed `V:1` handling.

Implementation notes:
- Uses the vendored `third_party/abc2svg/abc2svg-1.js` parser in Node (`vm` sandbox).
- Reuses Focus planning logic structure from renderer (pure functions mirrored in harness).
