function findMeasureRangeAt(text, pos) {
  const src = String(text || "");
  if (!src) return null;
  let idx = Math.max(0, Math.min(pos, Math.max(0, src.length - 1)));
  while (idx > 0) {
    const lineStart = Math.max(0, src.lastIndexOf("\n", idx - 1) + 1);
    const lineText = src.slice(lineStart, idx + 1);
    const trimmed = lineText.trim();
    if (!trimmed || trimmed.startsWith("%")) {
      idx = lineStart - 1;
      continue;
    }
    const commentIdx = src.indexOf("%", lineStart);
    if (commentIdx !== -1 && commentIdx <= idx && src[commentIdx - 1] !== "\\") {
      idx = commentIdx - 1;
      continue;
    }
    while (idx > lineStart && /[\s|:]/.test(src[idx])) idx -= 1;
    if (idx <= lineStart && /[\s|:]/.test(src[idx])) {
      idx = lineStart - 1;
      continue;
    }
    break;
  }
  idx = Math.max(0, idx);
  const start = src.lastIndexOf("|", Math.max(0, idx));
  const end = src.indexOf("|", Math.max(0, idx + 1));
  const rangeStart = start >= 0 ? start : 0;
  const rangeEnd = end >= 0 ? end + 1 : src.length;
  if (rangeEnd <= rangeStart) return null;
  return { start: rangeStart, end: rangeEnd };
}

function findMeasureStartOffsetByNumber(text, measureNumber) {
  const target = Number(measureNumber);
  if (!Number.isFinite(target) || target < 1) return null;
  const src = String(text || "");
  if (!src.trim()) return null;
  const len = src.length;

  const isSkippableLine = (line) => {
    const trimmed = String(line || "").trim();
    if (!trimmed) return true;
    if (trimmed.startsWith("%")) return true;
    if (/^%%/.test(trimmed)) return true;
    if (/^[A-Za-z]:/.test(trimmed)) return true;
    return false;
  };

  const isBodyLine = (line) => {
    const trimmed = String(line || "").trim();
    if (!trimmed) return false;
    if (trimmed.startsWith("%")) return false;
    if (/^%%/.test(trimmed)) return false;
    if (/^[A-Za-z]:/.test(trimmed)) return false;
    return true;
  };

  let inTextBlock = false;
  let inBody = false;
  let started = false;

  const lineStarts = [0];
  for (let i = 0; i < len; i += 1) {
    if (src[i] === "\n") lineStarts.push(i + 1);
  }
  lineStarts.push(len + 1);

  let currentMeasure = 1;
  for (let li = 0; li < lineStarts.length - 1; li += 1) {
    const lineStart = lineStarts[li];
    const lineEnd = Math.min(len, lineStarts[li + 1] - 1);
    const rawLine = src.slice(lineStart, lineEnd);
    const trimmed = rawLine.trim();

    if (/^%%\s*begintext\b/i.test(trimmed)) { inTextBlock = true; continue; }
    if (/^%%\s*endtext\b/i.test(trimmed)) { inTextBlock = false; continue; }
    if (inTextBlock) continue;
    if (!inBody) {
      if (/^\s*K:/.test(rawLine) || /^\s*\[\s*K:/.test(rawLine)) inBody = true;
      continue;
    }
    if (isSkippableLine(rawLine)) continue;
    if (!started && !isBodyLine(rawLine)) continue;
    if (!started) {
      started = true;
      const firstNonSpace = rawLine.search(/\S/);
      const start = firstNonSpace >= 0 ? lineStart + firstNonSpace : lineStart;
      if (target === 1) return start;
    }

    let inQuote = false;
    let inComment = false;
    for (let i = lineStart; i < lineEnd; i += 1) {
      const ch = src[i];
      if (inComment) continue;
      if (ch === "%" && src[i - 1] !== "\\") { inComment = true; continue; }
      if (ch === "\"") { inQuote = !inQuote; continue; }
      if (inQuote) continue;
      if (ch !== "|") continue;

      let j = i + 1;
      while (j < lineEnd && /[:|\]\s]/.test(src[j])) j += 1;
      currentMeasure += 1;
      if (currentMeasure === target) return j;
      i = j - 1;
    }
  }

  return null;
}

