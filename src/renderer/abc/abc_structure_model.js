function isInlineFieldOnlyLine(rawLine) {
  const trimmed = String(rawLine || "").trim();
  if (!trimmed.startsWith("[")) return false;
  let rest = trimmed;
  while (true) {
    const match = rest.match(/^\[\s*[A-Za-z]+\s*:\s*[^\]]*\]\s*/);
    if (!match) break;
    rest = rest.slice(match[0].length);
  }
  const tail = rest.trim();
  return !tail || tail.startsWith("%");
}

function detectKeyFieldNotLastBeforeBody(text) {
  const lines = String(text || "").split(/\r\n|\n|\r/);
  const isTuneStart = (line) => /^\s*X:/.test(line);
  const isFieldLine = (line) => /^\s*[A-Za-z]:/.test(line);
  const isContinuationLine = (line) => /^\s*\+:\s*/.test(line);
  const isKeyLine = (line) => /^\s*K:/.test(line);
  const isPartLine = (line) => /^\s*P:/.test(line);
  const isCommentLine = (line) => /^\s*%/.test(line);
  const isDirectiveLine = (line) => /^\s*%%/.test(line);
  const beginsBlock = (trimmed) => {
    if (!/^%%\s*begin/i.test(trimmed)) return null;
    if (/^%%\s*begintext\b/i.test(trimmed)) return "text";
    if (/^%%\s*beginsvg\b/i.test(trimmed)) return "svg";
    if (/^%%\s*beginps\b/i.test(trimmed)) return "ps";
    return "other";
  };
  const endsBlock = (trimmed, block) => {
    if (!block) return false;
    if (block === "text") return /^%%\s*endtext\b/i.test(trimmed);
    if (block === "svg") return /^%%\s*endsvg\b/i.test(trimmed);
    if (block === "ps") return /^%%\s*endps\b/i.test(trimmed);
    if (block === "other") return /^%%\s*end/i.test(trimmed);
    return false;
  };

  const scanTune = (start, end) => {
    let keyIndex = -1;
    for (let index = start; index < end; index += 1) {
      if (isKeyLine(lines[index])) {
        keyIndex = index;
        break;
      }
    }
    if (keyIndex < 0) return null;

    let block = null;
    let bodyStart = end;
    for (let index = keyIndex + 1; index < end; index += 1) {
      const raw = lines[index];
      const trimmed = raw.trim();
      if (block) {
        if (endsBlock(trimmed, block)) block = null;
        continue;
      }
      const begin = beginsBlock(trimmed);
      if (begin) {
        block = begin;
        continue;
      }
      if (!trimmed || isCommentLine(raw)) continue;
      if (isPartLine(raw) || isInlineFieldOnlyLine(raw)) {
        bodyStart = index;
        break;
      }
      if (isDirectiveLine(raw) || isFieldLine(raw) || isContinuationLine(raw)) continue;
      bodyStart = index;
      break;
    }

    let firstOffender = null;
    for (let index = keyIndex + 1; index < bodyStart; index += 1) {
      const raw = lines[index];
      const trimmed = raw.trim();
      if (!trimmed || isCommentLine(raw)) continue;
      if (isDirectiveLine(raw) || isFieldLine(raw) || isContinuationLine(raw)) {
        firstOffender = { line: index + 1, text: raw };
        break;
      }
    }
    if (!firstOffender) return null;

    let tuneLabel = null;
    for (let index = start; index < end; index += 1) {
      const match = String(lines[index] || "").match(/^\s*X:\s*(\d+)/);
      if (match) {
        tuneLabel = `X:${match[1]}`;
        break;
      }
    }
    return {
      kind: "abc2svg-k-field-not-last",
      loc: { line: firstOffender.line, col: 1 },
      detail: `${tuneLabel ? `${tuneLabel}: ` : ""}K: is not the last header field before the music. abc2svg playback may fail when directives/fields appear after K:.`,
    };
  };

  let start = 0;
  let sawTuneStart = false;
  for (let index = 0; index < lines.length; index += 1) {
    if (!isTuneStart(lines[index])) continue;
    if (sawTuneStart) {
      const warning = scanTune(start, index);
      if (warning) return warning;
    }
    sawTuneStart = true;
    start = index;
  }
  return scanTune(sawTuneStart ? start : 0, lines.length) || null;
}

export {
  detectKeyFieldNotLastBeforeBody,
  isInlineFieldOnlyLine,
};
