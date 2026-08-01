function matchBarToken(line, idx) {
  const src = String(line || "");
  const start = Number(idx) || 0;
  if (start < 0 || start >= src.length) return null;
  const ch = src[start];
  if (!ch) return null;
  // Barline tokens in ABC are composed of |, :, [, ], and the special dotted barline .|
  // Important: '[' is also used for chord notes (e.g. [CEG]), so only treat it as a barline
  // when it's clearly a barline/volta marker (e.g. [|, [], [1, [2).
  if (ch === ".") {
    if (start + 1 >= src.length || src[start + 1] !== "|") return null;
  } else if (ch === "[") {
    const next = start + 1 < src.length ? src[start + 1] : "";
    if (!(next === "|" || next === "]" || /[0-9]/.test(next))) return null;
  } else if (ch === ":") {
    const next = start + 1 < src.length ? src[start + 1] : "";
    // Prevent false positives on inline fields like "V:1" inside "[V:1 ...]".
    if (/[0-9]/.test(next)) return null;
  } else if (ch !== "|" && ch !== ":") {
    return null;
  }
  let end = start;
  while (end < src.length) {
    const c = src[end];
    if (c === ".") {
      if (end + 1 < src.length && src[end + 1] === "|") {
        end += 1;
        continue;
      }
      break;
    }
    if (!/[|[\]:]/.test(c)) break;
    end += 1;
  }
  while (end < src.length && /[0-9]/.test(src[end])) end += 1;
  if (end <= start) return null;
  return { token: src.slice(start, end), len: end - start };
}

export {
  matchBarToken,
};