function findMeasureStartOffsetByNumberInPrimaryVoice(text, measureNumber, { normalizeVoiceIdToken = (value) => String(value || "").trim() } = {}) {
  const target = Number(measureNumber);
  if (!Number.isFinite(target) || target < 1) return null;
  const src = String(text || "");
  if (!src.trim()) return null;
  const len = src.length;

  const isSkippableLine = (line) => {
    const trimmed = String(line || "").trim();
    if (!trimmed) return true;
    if (trimmed.startsWith("%")) return true;
    if (/^%%/.test(trimmed)) return true;
    if (/^[A-Za-z]:/.test(trimmed)) return true;
    return false;
  };
  const isBodyLine = (line) => {
    const trimmed = String(line || "").trim();
    if (!trimmed) return false;
    if (trimmed.startsWith("%")) return false;
    if (/^%%/.test(trimmed)) return false;
    if (/^[A-Za-z]:/.test(trimmed)) return false;
    return true;
  };

  let inTextBlock = false;
  let inBody = false;
  let primaryVoice = null;
  let currentVoice = null;
  let started = false;
  let currentMeasure = 1;

  const lineStarts = [0];
  for (let i = 0; i < len; i += 1) {
    if (src[i] === "\n") lineStarts.push(i + 1);
  }
  lineStarts.push(len + 1);

  for (let li = 0; li < lineStarts.length - 1; li += 1) {
    const lineStart = lineStarts[li];
    const lineEnd = Math.min(len, lineStarts[li + 1] - 1);
    const rawLine = src.slice(lineStart, lineEnd);
    const trimmed = rawLine.trim();

    if (/^%%\s*begintext\b/i.test(trimmed)) { inTextBlock = true; continue; }
    if (/^%%\s*endtext\b/i.test(trimmed)) { inTextBlock = false; continue; }
    if (inTextBlock) continue;

    if (!inBody) {
      if (/^\s*K:/.test(rawLine) || /^\s*\[\s*K:/.test(rawLine)) inBody = true;
      continue;
    }

    const voiceLine = rawLine.match(/^\s*V\s*:\s*(.*)$/i);
    if (voiceLine) {
      currentVoice = normalizeVoiceIdToken(voiceLine[1]) || "1";
      if (!primaryVoice) primaryVoice = currentVoice;
      continue;
    }

    const effectiveVoice = currentVoice || "1";
    if (!primaryVoice && isBodyLine(rawLine)) primaryVoice = effectiveVoice;
    if (primaryVoice && effectiveVoice !== primaryVoice) continue;
    if (isSkippableLine(rawLine)) continue;

    if (!started && !isBodyLine(rawLine)) continue;
    if (!started) {
      started = true;
      const firstNonSpace = rawLine.search(/\S/);
      const start = firstNonSpace >= 0 ? lineStart + firstNonSpace : lineStart;
      if (target === 1) return start;
    }

    let inQuote = false;
    let inComment = false;
    for (let i = lineStart; i < lineEnd; i += 1) {
      const ch = src[i];
      if (inComment) continue;
      if (ch === "%" && src[i - 1] !== "\\") { inComment = true; continue; }
      if (ch === "\"") { inQuote = !inQuote; continue; }
      if (inQuote) continue;
      if (ch !== "|") continue;

      let j = i + 1;
      while (j < lineEnd && /[:|\]\s]/.test(src[j])) j += 1;
      currentMeasure += 1;
      if (currentMeasure === target) return j;
      i = j - 1;
    }
  }
  return null;
}

function buildMeasureIstartsFromAbc2svg(firstSymbol) {
  const istarts = [];
  const pushUnique = (v) => {
    if (!Number.isFinite(v)) return;
    if (!istarts.length || istarts[istarts.length - 1] !== v) istarts.push(v);
  };
  const isBarLikeSymbol = (symbol) => !!(symbol && (symbol.bar_type || symbol.type === 14));
  let s = firstSymbol;
  let guard = 0;
  if (s && Number.isFinite(s.istart)) pushUnique(s.istart);
  while (s && guard < 200000) {
    if (isBarLikeSymbol(s) && s.ts_next && Number.isFinite(s.ts_next.istart)) {
      pushUnique(s.ts_next.istart);
    }
    s = s.ts_next;
    guard += 1;
  }
  const out = [];
  let last = null;
  for (const v of istarts.slice().sort((a, b) => a - b)) {
    if (!Number.isFinite(v)) continue;
    if (last == null || v !== last) out.push(v);
    last = v;
  }
  return out;
}

