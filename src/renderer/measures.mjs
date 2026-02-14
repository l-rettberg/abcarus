function splitInlineComment(line) {
  const s = String(line || "");
  let idx = -1;
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] === "%" && s[i - 1] !== "\\") {
      idx = i;
      break;
    }
  }
  if (idx === -1) return { head: s, comment: "" };
  return { head: s.slice(0, idx), comment: s.slice(idx) };
}

function isAbcFieldLine(line) {
  const s = String(line || "");
  return /^[\t ]*[A-Za-z]:/.test(s) || /^[\t ]*%/.test(s);
}

function isInlineFieldOnlyLine(line) {
  const s = String(line || "").trim();
  if (!s.startsWith("[")) return false;
  // Lines like: [M:7/8][Q:1/4=220]
  return /^\[[A-Za-z]:/.test(s);
}

function hasInlineComment(line) {
  const s = String(line || "");
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] === "%" && s[i - 1] !== "\\") {
      // If there is non-whitespace before %, it's an inline comment.
      return Boolean(s.slice(0, i).trim());
    }
  }
  return false;
}

function consumeBarlineToken(src, start) {
  const s = String(src || "");
  const i = start;
  if (i < 0 || i >= s.length) return null;
  // Common bracketed barline: [|
  if (s.startsWith("[|", i)) return { text: "[|", end: i + 2 };
  // Common barline/repeat tokens with colon.
  if (s[i] === ":" && (s[i + 1] === ":" || s[i + 1] === "|")) {
    let j = i;
    while (j < s.length && (s[j] === ":" || s[j] === "|")) j += 1;
    return { text: s.slice(i, j), end: j };
  }
  // Standard barlines contain at least one '|'
  if (s[i] === "|") {
    let j = i;
    while (j < s.length) {
      const ch = s[j];
      if (ch === "|" || ch === ":" || ch === "]") {
        j += 1;
        continue;
      }
      if (ch === "[") {
        // Keep "[1", "[2", "[|" as barline-related continuations, but do not
        // consume inline fields like "[K:...]" into bar tokens.
        const next = s[j + 1] || "";
        if (/[0-9|:\]]/.test(next)) {
          j += 1;
          continue;
        }
      }
      break;
    }
    return { text: s.slice(i, j), end: j };
  }
  return null;
}

function reflowMeasuresInMusicLine(line, measuresPerLine) {
  const n = Math.max(1, Math.trunc(Number(measuresPerLine) || 0));
  if (!Number.isFinite(n) || n <= 0) return String(line || "");

  const { head, comment } = splitInlineComment(line);
  const src = String(head || "");
  const out = [];

  let count = 0;
  let i = 0;
  let inQuote = false;
  let inDecoration = false;
  let hasBarContent = false;

  while (i < src.length) {
    const ch = src[i];

    if (inQuote) {
      out.push(ch);
      if (ch === "\"") inQuote = false;
      i += 1;
      continue;
    }
    if (inDecoration) {
      out.push(ch);
      if (ch === "!") inDecoration = false;
      i += 1;
      continue;
    }

    if (ch === "\"") {
      inQuote = true;
      out.push(ch);
      i += 1;
      continue;
    }
    if (ch === "!") {
      inDecoration = true;
      out.push(ch);
      i += 1;
      continue;
    }

    // Preserve bracketed inline fields verbatim: [K:...], [V:...], [I:...], etc.
    if (ch === "[" && /[A-Za-z]:/.test(src.slice(i + 1, i + 3))) {
      const close = src.indexOf("]", i);
      if (close !== -1) {
        out.push(src.slice(i, close + 1));
        i = close + 1;
        continue;
      }
    }

    const bar = consumeBarlineToken(src, i);
    if (bar) {
      out.push(bar.text);
      i = bar.end;
      let didCount = false;
      if (hasBarContent) {
        count += 1;
        didCount = true;
      }
      const shouldBreak = didCount && (count % n === 0);
      hasBarContent = false;
      // Canonicalize whitespace after barlines so repeated reflows converge:
      // - if we don't break: collapse any horizontal whitespace to a single space (when there is remainder)
      // - if we break: drop leading whitespace on the next segment
      let k = i;
      while (k < src.length && (src[k] === " " || src[k] === "\t")) k += 1;
      if (k < src.length) {
        if (shouldBreak) {
          const beforeBreak = out[out.length - 1] || "";
          if (!/\n$/.test(beforeBreak)) out.push("\n");
          i = k;
        } else if (k > i) {
          out.push(" ");
          i = k;
        } else {
          // No whitespace after the barline. Insert a single space in common cases so
          // that repeated reflows converge to the same formatting.
          const nextCh = src[i];
          if (nextCh && !/\s/.test(nextCh) && !/[|:\]\[0-9]/.test(nextCh)) {
            out.push(" ");
          }
        }
      } else {
        i = k;
      }
      continue;
    }

    // Count a bar only when there was some musical content since the previous barline.
    // Include common rest tokens: z (rest), x (invisible rest), Z (multi-measure rest).
    if (/[A-Ga-gzxZ]/.test(ch)) hasBarContent = true;
    out.push(ch);
    i += 1;
  }

  // Never end with a newline: it would create an empty line after outer joins.
  if (out.length && out[out.length - 1] === "\n") out.pop();
  const rebuilt = out.join("");
  return rebuilt + (comment || "");
}

