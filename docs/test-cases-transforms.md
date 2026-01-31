# Transform Test Cases (Manual)

ABCarus has no automated tests. Use these manual checks after changing any text transforms.

## TC-TX-01: Note length scaling ignores inline fields + decorations

1. Open a tune containing:
   - inline fields like `[K:D]`, `[M:4/4]`
   - decorations like `!fermata!` or `H` (abc2svg shorthand)
2. Run `Tools → Transform → Note Length → Double` (or Half).
3. Expected:
   - note/rest durations scale (e.g. `d2` → `d4`, `z4` → `z8`)
   - decorations are unchanged (`!fermata!` stays `!fermata!`, `H` stays `H`)
   - inline fields are unchanged (`[K:D]` stays `[K:D]`)

## TC-TX-02: Note length scaling ignores chord symbols + comments

1. In a tune body, include:
   - chord symbols like `"Dm"` `"G7"`
   - comments like `% this is a comment with A B C`
2. Run `Tools → Transform → Note Length → Double` (or Half).
3. Expected:
   - chord symbol text unchanged
   - comment text unchanged

