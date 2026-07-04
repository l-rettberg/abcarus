import {
  matchBarToken,
} from "../abc/bar_tokens.js";

function parseBarToken(rawToken) {
  const raw = String(rawToken || "");
  const digitMatch = raw.match(/(\d+)$/);
  const voltaNumber = digitMatch ? Number(digitMatch[1]) : null;
  const rawNoDigits = digitMatch ? raw.slice(0, raw.length - digitMatch[1].length) : raw;

  let normalized = rawNoDigits
    .replace(/[\[\]]/g, "|")
    .replace(/\./g, "|");
  normalized = normalized.replace(/\|+/g, "|");

  const isCombined = normalized === "::" || (/^:.*:$/.test(normalized) && normalized.includes("|"));
  const startMulti = normalized.match(/^\|(:{2,})/);
  const endMulti = normalized.match(/(:{2,})\|$/);

  const repeatCountStart = startMulti ? (startMulti[1].length + 1) : 0;
  const repeatCountEnd = endMulti ? (endMulti[1].length + 1) : 0;

  const isRepeatStart = isCombined || normalized.includes("|:") || repeatCountStart > 0;
  const isRepeatEnd = isCombined || normalized.includes(":|") || repeatCountEnd > 0;

  const isFirstEnding = voltaNumber === 1
    && /(?:\||\[|:)/.test(rawNoDigits);
  const isSecondEnding = voltaNumber === 2
    && /(?:\||\[|:)/.test(rawNoDigits);

  return {
    raw,
    rawNoDigits,
    normalized,
    voltaNumber: Number.isFinite(voltaNumber) ? voltaNumber : null,
    isCombined,
    isRepeatStart,
    isRepeatEnd,
    repeatCountStart,
    repeatCountEnd,
    isFirstEnding,
    isSecondEnding,
  };
}

function normalizeBarToken(token) {
  if (!token) return "";
  const info = parseBarToken(token);
  if (info.isRepeatStart || info.isRepeatEnd || info.isFirstEnding || info.isSecondEnding) {
    return "|";
  }
  return token;
}

function hasRepeatTokens(text) {
  return /(\|\:|\:\||::|\|\s*\d+|\[\s*\d+)/.test(String(text || ""));
}

function shouldForceRepeatExpansionForPlayback(text) {
  const src = String(text || "");
  // abc2svg/abcplay can behave unpredictably on some complex repeat barlines; expand for deterministic playback.
  return /(\|:::|:::\||\|::|::\||::)/.test(src);
}

function expandRepeatsInString(line) {
  const value = String(line || "").trim();
  if (!value || !hasRepeatTokens(value)) return line;
  const bars = [];
  let current = "";
  let startToken = "";
  let inQuote = false;
  for (let i = 0; i < value.length; ) {
    const ch = value[i];
    if (ch === "\"") {
      inQuote = !inQuote;
      current += ch;
      i += 1;
      continue;
    }
    if (!inQuote) {
      const token = matchBarToken(value, i);
      if (token) {
        bars.push({ startToken, content: current.trim() });
        startToken = token.token;
        current = "";
        i += token.len;
        continue;
      }
    }
    current += ch;
    i += 1;
  }
  if (current.trim() || startToken) {
    bars.push({ startToken, content: current.trim() });
  }
  if (bars.length === 0) return line;

  const out = [];
  let repeatStart = null; // { idx, times }
  let firstEndStart = null;
  let secondEndStart = null;

  const emitBars = (slice) => {
    for (const bar of slice) {
      const token = normalizeBarToken(bar.startToken);
      if (bar.content) out.push(`${token}${bar.content}`);
      else if (token) out.push(token);
    }
  };

  for (let i = 0; i < bars.length; i += 1) {
    const token = bars[i].startToken || "";
    const info = parseBarToken(token);

    if (repeatStart != null && info.isFirstEnding) {
      firstEndStart = i;
      continue;
    }
    if (repeatStart != null && info.isSecondEnding) {
      secondEndStart = i;
      continue;
    }
    if (repeatStart != null && info.isRepeatEnd) {
      const repeatEnd = i;
      const times = Math.max(2, info.repeatCountEnd || (repeatStart && repeatStart.times) || 2);
      const repeatStartIdx = repeatStart ? repeatStart.idx : null;
      if (repeatStartIdx != null) {
        if (firstEndStart != null && secondEndStart != null && times === 2) {
          const partA = bars.slice(repeatStartIdx, firstEndStart);
          const partB = bars.slice(firstEndStart, secondEndStart);
          const partC = bars.slice(secondEndStart, repeatEnd);
          emitBars(partA);
          emitBars(partB);
          emitBars(partA);
          emitBars(partC);
        } else {
          const part = bars.slice(repeatStartIdx, repeatEnd);
          for (let rep = 0; rep < times; rep += 1) emitBars(part);
        }
      }

      repeatStart = null;
      firstEndStart = null;
      secondEndStart = null;
      if (info.isRepeatStart) {
        repeatStart = { idx: i, times: info.repeatCountStart || 2 };
        continue;
      }
      continue;
    }
    if (info.isRepeatStart) {
      repeatStart = { idx: i, times: info.repeatCountStart || 2 };
      continue;
    }
    if (repeatStart == null) {
      emitBars([bars[i]]);
    }
  }

  if (!out.length) {
    emitBars(bars);
  }
  return out.join(" ");
}

function expandRepeatsForPlayback(text) {
  if (!hasRepeatTokens(String(text || ""))) return text;
  const lines = String(text || "").split(/\r\n|\n|\r/);
  const out = [];
  let buffer = [];
  let inBody = false;

  const flushBuffer = () => {
    if (!buffer.length) return;
    const expanded = expandRepeatsInString(buffer.join(" "));
    out.push(expanded);
    buffer = [];
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!inBody && /^K:/.test(trimmed)) {
      flushBuffer();
      out.push(rawLine);
      inBody = true;
      continue;
    }
    if (!inBody || /^%/.test(trimmed) || /^%%/.test(trimmed) || /^[Ww]:/.test(trimmed)
      || (/^[A-Za-z]:/.test(trimmed) && !/^V:/.test(trimmed))) {
      flushBuffer();
      out.push(rawLine);
      continue;
    }
    if (/^V:/.test(trimmed)) {
      flushBuffer();
      out.push(rawLine);
      continue;
    }
    buffer.push(rawLine);
  }
  flushBuffer();
  return out.join("\n");
}

export {
  expandRepeatsForPlayback,
  expandRepeatsInString,
  parseBarToken,
  shouldForceRepeatExpansionForPlayback,
};