function parseLinebreakMarkerFromDirective(line) {
  const src = String(line || "");
  const m = src.match(/^\s*(?:I:|%%)\s*linebreak\b(.*)$/i);
  if (!m) return null;
  const { head } = splitInlineComment(m[1] || "");
  const body = String(head || "").trim();
  if (!body) return "$";
  return body[0] || "$";
}

function reflowMusicByLinebreakMarker(line, markerChar) {
  const src = String(line || "");
  const marker = String(markerChar || "$");
  if (!src || !marker) return src;
  const markerCh = marker[0];
  if (!markerCh || !src.includes(markerCh)) return src;

  const out = [];
  let i = 0;
  let inQuote = false;
  let inDecoration = false;

  while (i < src.length) {
    const ch = src[i];

    if (inQuote) {
      out.push(ch);
      if (ch === "\"") inQuote = false;
      i += 1;
      continue;
    }
    if (inDecoration) {
      out.push(ch);
      if (ch === "!") inDecoration = false;
      i += 1;
      continue;
    }
    if (ch === "\"") {
      inQuote = true;
      out.push(ch);
      i += 1;
      continue;
    }
    if (ch === "!") {
      inDecoration = true;
      out.push(ch);
      i += 1;
      continue;
    }

    if (ch === markerCh && src[i - 1] !== "\\") {
      out.push(ch);
      i += 1;
      while (i < src.length && (src[i] === " " || src[i] === "\t")) i += 1;
      if (i < src.length && src[i] === "%") {
        out.push(" ");
        out.push(src.slice(i).trimEnd());
        i = src.length;
      }
      if (i < src.length) out.push("\n");
      continue;
    }

    out.push(ch);
    i += 1;
  }

  if (out.length && out[out.length - 1] === "\n") out.pop();
  return out.join("");
}

