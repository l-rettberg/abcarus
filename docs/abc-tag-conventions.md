# ABC Library Metadata Conventions

Status: accepted for Library indexing. Existing files are not rewritten automatically.

This document defines a consistent way to store catalog metadata in ABC headers without overloading musical control fields.

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

### `C:` and `N:[lyricist]` for writing credits

Keep `C:` limited to the composer. ABC has no dedicated lyricist field, so
store a known author of the words as a namespaced note:

```abc
C:Dede Efendi
N:[lyricist] Enderûnî Vâsıf
```

Use `N:[lyricist] Anonymous` when the source explicitly identifies the words
as anonymous. Omit the field when the lyricist is merely unknown (`?`, `-`,
or an empty source value). Do not reinterpret ordinary prose in `N:` as a
lyricist credit merely because it mentions lyrics or a writer.

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
- The standard Library facets are `[makam]`, `[form]`, `[repertoire]`, `[cultural]`, and `[period]`.
- Other valid namespaces remain ABC text, are indexed for search, and appear as discovered `G (namespace)` grouping options.
- `N:[lyricist]` is a writing credit, not a `G:` catalog facet.

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

## Renaming catalog categories

Selected Library metadata groups can be renamed from their context menu or
merged by dragging one category onto another. The allowlist is deliberately
small: namespaced `G:[xyz]`, plain `G:`, and `C:`. Source and target must belong
to the same field and, for namespaced `G:`, the same namespace. For example,
`G:[makam] Old` may become `G:[makam] New`, but it cannot be dropped onto a
`G:[form]` or plain `G:` category. Likewise, a composer group can only be
merged with another `C:` composer group.

The operation updates matching tune headers in every affected Library file,
then reindexes those files. Multi-file changes use guarded atomic writes and
application-level rollback. Matching is against the complete normalized field
value rather than a substring. File headers, unrelated fields, and other facet
namespaces are not changed.

## Non-goals

- No automatic makam detection from melody.
- No mass rewrite of structural musical fields (`K:`, `M:`, `L:`, `Q:`).
- No silent category aliases or automatic metadata rewrites.
