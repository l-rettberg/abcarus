const CHORDPRO_ABC_START_RE = /\{start_of_abc\b/i;
const CHORDPRO_ABC_END_RE = /\{end_of_abc\b/i;

function isChordProText(text) {
  const src = String(text || "");
  return CHORDPRO_ABC_START_RE.test(src) || CHORDPRO_ABC_END_RE.test(src);
}

function isChordProFilePath(filePath) {
  const p = String(filePath || "").toLowerCase();
  return p.endsWith(".cho") || p.endsWith(".chordpro") || p.endsWith(".chopro") || p.endsWith(".chord") || p.endsWith(".crd") || p.endsWith(".pro");
}

function extractChordProLabel(rawArgs) {
  const args = String(rawArgs || "").trim();
  if (!args) return "";
  const kvMatch = args.match(/\b(label|title)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s}]+))/i);
  if (kvMatch) return (kvMatch[2] || kvMatch[3] || kvMatch[4] || "").trim();
  const colonMatch = args.match(/^\s*:\s*(.+)$/);
  if (colonMatch) return String(colonMatch[1] || "").trim();
  return args.trim();
}

function parseChordProBlocks(text) {
  const src = String(text || "");
  const blocks = [];
  const warnings = [];
  let open = null;
  let lineStart = 0;
  let lineNo = 1;

  while (lineStart <= src.length) {
    let lineEnd = lineStart;
    while (lineEnd < src.length && src[lineEnd] !== "\n" && src[lineEnd] !== "\r") lineEnd += 1;
    const line = src.slice(lineStart, lineEnd);
    let breakLen = 0;
    if (lineEnd < src.length) {
      if (src[lineEnd] === "\r" && src[lineEnd + 1] === "\n") breakLen = 2;
      else breakLen = 1;
    }

    const trimmed = line.trim();
    const startMatch = trimmed.match(/^\{start_of_abc\b([^}]*)\}$/i);
    const endMatch = trimmed.match(/^\{end_of_abc\b[^}]*\}$/i);
    if (startMatch) {
      if (open) {
        warnings.push({ kind: "abc-start-nested", line: lineNo });
        const endOffset = lineStart;
        const endLine = Math.max(open.startLine, lineNo - 1);
        blocks.push({
          ...open,
          endOffset,
          endLine,
          text: src.slice(open.startOffset, endOffset),
        });
      }
      const args = startMatch[1] ? startMatch[1].trim() : "";
      open = {
        startOffset: lineEnd + breakLen,
        startLine: lineNo + 1,
        label: extractChordProLabel(args),
        directiveLine: lineNo,
      };
    } else if (endMatch) {
      if (!open) {
        warnings.push({ kind: "abc-end-without-start", line: lineNo });
      } else {
        const endOffset = lineStart;
        const endLine = Math.max(open.startLine, lineNo - 1);
        blocks.push({
          ...open,
          endOffset,
          endLine,
          text: src.slice(open.startOffset, endOffset),
        });
        open = null;
      }
    }

    if (lineEnd >= src.length) break;
    lineStart = lineEnd + breakLen;
    lineNo += 1;
  }

  if (open) {
    warnings.push({ kind: "abc-start-without-end", line: open.directiveLine || open.startLine });
    blocks.push({
      ...open,
      endOffset: src.length,
      endLine: lineNo,
      text: src.slice(open.startOffset),
    });
  }

  return { blocks, warnings };
}

export {
  extractChordProLabel,
  isChordProFilePath,
  isChordProText,
  parseChordProBlocks,
};