export function normalizeMeasuresLineBreaks(text) {
  const lines = String(text || "").split(/\r\n|\n|\r/);
  const out = [];
  let inTextBlock = false;
  for (let i = 0; i < lines.length; i += 1) {
    let line = lines[i];
    if (/^\s*%%\s*begintext\b/i.test(line)) inTextBlock = true;
    if (inTextBlock) {
      out.push(line);
      if (/^\s*%%\s*endtext\b/i.test(line)) inTextBlock = false;
      continue;
    }
    const next = lines[i + 1];
    const prev = out.length ? out[out.length - 1] : "";
    const nextIsComment = next && /^\s*%/.test(next);
    const prevIsComment = /^\s*%/.test(prev || "");
    if (/^\s*%Error\b/i.test(line)) {
      out.push("%");
      continue;
    }
    if (next && /^\s*%/.test(next) && /\\\s*$/.test(line)) {
      line = line.replace(/\\\s*$/, "");
    }
    if (line.trim() === "\\") {
      out.push("%");
      continue;
    }
    // Guard: blank lines terminate tunes in ABC. Only allow them as tune separators (before next X:) or inside begintext.
    if (!line.trim()) {
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j += 1;
      while (j < lines.length && /^\s*%/.test(lines[j])) j += 1;
      const nextNonEmpty = j < lines.length ? lines[j] : "";
      const looksLikeTuneSeparator = !nextNonEmpty || /^\s*X:/.test(nextNonEmpty);
      if (looksLikeTuneSeparator) {
        out.push("");
      } else if (nextIsComment || prevIsComment) {
        out.push("%");
      } else {
        // Replace accidental blank line with a harmless comment to avoid truncating the tune.
        out.push("%");
      }
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

export function transformMeasuresPerLine(abcText, measuresPerLine) {
  const n = Math.max(1, Math.trunc(Number(measuresPerLine) || 0));
  if (!Number.isFinite(n) || n <= 0) return String(abcText || "");

  const lines = String(abcText || "").split(/\r\n|\n|\r/);
  const out = [];
  let inTextBlock = false;
  let pendingMusic = null;

  const flushPending = () => {
    if (!pendingMusic) return;
    out.push(reflowMeasuresInMusicLine(pendingMusic, n));
    pendingMusic = null;
  };

  for (const line of lines) {
    if (/^\s*%%\s*begintext\b/i.test(line)) inTextBlock = true;
    if (inTextBlock) {
      flushPending();
      out.push(line);
      if (/^\s*%%\s*endtext\b/i.test(line)) inTextBlock = false;
      continue;
    }
    if (!line) {
      flushPending();
      out.push(line);
      continue;
    }
    if (isAbcFieldLine(line)) {
      flushPending();
      out.push(line);
      continue;
    }
    if (isInlineFieldOnlyLine(line)) {
      flushPending();
      out.push(line);
      continue;
    }
    if (hasInlineComment(line)) {
      flushPending();
      out.push(reflowMeasuresInMusicLine(line, n));
      continue;
    }

    // Merge adjacent music lines so that changing measures-per-line can reflow existing output.
    if (!pendingMusic) {
      pendingMusic = line;
    } else {
      const prefix = pendingMusic.match(/^\s*/)?.[0] || "";
      const left = pendingMusic.trimEnd();
      const right = line.trimStart();
      // Preserve common first/second ending syntax when it lands on a line boundary: `|1` / `|2`.
      if (left.endsWith("|") && /^[0-9]/.test(right)) {
        pendingMusic = `${prefix}${left.trim()}${right}`;
      } else {
        pendingMusic = `${prefix}${left.trim()} ${right}`;
      }
    }
  }
  flushPending();
  return out.join("\n");
}

export function transformMeasuresByLinebreakMarker(abcText, markerOverride) {
  const lines = String(abcText || "").split(/\r\n|\n|\r/);
  const out = [];
  let inTextBlock = false;
  let pendingMusic = null;
  let pendingComments = [];
  let currentMarker = String(markerOverride || "").trim();
  if (!currentMarker) currentMarker = "$";
  currentMarker = currentMarker[0] || "$";

  const flushPending = () => {
    if (!pendingMusic) return;
    const rebuilt = reflowMusicByLinebreakMarker(pendingMusic, currentMarker);
    const chunks = String(rebuilt || "").split("\n");
    if (chunks.length && pendingComments.length) {
      const tail = pendingComments.join(" ").trim();
      if (tail) chunks[chunks.length - 1] = `${chunks[chunks.length - 1]} ${tail}`;
      pendingComments = [];
    }
    out.push(...chunks);
    pendingMusic = null;
  };

  for (const line of lines) {
    if (/^\s*%%\s*begintext\b/i.test(line)) inTextBlock = true;
    if (inTextBlock) {
      flushPending();
      out.push(line);
      if (/^\s*%%\s*endtext\b/i.test(line)) inTextBlock = false;
      continue;
    }
    const nextMarker = parseLinebreakMarkerFromDirective(line);
    if (nextMarker) {
      flushPending();
      out.push(line);
      if (!markerOverride) currentMarker = nextMarker;
      continue;
    }
    if (!line) {
      flushPending();
      out.push(line);
      continue;
    }
    if (isAbcFieldLine(line)) {
      flushPending();
      out.push(line);
      continue;
    }
    if (isInlineFieldOnlyLine(line)) {
      flushPending();
      out.push(line);
      continue;
    }
    if (hasInlineComment(line)) {
      // Keep marker comments (e.g. `$ % 12`) attached to the same reflow chunk.
      // If there is pending music, merge this commented line into it and flush once.
      const { head, comment } = splitInlineComment(line);
      const markerInHead = String(head || "").includes(currentMarker);
      if (pendingMusic && markerInHead) {
        const prefix = pendingMusic.match(/^\s*/)?.[0] || "";
        const left = pendingMusic.trimEnd();
        const right = String(line || "").trimStart();
        if (left.endsWith("|") && /^[0-9]/.test(right)) {
          pendingMusic = `${prefix}${left.trim()}${right}`;
        } else {
          pendingMusic = `${prefix}${left.trim()} ${right}`;
        }
        flushPending();
      } else if (pendingMusic) {
        const prefix = pendingMusic.match(/^\s*/)?.[0] || "";
        const left = pendingMusic.trimEnd();
        const right = String(head || "").trimStart();
        if (left.endsWith("|") && /^[0-9]/.test(right)) {
          pendingMusic = `${prefix}${left.trim()}${right}`;
        } else {
          pendingMusic = `${prefix}${left.trim()} ${right}`;
        }
        const c = String(comment || "").trim();
        if (c) pendingComments.push(c);
      } else {
        flushPending();
        const rebuilt = reflowMusicByLinebreakMarker(line, currentMarker);
        out.push(...String(rebuilt || "").split("\n"));
      }
      continue;
    }

    if (!pendingMusic) {
      pendingMusic = line;
    } else {
      const prefix = pendingMusic.match(/^\s*/)?.[0] || "";
      const left = pendingMusic.trimEnd();
      const right = line.trimStart();
      if (left.endsWith("|") && /^[0-9]/.test(right)) {
        pendingMusic = `${prefix}${left.trim()}${right}`;
      } else {
        pendingMusic = `${prefix}${left.trim()} ${right}`;
      }
    }
  }

  flushPending();
  return out.join("\n");
}
