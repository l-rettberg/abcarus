function findHeaderEndOffset(content) {
  const text = String(content || "");
  // Horizontal whitespace only: `\s*` would consume blank lines after a header.
  const match = text.match(/^[\t ]*X:/m);
  if (!match) return text.length;
  return Number.isFinite(match.index) ? match.index : 0;
}

function splitFileIntoHeaderAndBody(content) {
  const text = String(content || "");
  const headerEnd = findHeaderEndOffset(text);
  return {
    headerText: text.slice(0, headerEnd),
    bodyText: text.slice(headerEnd),
  };
}

function countLinesForPrefix(text) {
  const value = String(text || "");
  if (!value.trim()) return 0;
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const withoutTrailingNewlines = normalized.replace(/\n+$/, "");
  if (!withoutTrailingNewlines) return 0;
  return withoutTrailingNewlines.split("\n").length;
}

export {
  countLinesForPrefix,
  findHeaderEndOffset,
  splitFileIntoHeaderAndBody,
};
