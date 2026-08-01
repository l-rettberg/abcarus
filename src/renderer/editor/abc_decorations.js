import {
  Decoration,
  RangeSetBuilder,
  ViewPlugin,
} from "../../../third_party/codemirror/cm.js";

function buildAbcDecorations(state) {
  const builder = new RangeSetBuilder();
  let inTextBlock = false;
  let inDrumBlock = false;
  let lastNonEmptyKind = "";

  const findFirstUnescapedPercent = (text) => {
    for (let i = 0; i < text.length; i += 1) {
      if (text[i] === "%" && text[i - 1] !== "\\") return i;
    }
    return -1;
  };

  const collectChordQuoteRanges = (text) => {
    const ranges = [];
    let inQuote = false;
    let start = 0;
    for (let i = 0; i < text.length; i += 1) {
      if (text[i] !== "\"") continue;
      if (text[i - 1] === "\\") continue;
      if (!inQuote) {
        inQuote = true;
        start = i;
        continue;
      }
      inQuote = false;
      ranges.push({ start, end: i + 1 });
    }
    if (inQuote) ranges.push({ start, end: text.length });
    return ranges;
  };

  const addDrumLineDecorations = (line, text) => {
    if (!text.length) return;
    builder.add(line.from, line.to, Decoration.mark({ class: "cm-abc-drum-line" }));
    const m = text.match(/^(\s*)([A-Za-z0-9][A-Za-z0-9]?)(\s+)(\|.*\|)\s*$/);
    if (!m) return;
    const keyStart = m[1].length;
    const keyEnd = keyStart + m[2].length;
    const seqStart = keyEnd + m[3].length;
    const seq = m[4] || "";
    const isPattern = /^[-ox|]+$/.test(seq);
    builder.add(line.from + keyStart, line.from + keyEnd, Decoration.mark({ class: "cm-abc-drum-key" }));
    for (let i = 0; i < seq.length; i += 1) {
      const ch = seq[i];
      const from = line.from + seqStart + i;
      const to = from + 1;
      if (ch === "|") {
        builder.add(from, to, Decoration.mark({ class: "cm-abc-drum-bar" }));
      } else if (isPattern && (ch === "o" || ch === "x")) {
        builder.add(from, to, Decoration.mark({ class: "cm-abc-drum-hit" }));
      } else if (isPattern && ch === "-") {
        builder.add(from, to, Decoration.mark({ class: "cm-abc-drum-rest" }));
      } else if (!isPattern && ch !== " " && ch !== "-") {
        builder.add(from, to, Decoration.mark({ class: "cm-abc-drum-instrument" }));
      }
    }
  };

  for (let lineNo = 1; lineNo <= state.doc.lines; lineNo += 1) {
    const line = state.doc.line(lineNo);
    const text = line.text;
    const trimmed = text.trim();

    if (/^%%\s*begindrum\b/i.test(text)) {
      builder.add(line.from, line.to, Decoration.mark({ class: "cm-abc-directive cm-abc-drum-directive" }));
      inDrumBlock = true;
      lastNonEmptyKind = "directive";
      continue;
    }

    if (/^%%\s*enddrum\b/i.test(text)) {
      builder.add(line.from, line.to, Decoration.mark({ class: "cm-abc-directive cm-abc-drum-directive" }));
      inDrumBlock = false;
      lastNonEmptyKind = "directive";
      continue;
    }

    if (inDrumBlock) {
      addDrumLineDecorations(line, text);
      if (trimmed) lastNonEmptyKind = "directive";
      continue;
    }

    if (/^%%\s*begintext\b/i.test(text)) {
      builder.add(line.from, line.to, Decoration.mark({ class: "cm-abc-directive" }));
      inTextBlock = true;
      lastNonEmptyKind = "directive";
      continue;
    }

    if (/^%%\s*endtext\b/i.test(text)) {
      builder.add(line.from, line.to, Decoration.mark({ class: "cm-abc-directive" }));
      inTextBlock = false;
      lastNonEmptyKind = "directive";
      continue;
    }

    if (inTextBlock) {
      if (text.length) {
        builder.add(line.from, line.to, Decoration.mark({ class: "cm-abc-textblock" }));
      }
      continue;
    }

    if (/^%%/.test(text)) {
      builder.add(line.from, line.to, Decoration.mark({ class: "cm-abc-directive" }));
      if (trimmed) lastNonEmptyKind = "directive";
      continue;
    }

    if (/^%/.test(text)) {
      builder.add(line.from, line.to, Decoration.mark({ class: "cm-abc-comment" }));
      if (trimmed) lastNonEmptyKind = "comment";
      continue;
    }

    if (/^w:/.test(text)) {
      builder.add(line.from, line.to, Decoration.mark({ class: "cm-abc-lyric-inline" }));
      if (trimmed) lastNonEmptyKind = "lyrics";
      continue;
    }

    if (/^W:/.test(text)) {
      builder.add(line.from, line.to, Decoration.mark({ class: "cm-abc-lyric-block" }));
      if (trimmed) lastNonEmptyKind = "lyrics";
      continue;
    }

    if (/^[A-Z]:/.test(text)) {
      builder.add(line.from, line.to, Decoration.mark({ class: "cm-abc-header" }));
      if (trimmed) lastNonEmptyKind = "header";
      continue;
    }

    // Field/directive continuation marker (ABC 2.1/2.2).
    // Inherit the previous info-field style; bare `+:` after `%%MIDI ...` remains directive-colored.
    if (/^\s*\+:\s*/.test(text)) {
      const cls = lastNonEmptyKind === "directive" ? "cm-abc-directive" : "cm-abc-header";
      builder.add(line.from, line.to, Decoration.mark({ class: cls }));
      continue;
    }

    if (text.trim().length) {
      builder.add(line.from, line.to, Decoration.mark({ class: "cm-abc-notes" }));
      if (trimmed) lastNonEmptyKind = "notes";

      const commentIdx = findFirstUnescapedPercent(text);
      const contentText = commentIdx >= 0 ? text.slice(0, commentIdx) : text;
      const chordRanges = collectChordQuoteRanges(contentText);
      for (const r of chordRanges) {
        const from = line.from + r.start;
        const to = line.from + r.end;
        if (to > from) builder.add(from, to, Decoration.mark({ class: "cm-abc-chord" }));
      }
    }
  }

  return builder.finish();
}

const abcHighlight = ViewPlugin.fromClass(class {
  constructor(view) {
    this.decorations = buildAbcDecorations(view.state);
  }
  update(update) {
    if (update.docChanged) {
      this.decorations = buildAbcDecorations(update.state);
    }
  }
}, {
  decorations: (v) => v.decorations,
});

export {
  abcHighlight,
  buildAbcDecorations,
};
