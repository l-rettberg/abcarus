import {
  BAR_SEP_NO_SPACE,
  gcdInt,
  getBarLength,
  getDefaultLen,
  getMetre,
  isLikelyAnacrusis,
  splitLineIntoParts,
} from "../abc/bar_metrics.js";

function formatMetreFromText(abcText) {
  const text = String(abcText || "");
  const match = text.match(/^M:\s*([0-9]+)\s*\/\s*([0-9]+)\s*$/m);
  if (!match) return "";
  return `${match[1]}/${match[2]}`;
}

function detectMeterMismatchInBarlines(abcText) {
  const text = String(abcText || "");
  const metreText = formatMetreFromText(text) || "";
  if (!metreText) return null;
  const metre = getMetre(text);
  const defaultLen = getDefaultLen(text);
  if (!Number.isFinite(metre) || metre <= 0) return null;
  if (!Number.isFinite(defaultLen) && defaultLen !== "mcm_default") return null;

  const lines = text.split(/\r\n|\n|\r/);
  let metreLoc = null;
  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const match = rawLine.match(/^(\s*)M:\s*([0-9]+)\s*\/\s*([0-9]+)/);
    if (!match) continue;
    const found = `${match[2]}/${match[3]}`;
    if (found !== metreText) continue;
    metreLoc = { line: i + 1, col: (match[1] ? match[1].length : 0) + 1 };
    break;
  }
  let inTextBlock = false;
  let inBody = false;
  let buffer = "";
  const bars = [];

  const flushBar = () => {
    const trimmed = buffer.trim();
    buffer = "";
    if (trimmed) bars.push(trimmed);
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (/^%%\s*begintext\b/i.test(trimmed)) { inTextBlock = true; continue; }
    if (/^%%\s*endtext\b/i.test(trimmed)) { inTextBlock = false; continue; }
    if (inTextBlock) continue;

    if (!inBody) {
      if (/^\s*K:/.test(rawLine) || /^\s*\[\s*K:/.test(trimmed)) inBody = true;
      continue;
    }

    if (!trimmed) continue;
    if (/^%/.test(trimmed) && !/^%%/.test(trimmed)) continue;
    if (/^\s*%%/.test(rawLine)) continue;
    if (/^\s*[A-Za-z]:/.test(rawLine)) continue;

    let line = rawLine;
    const idx = line.indexOf("%");
    if (idx >= 0) line = line.slice(0, idx);

    const parts = splitLineIntoParts(line);
    for (const part of parts) {
      const p = String(part || "");
      if (BAR_SEP_NO_SPACE.test(p.trim())) {
        flushBar();
        continue;
      }
      buffer += ` ${p}`;
    }
  }
  flushBar();

  const usable = [];
  for (const bar of bars) {
    const len = getBarLength(bar, defaultLen, metre);
    if (!Number.isFinite(len) || len <= 0) continue;
    usable.push({ bar, len });
  }
  if (usable.length < 6) return null;
  if (isLikelyAnacrusis(usable[0].bar, defaultLen, metre)) usable.shift();
  if (usable.length < 6) return null;

  const counts = new Map();
  const tol = 0.12;
  for (const item of usable) {
    const ratio = item.len / metre;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    const rounded = Math.round(ratio);
    if (rounded < 2 || rounded > 8) continue;
    if (Math.abs(ratio - rounded) > tol) continue;
    counts.set(rounded, (counts.get(rounded) || 0) + 1);
  }
  if (!counts.size) return null;

  let best = { multiple: 0, count: 0 };
  for (const [multiple, count] of counts.entries()) {
    if (count > best.count) best = { multiple, count };
  }
  const total = usable.length;
  if (best.count < Math.max(4, Math.ceil(total * 0.6))) return null;

  const hint = metreText
    ? `Bars look ~${best.multiple}× longer than M:${metreText}`
    : `Bars look ~${best.multiple}× longer than the meter`;
  return {
    kind: "meter-mismatch",
    detail: `${hint}. Consider updating M: or adding barlines.`,
    multiple: best.multiple,
    barCount: total,
    matchCount: best.count,
    metre: metreText || null,
    loc: metreLoc,
  };
}

