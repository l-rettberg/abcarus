function expandGchordPattern(rawPattern) {
  const s = String(rawPattern || "");
  const out = [];
  let last = "";
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let num = "";
      while (i < s.length && /[0-9]/.test(s[i])) {
        num += s[i];
        i += 1;
      }
      const n = Number(num);
      if (last && Number.isFinite(n) && n > 1) {
        for (let k = 0; k < n - 1; k += 1) out.push(last);
      }
      continue;
    }
    last = ch;
    out.push(ch);
    i += 1;
  }
  return out;
}

function getNormalizedGchordBars(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(Math.floor(n));
}

function buildGchordPreview(pattern, barsValue, { maxTokens = 64 } = {}) {
  const tokens = expandGchordPattern(pattern);
  const len = tokens.length;
  const bars = getNormalizedGchordBars(barsValue);
  const barsNote = bars && len > 0 && len % Number(bars) !== 0 ? " (pattern length not divisible)" : "";
  const statusText = `pattern length: ${len}${bars ? ` \u00b7 bars: ${bars}${barsNote}` : ""}`;
  if (!tokens.length) return { statusText, previewText: "" };

  let shown = tokens;
  let truncated = false;
  if (tokens.length > maxTokens) {
    shown = tokens.slice(0, maxTokens);
    truncated = true;
  }

  const useBars = bars && Number.isFinite(Number(bars)) && Number(bars) > 0 && shown.length % Number(bars) === 0;
  const perBar = useBars ? (shown.length / Number(bars)) : 0;
  const withBars = (arr) => {
    if (!useBars || !perBar) return arr.slice();
    const out = [];
    for (let i = 0; i < arr.length; i += 1) {
      out.push(arr[i]);
      if ((i + 1) % perBar === 0 && i + 1 < arr.length) out.push("|");
    }
    return out;
  };
  const mapToken = (t) => {
    const ch = String(t || "");
    if (!ch) return { bass: "z", chord: "z" };
    if (ch === "z") return { bass: "z", chord: "z" };
    if (ch === "f") return { bass: "f", chord: "z" };
    if (ch === "c") return { bass: "z", chord: "c" };
    if (ch === "b") return { bass: "b", chord: "b" };
    if ("GHIJKghijk".includes(ch)) return { bass: "z", chord: ch };
    return { bass: ch, chord: ch };
  };
  const bassRow = [];
  const chordRow = [];
  for (const t of shown) {
    const mapped = mapToken(t);
    bassRow.push(mapped.bass);
    chordRow.push(mapped.chord);
  }
  const bassOut = withBars(bassRow);
  const chordOut = withBars(chordRow);
  if (truncated) {
    bassOut.push("...");
    chordOut.push("...");
  }
  const beatOut = (() => {
    const out = [];
    if (!useBars || !perBar) return out;
    for (let i = 0; i < shown.length; i += 1) {
      const step = (i % perBar) + 1;
      out.push(String(step));
      if ((i + 1) % perBar === 0 && i + 1 < shown.length) out.push("|");
    }
    if (truncated) out.push("...");
    return out;
  })();
  const labelPad = (s) => (s.length < 6 ? `${s}${" ".repeat(6 - s.length)}` : s);
  const line1 = beatOut.length ? `${labelPad("BEAT:")}${beatOut.join(" ")}` : "";
  const line2 = `${labelPad("BASS:")}${bassOut.join(" ")}`;
  const line3 = `${labelPad("CHRD:")}${chordOut.join(" ")}`;
  return {
    statusText,
    previewText: [line1, line2, line3].filter(Boolean).join("\n"),
  };
}

function buildGchordLines({
  pattern,
  bars,
  gchordIndent = "",
  gchordComment = "",
  barsIndent = "",
  barsComment = "",
} = {}) {
  const patternValue = String(pattern || "").trim();
  const barsOut = getNormalizedGchordBars(bars);
  const lines = {
    gchordLine: `${gchordIndent}%%MIDI gchord ${patternValue}${gchordComment || ""}`,
    barsLine: "",
  };
  if (barsOut) {
    lines.barsLine = `${barsIndent || gchordIndent}%%MIDI gchordbars ${barsOut}${barsComment || ""}`;
  }
  return lines;
}

export {
  buildGchordLines,
  buildGchordPreview,
  expandGchordPattern,
  getNormalizedGchordBars,
};