function buildMeasureStartsByNumberFromAbc2svg(firstSymbol) {
  const byNumber = new Map();
  const push = (targetMap, n, istart) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return;
    const start = Number(istart);
    if (!Number.isFinite(start)) return;
    const list = targetMap.get(num) || [];
    if (!list.length || list[list.length - 1] !== start) list.push(start);
    targetMap.set(num, list);
  };
  const normalizeMap = (targetMap) => {
    for (const [k, list] of targetMap.entries()) {
      const out = [];
      let last = null;
      for (const v of list.slice().sort((a, b) => a - b)) {
        if (!Number.isFinite(v)) continue;
        if (last == null || v !== last) out.push(v);
        last = v;
      }
      targetMap.set(k, out);
    }
  };
  const normalizeList = (list) => {
    const out = [];
    let last = null;
    for (const v of (Array.isArray(list) ? list : []).slice().sort((a, b) => a - b)) {
      if (!Number.isFinite(v)) continue;
      if (last == null || v !== last) out.push(v);
      last = v;
    }
    return out;
  };
  const findNextAfter = (sorted, value) => {
    if (!Array.isArray(sorted) || !sorted.length) return null;
    const target = Number(value);
    if (!Number.isFinite(target)) return null;
    let lo = 0;
    let hi = sorted.length - 1;
    let best = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const v = sorted[mid];
      if (v > target) {
        best = v;
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }
    return best;
  };
  const isBarLikeSymbol = (symbol) => !!(symbol && (symbol.bar_type || symbol.type === 14));
  const genericByNumber = new Map();
  const voiceStarts = new Map();
  const barlines = [];

  let s = firstSymbol;
  let guard = 0;
  let primaryVoiceId = null;
  while (s && guard < 200000) {
    const istart = Number(s.istart);
    const voiceId = (s && s.p_v && s.p_v.id != null) ? String(s.p_v.id) : "1";
    if (Number.isFinite(istart)) {
      if (!voiceStarts.has(voiceId)) voiceStarts.set(voiceId, []);
      voiceStarts.get(voiceId).push(istart);
    }
    const playable = Number.isFinite(s.dur) && s.dur > 0;
    if (!primaryVoiceId && playable && Number.isFinite(istart)) primaryVoiceId = voiceId;
    if (isBarLikeSymbol(s) && Number.isFinite(s.bar_num) && Number.isFinite(istart)) {
      barlines.push({ barNum: Number(s.bar_num), istart, voiceId });
      if (s.ts_next && Number.isFinite(Number(s.ts_next.istart))) {
        push(genericByNumber, s.bar_num, s.ts_next.istart);
      }
    }
    s = s.ts_next;
    guard += 1;
  }
  if (!primaryVoiceId) primaryVoiceId = "1";

  const primaryStarts = normalizeList(voiceStarts.get(primaryVoiceId));
  const firstPrimaryStart = primaryStarts.length ? primaryStarts[0] : null;
  if (Number.isFinite(firstPrimaryStart)) {
    push(byNumber, 0, firstPrimaryStart);
    push(byNumber, 1, firstPrimaryStart);
  }

  const primaryBars = barlines
    .filter((item) => String(item.voiceId || "1") === String(primaryVoiceId))
    .sort((a, b) => Number(a.istart) - Number(b.istart));

  for (const item of primaryBars) {
    const nextStart = findNextAfter(primaryStarts, Number(item.istart));
    if (Number.isFinite(nextStart)) {
      push(byNumber, item.barNum, nextStart);
    }
  }

  normalizeMap(genericByNumber);
  normalizeMap(byNumber);

  for (const [k, list] of genericByNumber.entries()) {
    if (!byNumber.has(k) || !Array.isArray(byNumber.get(k)) || !byNumber.get(k).length) {
      byNumber.set(k, Array.isArray(list) ? list.slice() : []);
    }
  }

  return byNumber;
}

export {
  buildMeasureIstartsFromAbc2svg,
  buildMeasureStartsByNumberFromAbc2svg,
  findMeasureRangeAt,
  findMeasureStartOffsetByNumber,
  findMeasureStartOffsetByNumberInPrimaryVoice,
};
