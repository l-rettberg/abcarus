# ABC Library Metadata Conventions

Status: accepted for Library indexing. Existing files are not rewritten automatically.

This document proposes a consistent way to store makam/usul metadata in ABC headers without overloading musical control fields.

## Goals

- Keep playback-related headers semantically clean.
- Make Library Catalog filtering/grouping predictable.
- Support safe future batch updates (`add/append`) on selected tunes.

## Proposed convention

### `R:` for usul/rhythm

Use `R:` for rhythmic type/usul only.

Example:

```abc
R:Aksak semai
```

### `G:` for namespaced categories

Use `G:` as a category field with an explicit namespace marker at the start of the value:

```abc
G:[makam] Rast
G:[form] Saz semaisi
G:[repertoire] TRT
G:[cultural] Ottoman Armenian
G:[period] Contemporary
```

Rationale:
- avoids using extra `:` in `G:` values;
- keeps makam distinct from other grouping tags;
- remains human-readable and simple to parse.

## Constraints

- At most one `G:[makam] ...` per tune (recommended).
- Multiple `G:` lines are allowed. A tune may therefore appear in more than one Library group.
- `R:` and `G:` should not be used interchangeably.
- The supported Library facets are `[makam]`, `[form]`, `[repertoire]`, `[cultural]`, and `[period]`.
- Unknown namespaces remain valid ABC text and are indexed for text search, but do not receive a dedicated grouping control.

## Parsing rule (for tooling)

For `G:` value:

- Namespace pattern: `^\[([A-Za-z][A-Za-z0-9_-]*)\]\s*(.+)$`
- If pattern matches:
  - `namespace = group(1).toLowerCase()`
  - `payload = group(2).trim()`
- If no pattern matches:
  - treat as legacy plain `G:` value.

## Migration guidance (optional)

If makam names currently appear in `T:`, migration should be conservative:

1. select candidate tunes in Library Catalog;
2. preview inferred makam values;
3. apply only `add if missing` to `G:[makam] ...`;
4. skip tunes that already have `G:[makam] ...`.

Do not rewrite `T:` automatically in v1.

The Library index reads these fields only as catalog metadata. It must not infer or rewrite them from technical notation fields such as `K:`, `M:`, `L:`, `Q:`, `V:`, `I:`, or `%%` directives.

## Non-goals

- No automatic makam detection from melody.
- No mass rewrite of structural musical fields (`K:`, `M:`, `L:`, `Q:`).
- No destructive bulk replace in first implementation.