function detectRepeatMarkerAfterShortBar(abcText) {
  const text = String(abcText || "");
  const headerMetreText = formatMetreFromText(text) || "";
  if (!headerMetreText) return null;
  const headerMetre = getMetre(text);
  const defaultLen = getDefaultLen(text);
  if (!Number.isFinite(headerMetre) || headerMetre <= 0) return null;
  if (!Number.isFinite(defaultLen) && defaultLen !== "mcm_default") return null;

  let currentMetre = headerMetre;
  let currentMetreText = headerMetreText;

  const lines = text.split(/\r\n|\n|\r/);
  let inTextBlock = false;
  let inBody = false;
  let buffer = "";
  let lastStartToken = null;
  let lastTokenLoc = null;

  const flushBar = (endToken, endLoc) => {
    const bar = buffer.trim();
    buffer = "";
    if (!bar) return null;
    const len = getBarLength(bar, defaultLen, currentMetre);
    if (!Number.isFinite(len) || len <= 0) return null;
    const ratio = len / currentMetre;
    if (!Number.isFinite(ratio) || ratio <= 0) return null;
    const isFullBar = Math.abs(ratio - 1) <= 0.15;
    if (isFullBar) return null;

    const token = String(endToken || "").trim();
    if (!token.includes(":")) return null;

    const isStartRepeatToken = token.includes("|:") || token.endsWith(":");
    const isEndRepeatToken = token.startsWith(":|") || token.includes(":|");
    // Treat a short bar immediately before a repeat marker as a valid incomplete bar:
    // - before start-repeat: pickup/anacrusis (e.g. "|:" / "::" / ":|:")
    // - before end-repeat: shortened closing bar (often balances an initial pickup)
    if ((isStartRepeatToken || isEndRepeatToken) && ratio <= 0.8) return null;

    const ratioText = ratio.toFixed(2).replace(/\.?0+$/, "");
    return {
      kind: "repeat-short-bar",
      detail: `Repeat marker "${token}" follows a bar of ~${ratioText}× length under M:${currentMetreText}. Consider fixing bar lengths or changing M: locally.`,
      metre: currentMetreText,
      ratio,
      token,
      startToken: lastStartToken || null,
      loc: endLoc || lastTokenLoc || null,
    };
  };

  for (let lineNo = 0; lineNo < lines.length; lineNo += 1) {
    const rawLine = lines[lineNo];
    const trimmed = rawLine.trim();
    if (/^%%\s*begintext\b/i.test(trimmed)) { inTextBlock = true; continue; }
    if (/^%%\s*endtext\b/i.test(trimmed)) { inTextBlock = false; continue; }
    if (inTextBlock) continue;

    if (!inBody) {
      if (/^\s*K:/.test(rawLine) || /^\s*\[\s*K:/.test(trimmed)) inBody = true;
      continue;
    }

    if (!trimmed) continue;
    if (/^%/.test(trimmed) && !/^%%/.test(trimmed)) continue;
    if (/^\s*%%/.test(rawLine)) continue;
    const bodyMeterMatch = trimmed.match(/^M:\s*(\d+)\s*\/\s*(\d+)/i);
    if (bodyMeterMatch) {
      const num = Number(bodyMeterMatch[1]);
      const den = Number(bodyMeterMatch[2]);
      if (Number.isFinite(num) && Number.isFinite(den) && num > 0 && den > 0) {
        currentMetre = num / den;
        currentMetreText = `${bodyMeterMatch[1]}/${bodyMeterMatch[2]}`;
      }
      continue;
    }
    if (/^\s*[A-Za-z]:/.test(rawLine)) continue;

    let line = rawLine;
    const commentIdx = line.indexOf("%");
    if (commentIdx >= 0) line = line.slice(0, commentIdx);

    const parts = splitLineIntoParts(line);
    let cursor = 0;
    for (const part of parts) {
      const p = String(part || "");
      const pos = line.indexOf(p, cursor);
      const start = pos >= 0 ? pos : cursor;
      cursor = start + p.length;

      const token = p.trim();
      if (BAR_SEP_NO_SPACE.test(token)) {
        const loc = { line: lineNo + 1, col: start + 1 };
        if (!buffer.trim()) {
          lastStartToken = token;
          lastTokenLoc = loc;
          continue;
        }
        const warn = flushBar(token, loc);
        lastStartToken = token;
        lastTokenLoc = loc;
        if (warn) return warn;
        continue;
      }

      const inlineMeterRe = /\[\s*M:\s*(\d+)\s*\/\s*(\d+)\s*\]/gi;
      let mm;
      while ((mm = inlineMeterRe.exec(p)) !== null) {
        const num = Number(mm[1]);
        const den = Number(mm[2]);
        if (!Number.isFinite(num) || !Number.isFinite(den) || num <= 0 || den <= 0) continue;
        currentMetre = num / den;
        currentMetreText = `${mm[1]}/${mm[2]}`;
      }
      buffer += ` ${p}`;
    }
  }

  return null;
}

function formatBarDelta(deltaUnits, metreDen) {
  const denBase = Math.max(1, Math.round(Number(metreDen) || 8));
  const scaledDen = denBase * 4;
  const scaledNum = Math.round(Number(deltaUnits) * 4);
  if (!Number.isFinite(scaledNum) || scaledNum === 0) return { text: "", approx: 0 };
  const g = gcdInt(scaledNum, scaledDen);
  const num = scaledNum / g;
  const den = scaledDen / g;
  const sign = num > 0 ? "+" : "−";
  const absNum = Math.abs(num);
  return { text: `${sign}${absNum}/${den}`, approx: num / den };
}

function computeLineStartOffsets(text) {
  const lines = String(text || "").split(/\r\n|\n|\r/);
  const offsets = [];
  let cursor = 0;
  for (let i = 0; i < lines.length; i += 1) {
    offsets.push(cursor);
    cursor += lines[i].length + 1;
  }
  return offsets;
}

function analyzeBarMismatchesForGutter(abcText) {
  const text = String(abcText || "");
  const metreText = formatMetreFromText(text) || "";
  const metreMatch = metreText.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
  if (!metreMatch) return [];
  const metre = getMetre(text);
  const defaultLen = getDefaultLen(text);
  if (!Number.isFinite(metre) || metre <= 0) return [];
  if (!Number.isFinite(defaultLen) && defaultLen !== "mcm_default") return [];

  let currentMetre = metre;
  let currentDefaultLen = defaultLen;
  let currentMetreText = metreText;
  let currentDen = Number(metreMatch[2]) || 8;
  const metreUnit = () => 1 / Math.max(1, currentDen);
  const unitTol = 0.2;

  const lines = text.split(/\r\n|\n|\r/);
  const lineStarts = computeLineStartOffsets(text);
  let inTextBlock = false;
  let inBody = false;
  let buffer = "";
  let barNumber = 0;
  const markers = [];
  const barEntries = [];
  let currentVoice = "";
  let firstVoice = "";
  let referenceVoice = "";
  let referenceBarNumber = 0;

  const setVoice = (voiceIdRaw) => {
    const voiceId = String(voiceIdRaw || "").trim().split(/\s+/)[0];
    if (!voiceId) return;
    currentVoice = voiceId;
    if (!firstVoice) firstVoice = voiceId;
    if (voiceId === "1") referenceVoice = "1";
    else if (!referenceVoice) referenceVoice = voiceId;
  };

  const updateMetre = (num, den) => {
    const n = Number(num);
    const d = Number(den);
    if (!Number.isFinite(n) || !Number.isFinite(d) || n <= 0 || d <= 0) return;
    currentMetre = n / d;
    currentMetreText = `${num}/${den}`;
    currentDen = d;
  };

  const parseDefaultLenValue = (raw) => {
    const token = String(raw || "").trim();
    if (!token) return null;
    if (/^mcm_default$/i.test(token)) return "mcm_default";
    const m = token.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (!m) return null;
    const num = Number(m[1]);
    const den = Number(m[2]);
    if (!Number.isFinite(num) || !Number.isFinite(den) || num <= 0 || den <= 0) return null;
    return num / den;
  };

  const updateDefaultLen = (raw) => {
    const parsed = parseDefaultLenValue(raw);
    if (parsed == null) return;
    currentDefaultLen = parsed;
  };

  const flushBar = (endToken, endOffset, endLen, lineNo, colNo) => {
    const bar = buffer.trim();
    buffer = "";
    if (!bar) return;
    const len = getBarLength(bar, currentDefaultLen, currentMetre);
    if (!Number.isFinite(len) || len <= 0) return;
    barNumber += 1;
    const unit = metreUnit();
    const delta = len - currentMetre;
    const deltaUnits = delta / unit;
    let displayBarNumber = barNumber;
    if (referenceVoice) {
      if (currentVoice === referenceVoice) referenceBarNumber += 1;
      if (referenceBarNumber > 0) displayBarNumber = referenceBarNumber;
    } else {
      if (!currentVoice) setVoice("1");
      referenceVoice = referenceVoice || currentVoice || firstVoice || "1";
      referenceBarNumber += 1;
      displayBarNumber = referenceBarNumber;
    }
    if (!Number.isFinite(deltaUnits)) return;
    barEntries.push({
      bar,
      barNumber,
      displayBarNumber,
      voiceId: currentVoice || referenceVoice || firstVoice || "",
      len,
      deltaUnits,
      unit,
      metre: currentMetre,
      metreText: currentMetreText,
      den: currentDen,
      endToken,
      endOffset,
      endLen,
      lineNo,
      colNo,
    });
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex];
    const trimmed = rawLine.trim();
    if (/^%%\s*begintext\b/i.test(trimmed)) { inTextBlock = true; continue; }
    if (/^%%\s*endtext\b/i.test(trimmed)) { inTextBlock = false; continue; }
    if (inTextBlock) continue;

    if (!inBody) {
      if (/^\s*K:/.test(rawLine) || /^\s*\[\s*K:/.test(trimmed)) inBody = true;
      continue;
    }

    if (!trimmed) continue;
    if (/^%/.test(trimmed) && !/^%%/.test(trimmed)) continue;
    if (/^\s*%%/.test(rawLine)) continue;

    if (/^\s*V:/.test(rawLine)) {
      setVoice(trimmed.slice(2));
      continue;
    }

    const bodyMeterMatch = trimmed.match(/^M:\s*(\d+)\s*\/\s*(\d+)/i);
    if (bodyMeterMatch) {
      updateMetre(bodyMeterMatch[1], bodyMeterMatch[2]);
      continue;
    }
    const bodyLenMatch = trimmed.match(/^L:\s*([^\s%]+)/i);
    if (bodyLenMatch) {
      updateDefaultLen(bodyLenMatch[1]);
      continue;
    }
    if (/^\s*[A-Za-z]:/.test(rawLine)) continue;

    let line = rawLine;
    const commentIdx = line.indexOf("%");
    if (commentIdx >= 0) line = line.slice(0, commentIdx);
    if (!line.trim()) continue;

    const parts = splitLineIntoParts(line);
    let cursor = 0;
    for (const part of parts) {
      const p = String(part || "");
      const pos = line.indexOf(p, cursor);
      const start = pos >= 0 ? pos : cursor;
      cursor = start + p.length;

      const token = p.trim();
      if (BAR_SEP_NO_SPACE.test(token)) {
        const endOffset = (lineStarts[lineIndex] || 0) + start;
        flushBar(token, endOffset, p.length, lineIndex + 1, start + 1);
        continue;
      }

      const inlineMeterRe = /\[\s*M:\s*(\d+)\s*\/\s*(\d+)\s*\]/gi;
      let mm;
      while ((mm = inlineMeterRe.exec(p)) !== null) {
        updateMetre(mm[1], mm[2]);
      }
      const inlineLenRe = /\[\s*L:\s*([^\]]+)\]/gi;
      let ll;
      while ((ll = inlineLenRe.exec(p)) !== null) {
        updateDefaultLen(ll[1]);
      }
      buffer += ` ${p}`;
    }
  }

  if (!barEntries.length) return markers;

  const allowed = new Set();
  const first = barEntries[0];
  if (first && first.deltaUnits < -unitTol && isLikelyAnacrusis(first.bar, defaultLen, first.metre)) {
    allowed.add(0);
  }
  const lastIdx = barEntries.length - 1;
  const last = barEntries[lastIdx];
  if (last && last.deltaUnits < -unitTol) {
    allowed.add(lastIdx);
  }

  for (let i = 0; i < barEntries.length - 1; i += 1) {
    if (allowed.has(i) || allowed.has(i + 1)) continue;
    const a = barEntries[i];
    const b = barEntries[i + 1];
    if (!a || !b) continue;
    if (a.deltaUnits >= -unitTol || b.deltaUnits >= -unitTol) continue;
    if (a.metreText !== b.metreText || a.den !== b.den) continue;
    const sumDeltaUnits = (a.len + b.len - a.metre) / a.unit;
    if (!Number.isFinite(sumDeltaUnits)) continue;
    if (Math.abs(sumDeltaUnits) <= unitTol) {
      allowed.add(i);
      allowed.add(i + 1);
    }
  }

  for (let i = 0; i < barEntries.length; i += 1) {
    if (allowed.has(i)) continue;
    const entry = barEntries[i];
    if (!entry || Math.abs(entry.deltaUnits) <= unitTol) continue;
    const deltaFmt = formatBarDelta(entry.deltaUnits, entry.den);
    if (!deltaFmt.text) continue;
    const ratio = entry.len / entry.metre;
    const ratioText = Number.isFinite(ratio) ? ratio.toFixed(2).replace(/\.?0+$/, "") : "?";
    const barNo = entry.displayBarNumber || entry.barNumber;
    const voicePrefix = (entry.voiceId && referenceVoice && entry.voiceId !== referenceVoice)
      ? `V:${entry.voiceId} · `
      : "";
    const detail = `${voicePrefix}Bar ${barNo}: ${deltaFmt.text} under M:${entry.metreText} (≈${ratioText}×)`;
    const label = `#${barNo} ${deltaFmt.text}`;
    markers.push({
      offset: entry.endOffset,
      len: Math.max(1, entry.endLen || 1),
      barNumber: barNo,
      label,
      deltaText: deltaFmt.text,
      detail,
      line: entry.lineNo,
      col: entry.colNo,
      token: String(entry.endToken || "").trim() || "|",
      voiceId: entry.voiceId || "",
      referenceVoice: referenceVoice || "",
    });
  }

  return markers;
}

export {
  analyzeBarMismatchesForGutter,
  detectMeterMismatchInBarlines,
  detectRepeatMarkerAfterShortBar,
};
