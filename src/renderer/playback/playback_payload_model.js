import { matchBarToken } from "../abc/bar_tokens.js";
import {
  getBarLength,
  isLikelyAnacrusis,
} from "../abc/bar_metrics.js";
import { parseDrumPattern } from "../tools/drum_helper/drum_helper_model.js";

function parseFraction(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw === "C") return { num: 4, den: 4 };
  if (raw === "C|") return { num: 2, den: 2 };
  const match = raw.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) return null;
  const num = Number(match[1]);
  const den = Number(match[2]);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  return { num, den };
}

function normalizeFraction(frac) {
  if (!frac) return null;
  let num = frac.num;
  let den = frac.den;
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  const sign = den < 0 ? -1 : 1;
  num *= sign;
  den *= sign;
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
  const g = gcd(num, den) || 1;
  return { num: num / g, den: den / g };
}

function fractionDiv(a, b) {
  return normalizeFraction({ num: a.num * b.den, den: a.den * b.num });
}

function fractionMul(a, b) {
  return normalizeFraction({ num: a.num * b.num, den: a.den * b.den });
}

function fractionMulInt(a, k) {
  return normalizeFraction({ num: a.num * k, den: a.den });
}

function fractionToNumber(a) {
  return a.num / a.den;
}

function formatDuration(mult) {
  const frac = normalizeFraction(mult);
  if (!frac) return "";
  if (frac.num === frac.den) return "";
  if (frac.den === 1) return String(frac.num);
  if (frac.num === 1) return `/${frac.den}`;
  return `${frac.num}/${frac.den}`;
}

function slicePatternTokens(tokens, startUnit, length) {
  const out = [];
  let cursor = 0;
  for (const token of tokens) {
    const tokenStart = cursor;
    const tokenEnd = cursor + token.len;
    if (tokenEnd <= startUnit) {
      cursor = tokenEnd;
      continue;
    }
    if (tokenStart >= startUnit + length) break;
    const sliceStart = Math.max(tokenStart, startUnit);
    const sliceEnd = Math.min(tokenEnd, startUnit + length);
    const sliceLen = sliceEnd - sliceStart;
    if (sliceLen > 0) {
      let type = token.type;
      let hitIndex = token.hitIndex;
      if (token.type === "d" && sliceStart > tokenStart) {
        type = "z";
        hitIndex = null;
      }
      out.push({ type, len: sliceLen, hitIndex });
    }
    cursor = tokenEnd;
  }
  return out;
}

function buildPitchMap(pitches) {
  const unique = [];
  const seen = new Set();
  for (const pitch of pitches) {
    if (!Number.isFinite(pitch)) continue;
    if (seen.has(pitch)) continue;
    seen.add(pitch);
    unique.push(pitch);
  }
  // For percussion (%%MIDI drummap), the ABC "note" token is only a stable key.
  // The actual sound comes from the MIDI pitch mapping, so we prefer visually clear tokens
  // that sit in the middle of the staff (c/d/...) over ledger-line-heavy low tokens (C,/D,).
  const palette = [
    "c", "d", "e", "f", "g", "a", "b",
    "C", "D", "E", "F", "G", "A", "B",
    "c'", "d'", "e'", "f'", "g'", "a'", "b'",
    "C,", "D,", "E,", "F,", "G,", "A,", "B,",
  ];
  const map = new Map();
  let idx = 0;
  for (const pitch of unique) {
    const note = palette[idx % palette.length];
    map.set(pitch, note);
    idx += 1;
  }
  return map;
}

function extractDrumPlaybackBars(text) {
  const lines = String(text || "").split(/\r\n|\n|\r/);
  let meter = { num: 4, den: 4 };
  let unit = { num: 1, den: 8 };
  let drumOn = false;
  let drumBars = 1;
  let currentPattern = null;
  let inBody = false;
  let currentVoice = null;
  let primaryVoice = null;
  let firstVoice = null;
  let pendingStartToken = null;
  let hasContent = false;
  let barSourceText = "";
  let leadingToken = null;
  let inTextBlock = false;
  const bars = [];
  const patterns = [];
  let pendingDirectives = [];
  const lineIndents = new Map();
  const recordFieldDirective = (field, value, { inline = false } = {}) => {
    const f = String(field || "").trim().toUpperCase();
    const v = String(value || "").trim();
    if (!f || !v) return;
    if (f !== "M" && f !== "L" && f !== "Q") return;
    const text = inline ? `[${f}:${v}]` : `${f}:${v}`;
    pendingDirectives.push(text);
  };
  function applyMidiDirective(directiveLine) {
    const line = String(directiveLine || "").trim();
    if (!line) return;
    if (/^%%MIDI\s+drumon\b/i.test(line)) {
      drumOn = true;
      return;
    }
    if (/^%%MIDI\s+drumoff\b/i.test(line)) {
      drumOn = false;
      return;
    }
    const drumBarsMatch = line.match(/^%%MIDI\s+drumbars\s+(\d+)/i);
    if (drumBarsMatch) {
      const nextBars = Number(drumBarsMatch[1]);
      if (Number.isFinite(nextBars) && nextBars > 0) drumBars = nextBars;
      return;
    }
    const drumMatch = line.match(/^%%MIDI\s+drum\s+(.+)$/i);
    if (drumMatch) {
      const rest = drumMatch[1].trim();
      // Compatibility feature (ABCarus): allow continuation for long directives via `+:`.
      // Example:
      //   %%MIDI drum d3 d d z d
      //   %%MIDI drum +: 36 37 37 37
      //   %%MIDI drum +: 100 120 120 120
      // abc2svg does not define this behavior, but users often write long drum directives this way.
      if (/^\+:/i.test(rest)) {
        if (!currentPattern || !currentPattern.hitCount) return;
        const nums = rest.replace(/^\+:\s*/i, "").split(/\s+/).map((n) => Number(n)).filter((n) => Number.isFinite(n));
        if (!nums.length) return;
        const needed = Number(currentPattern.hitCount) || 0;
        let i = 0;
        while (i < nums.length && currentPattern.pitches.length < needed) currentPattern.pitches.push(nums[i++]);
        while (i < nums.length && currentPattern.velocities.length < needed) currentPattern.velocities.push(nums[i++]);
        return;
      }

      const tokens = rest.split(/\s+/).filter(Boolean);
      // Pattern is the concatenation of non-numeric tokens at the start.
      // This makes `%%MIDI drum d3 d d z d` work as if it was `d3ddzd`.
      const isInt = (t) => /^-?\d+$/.test(String(t || "").trim());
      let firstNum = -1;
      for (let i = 0; i < tokens.length; i += 1) {
        if (isInt(tokens[i])) { firstNum = i; break; }
      }
      const patternTokens = (firstNum === -1 ? tokens : tokens.slice(0, firstNum)).filter((t) => t !== "+:");
      const patternText = patternTokens.join("");
      const pattern = parseDrumPattern(patternText);
      if (!pattern) return;

      const nums = (firstNum === -1 ? [] : tokens.slice(firstNum))
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n));
      const pitchCount = pattern.hitCount || 0;
      const pitches = nums.slice(0, pitchCount);
      const velocities = nums.slice(pitchCount, pitchCount * 2);
      currentPattern = {
        id: patterns.length + 1,
        raw: patternText,
        tokens: pattern.tokens,
        totalUnits: pattern.totalUnits,
        hitCount: pattern.hitCount,
        pitches,
        velocities,
      };
      patterns.push(currentPattern);
    }
  }
  const applyInlineField = (field, value) => {
    const f = String(field || "").trim().toUpperCase();
    const v = String(value || "").trim();
    if (!f) return;
    if (f === "V") {
      const voice = v.split(/\s+/)[0];
      if (voice) {
        currentVoice = voice;
        if (!firstVoice) firstVoice = voice;
        if (inBody && !primaryVoice) primaryVoice = voice;
      }
      return;
    }
    if (f === "K") {
      inBody = true;
      if (!primaryVoice && firstVoice) primaryVoice = firstVoice;
      return;
    }
    if (f === "M") {
      const parsed = parseFraction(v);
      if (parsed) meter = parsed;
      recordFieldDirective("M", v, { inline: true });
      return;
    }
    if (f === "L") {
      const parsed = parseFraction(v);
      if (parsed) unit = parsed;
      recordFieldDirective("L", v, { inline: true });
      return;
    }
    if (f === "Q") {
      recordFieldDirective("Q", v, { inline: true });
      return;
    }
    if (f === "I") {
      // Support inline MIDI directives like [I:MIDI drum ...]
      const cleaned = v.replace(/^\s*MIDI\s+/i, "");
      if (cleaned !== v) {
        const midiLine = `%%MIDI ${cleaned}`;
        applyMidiDirective(midiLine);
      }
    }
  };
  const applyInlineFieldsFromLine = (line) => {
    const s = String(line || "");
    const re = /\[\s*([A-Za-z]+)\s*:\s*([^\]]*)\]/g;
    let match = null;
    while ((match = re.exec(s)) !== null) {
      applyInlineField(match[1], match[2]);
    }
  };
  const parseFieldValue = (line, field) => {
    const re = new RegExp(`\\b${field}:\\s*([^\\]\\s]+)`);
    const match = line.match(re);
    return match ? match[1] : null;
  };
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex];
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    // Compatibility feature (ABCarus): allow `+:` continuation lines for long directives.
    // If users choose to omit repeating the directive prefix (e.g. `+: 36 37 ...` after `%%MIDI drum ...`),
    // treat it as continuing the last `%%MIDI drum` line for drum extraction.
    if (/^\+:/i.test(trimmed)) {
      applyMidiDirective(`%%MIDI drum ${trimmed}`);
      continue;
    }
    // Inline field directives like "[P:...]" or "[M:...]" are not musical bars, but some of them
    // affect playback state (meter/unit/voice/body start), so we handle those and skip scanning.
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      // Handle multi-inline-field lines like: [M:7/8][Q:1/4=220]
      const remainder = trimmed.replace(/\[\s*[A-Za-z]+\s*:\s*[^\]]*\]/g, "").trim();
      if (remainder === "") {
        applyInlineFieldsFromLine(trimmed);
        continue;
      }
    }
    if (trimmed.startsWith("V:")) {
      const v = trimmed.slice(2).trim().split(/\s+/)[0];
      if (v) {
        currentVoice = v;
        if (!firstVoice) firstVoice = v;
        if (inBody && !primaryVoice) primaryVoice = v;
      }
      // Voice declaration lines are not musical content. Do not scan them for barlines or note letters,
      // otherwise tokens like "treble" can be mis-read as notes and shift the repeat/bar skeleton.
      continue;
    }
    if (!inBody) {
      const kValue = parseFieldValue(trimmed, "K");
      if (kValue != null) {
        inBody = true;
        if (!primaryVoice && firstVoice) primaryVoice = firstVoice;
      }
    }
    const meterValue = parseFieldValue(trimmed, "M");
    if (meterValue) {
      const parsed = parseFraction(meterValue);
      if (parsed) meter = parsed;
      if (inBody && /^\s*M:/.test(trimmed)) recordFieldDirective("M", meterValue, { inline: false });
    }
    const unitValue = parseFieldValue(trimmed, "L");
    if (unitValue) {
      const parsed = parseFraction(unitValue);
      if (parsed) unit = parsed;
      if (inBody && /^\s*L:/.test(trimmed)) recordFieldDirective("L", unitValue, { inline: false });
    }
    const tempoValue = parseFieldValue(trimmed, "Q");
    if (tempoValue) {
      if (inBody && /^\s*Q:/.test(trimmed)) recordFieldDirective("Q", tempoValue, { inline: false });
    }
    if (/^%%MIDI\b/i.test(trimmed)) {
      applyMidiDirective(trimmed);
      continue;
    }
    if (/^I:\s*MIDI\b/i.test(trimmed)) {
      const midiLine = trimmed.replace(/^I:\s*/i, "%%");
      applyMidiDirective(midiLine);
      continue;
    }
    if (!inBody) continue;
    if (/^%/.test(trimmed)) continue;
    if (/^%%\s*begintext\b/i.test(trimmed)) {
      inTextBlock = true;
      continue;
    }
    if (/^%%\s*endtext\b/i.test(trimmed)) {
      inTextBlock = false;
      continue;
    }
    if (inTextBlock) continue;
    if (/^%%/.test(trimmed)) continue;
    if (/^[Ww]:/.test(trimmed)) continue;
    if (/^[A-Za-z]:/.test(trimmed) && !/^V:/.test(trimmed)) continue;
    if (!primaryVoice && currentVoice) primaryVoice = currentVoice;
    if (primaryVoice && currentVoice && currentVoice !== primaryVoice) continue;
    if (!lineIndents.has(lineIndex)) {
      const indent = String(rawLine || "").match(/^[\t ]*/)?.[0] ?? "";
      lineIndents.set(lineIndex, indent);
    }
    let line = rawLine;
    if (!trimmed.startsWith("%%")) {
      const idx = line.indexOf("%");
      if (idx >= 0) line = line.slice(0, idx);
    }
    let inQuote = false;
    for (let i = 0; i < line.length; ) {
      const ch = line[i];
      if (!inQuote && ch === "[") {
        const slice = line.slice(i);
        if (/^\[\s*[A-Za-z]+:/.test(slice)) {
          const close = line.indexOf("]", i + 1);
          if (close >= 0) {
            const inner = line.slice(i + 1, close);
            const match = inner.match(/^\s*([A-Za-z]+)\s*:\s*(.*)\s*$/);
            if (match) applyInlineField(match[1], match[2]);
            i = close + 1;
            continue;
          }
        }
      }
      if (ch === "\"") {
        inQuote = !inQuote;
        i += 1;
        continue;
      }
      if (!inQuote) {
        const token = matchBarToken(line, i);
        if (token) {
          if (hasContent) {
            bars.push({
              meter,
              unit,
              drumOn,
              drumBars,
              pattern: currentPattern,
              directives: pendingDirectives,
              startToken: pendingStartToken,
              endToken: token.token,
              sourceText: barSourceText.trim(),
              srcLineIndex: lineIndex,
            });
            pendingDirectives = [];
            pendingStartToken = null;
            hasContent = false;
            barSourceText = "";
          } else {
            pendingStartToken = token.token;
            if (!leadingToken && bars.length === 0) {
              leadingToken = token.token;
            }
            barSourceText = "";
          }
          i += token.len;
          continue;
        }
        if (/[A-Ga-gz]/.test(ch)) hasContent = true;
        barSourceText += ch;
      }
      i += 1;
    }
  }
  return { bars, patterns, leadingToken, lineIndents, trailingDirectives: pendingDirectives };
}

function buildDrumVoiceText(info) {
  if (!info || !info.bars || !info.bars.length) return "";
  const bars = info.bars;
  const usedPitches = [];
  let hasActivePattern = false;
  for (const bar of bars) {
    if (!bar.drumOn || !bar.pattern || !bar.pattern.pitches) continue;
    hasActivePattern = true;
    for (const pitch of bar.pattern.pitches) usedPitches.push(pitch);
  }
  if (!usedPitches.length) {
    if (!hasActivePattern) return "";
    usedPitches.push(35);
  }
  const pitchMap = buildPitchMap(usedPitches);
  const drummapLines = [];
  for (const [pitch, note] of pitchMap.entries()) {
    drummapLines.push(`%%MIDI drummap ${note} ${pitch}`);
  }

  const out = [];
  out.push("V:DRUM clef=perc name=\"Drums\"");
  out.push("%%MIDI channel 10");
  out.push(...drummapLines);

  let patternKey = null;
  let patternBarIndex = 0;
  let wasOn = false;
  let resetPatternNext = false;
  let lineBuffer = "";
  let currentLineIndex = null;

  const flushLine = () => {
    if (lineBuffer) out.push(lineBuffer);
    lineBuffer = "";
    currentLineIndex = null;
  };
  const toDurationFraction = (units) => {
    const u = Number(units);
    if (!Number.isFinite(u) || u <= 0) return null;
    const dens = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64];
    for (const den of dens) {
      const num = Math.round(u * den);
      if (num <= 0) continue;
      if (Math.abs((num / den) - u) <= 1e-6) return { num, den };
    }
    return { num: Math.max(1, Math.round(u * 64)), den: 64 };
  };

  for (let barIndex = 0; barIndex < bars.length; barIndex += 1) {
    const bar = bars[barIndex];
    const directives = Array.isArray(bar.directives) ? bar.directives : [];
    if (directives.length) {
      if (lineBuffer) {
        flushLine();
      }
      for (const directive of directives) {
        if (directive) out.push(String(directive));
      }
    }
    const meter = normalizeFraction(bar.meter) || { num: 4, den: 4 };
    const unit = normalizeFraction(bar.unit) || { num: 1, den: 8 };
    const barUnits = fractionDiv(meter, unit);
    let barText = "";

    const startToken = bar.startToken || "";
    const endToken = bar.endToken || "";
    let resetPatternHere = resetPatternNext;
    resetPatternNext = false;
    // Reset at repeat/volta boundaries so each segment starts from bar 1 of the drum pattern.
    if (startToken && (/\|:/.test(startToken) || /\[\d/.test(startToken) || /\|\|/.test(startToken))) {
      resetPatternHere = true;
    }
    if (endToken && (/:\|/.test(endToken) || /\|\|/.test(endToken) || /\|\]/.test(endToken))) {
      resetPatternNext = true;
    }

    const meterValue = Number(meter.num) / Number(meter.den);
    const defaultLen = Number(unit.num) / Number(unit.den);
    const isAnacrusisBar = (
      barIndex === 0
      && Number.isFinite(meterValue)
      && Number.isFinite(defaultLen)
      && isLikelyAnacrusis(String(bar.sourceText || ""), defaultLen, meterValue)
    );
    if (isAnacrusisBar) {
      const actualLen = getBarLength(String(bar.sourceText || ""), defaultLen, meterValue);
      const units = Number.isFinite(actualLen) && defaultLen > 0 ? (actualLen / defaultLen) : null;
      const frac = toDurationFraction(units);
      barText = frac ? `z${formatDuration(frac)}` : `z${formatDuration(barUnits)}`;
      patternKey = null;
      patternBarIndex = 0;
      wasOn = false;
    } else if (!bar.drumOn || !bar.pattern) {
      barText = `z${formatDuration(barUnits)}`;
      patternKey = null;
      patternBarIndex = 0;
      wasOn = false;
    } else {
      const pattern = bar.pattern;
      const key = `${pattern.id}:${bar.drumBars}`;
      if (!wasOn || key !== patternKey || resetPatternHere) patternBarIndex = 0;
      patternKey = key;
      wasOn = true;

      let drumBars = Number(bar.drumBars) || 1;
      let startUnit = 0;
      let length = pattern.totalUnits;
      if (drumBars > 1 && pattern.totalUnits % drumBars === 0) {
        length = pattern.totalUnits / drumBars;
        startUnit = length * (patternBarIndex % drumBars);
      } else {
        drumBars = 1;
        startUnit = 0;
        length = pattern.totalUnits;
      }
      const slice = slicePatternTokens(pattern.tokens, startUnit, length);
      const unitDur = fractionDiv(barUnits, { num: length, den: 1 });
      const parts = [];
      for (const token of slice) {
        const dur = fractionMulInt(unitDur, token.len);
        const durText = formatDuration(dur);
        if (token.type === "z") {
          parts.push(`z${durText}`);
          continue;
        }
        const pitchList = pattern.pitches || [];
        const pitch = pitchList.length
          ? pitchList[token.hitIndex % pitchList.length]
          : 35;
        const note = pitchMap.get(pitch) || "C";
        parts.push(`${note}${durText}`);
      }
      barText = parts.join("");
      patternBarIndex += 1;
    }

    // Strict bar-skeleton mapping:
    // each emitted drum bar must keep exactly the same start/end bar tokens as the source bar.
    // No inferred separators, no line-boundary injected bar tokens.
    const startTokenOut = String(bar.startToken || "");
    const endTokenOut = String(bar.endToken || "|");
    const emittedBar = `${startTokenOut}${barText}${endTokenOut}`;

    if (!lineBuffer) {
      const lineKey = Number.isFinite(bar.srcLineIndex) ? bar.srcLineIndex : null;
      currentLineIndex = lineKey;
      // Keep drum payload compact/readable for diagnostics: no inherited visual indentation.
      lineBuffer = "";
    }
    lineBuffer += emittedBar;

    // If the tune ends explicitly with `|]`, stop emitting further drum bars.
    if (bar.endToken && /\|\]/.test(bar.endToken)) {
      break;
    }

    const nextBar = bars[barIndex + 1] || null;
    const nextLineKey = nextBar && Number.isFinite(nextBar.srcLineIndex) ? nextBar.srcLineIndex : null;
    if (currentLineIndex != null && nextLineKey != null && nextLineKey !== currentLineIndex) {
      // Preserve source wrapping only; do not invent additional bar separators on line breaks.
      flushLine();
    }
  }
  if (lineBuffer) flushLine();
  const trailing = Array.isArray(info.trailingDirectives) ? info.trailingDirectives : [];
  for (const directive of trailing) {
    if (directive) out.push(String(directive));
  }
  return out.join("\n");
}

function normalizeLeadingInlineDirectivesForPlayback(text) {
  const lines = String(text || "").split(/\r\n|\n|\r/);
  const out = [];
  const tokenRe = /^\[\s*([A-Za-z]+)\s*:\s*([^\]]*)\]\s*/;

  for (const rawLine of lines) {
    const indent = String(rawLine || "").match(/^[\t ]*/)?.[0] ?? "";
    let rest = String(rawLine || "").slice(indent.length);
    if (!rest.startsWith("[")) {
      out.push(rawLine);
      continue;
    }

    const directives = [];
    const keptTokens = [];
    let consumedAny = false;

    while (rest.startsWith("[")) {
      const match = rest.match(tokenRe);
      if (!match) break;
      consumedAny = true;
      const rawToken = match[0];
      const field = String(match[1] || "").trim().toUpperCase();
      const value = String(match[2] || "").trim();
      rest = rest.slice(rawToken.length);

      let converted = null;
      if ((field === "M" || field === "L" || field === "Q") && value) {
        converted = `${field}:${value}`;
      } else if (field === "I" && /^MIDI\s+/i.test(value)) {
        const cleaned = value.replace(/^MIDI\s+/i, "").trim();
        if (cleaned) converted = `%%MIDI ${cleaned}`;
      }

      if (converted) {
        directives.push(`${indent}${converted}`);
      } else {
        keptTokens.push(rawToken.trim());
      }
    }

    if (!consumedAny || !directives.length) {
      out.push(rawLine);
      continue;
    }

    out.push(...directives);
    const keptPrefix = keptTokens.length ? `${keptTokens.join(" ")} ` : "";
    const remainder = `${indent}${keptPrefix}${rest}`.replace(/[ \t]+$/g, "");
    if (remainder.trim()) out.push(remainder);
  }

  return out.join("\n");
}

function injectGchordOn(text, insertAt) {
  const lines = String(text || "").split(/\r\n|\n|\r/);
  let hasGchordPattern = false;
  let hasGchordToggle = false;
  let inTextBlock = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    if (/^%%\s*begintext\b/i.test(trimmed)) {
      inTextBlock = true;
      continue;
    }
    if (/^%%\s*endtext\b/i.test(trimmed)) {
      inTextBlock = false;
      continue;
    }
    if (inTextBlock) continue;
    if (/^%/.test(trimmed) && !/^%%/.test(trimmed)) continue;
    if (/^%%MIDI\s+gchord(on|off)\b/i.test(trimmed)) {
      hasGchordToggle = true;
      continue;
    }
    if (/^%%MIDI\s+gchord\b/i.test(trimmed)) {
      hasGchordPattern = true;
    }
  }

  if (!hasGchordPattern || hasGchordToggle) {
    return { text, changed: false, offsetDelta: 0 };
  }

  const safeInsertAt = Number.isFinite(insertAt) ? insertAt : 0;
  let insertText = "%%MIDI gchordon\n";
  if (safeInsertAt > 0 && text[safeInsertAt - 1] !== "\n") {
    insertText = `\n${insertText}`;
  }
  const merged = `${text.slice(0, safeInsertAt)}${insertText}${text.slice(safeInsertAt)}`;
  return { text: merged, changed: true, offsetDelta: insertText.length };
}

function normalizeDollarLineBreaksForPlayback(text) {
  const src = String(text || "");
  if (!src.includes("$")) return src;
  // Playback-only cleanup:
  // - Drop "$ %..." tails (common bar/line markers used for layout, irrelevant for playback/drums).
  // - Replace other '$' occurrences with whitespace (some playback parsers treat '$' as a literal token and break repeats).
  const lines = src.split(/\r\n|\n|\r/);
  const out = [];
  let inTextBlock = false;
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (/^%%\s*begintext\b/i.test(trimmed)) inTextBlock = true;
    if (/^%%\s*endtext\b/i.test(trimmed)) inTextBlock = false;
    // Don't modify linebreak directives themselves; some files use `I:linebreak $`.
    if (!inTextBlock && (/^\s*I:\s*linebreak\b/i.test(rawLine) || /^\s*%%\s*linebreak\b/i.test(rawLine))) {
      out.push(rawLine);
      continue;
    }
    if (inTextBlock || !rawLine.includes("$")) {
      out.push(rawLine);
      continue;
    }
    let lineOut = "";
    let inQuote = false;
    for (let i = 0; i < rawLine.length; i += 1) {
      const ch = rawLine[i];
      if (ch === "\"") {
        inQuote = !inQuote;
        lineOut += ch;
        continue;
      }
      if (!inQuote && ch === "$") {
        lineOut += " ";
        continue;
      }
      lineOut += ch;
    }
    out.push(lineOut);
  }
  return out.join("\n");
}

function normalizeBlankLinesForPlayback(text) {
  const lines = String(text || "").split(/\r\n|\n|\r/);
  if (lines.length <= 2) return String(text || "");
  const out = [];
  let inTextBlock = false;
  let inBody = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (/^%%\s*begintext\b/i.test(trimmed)) inTextBlock = true;
    if (/^%%\s*endtext\b/i.test(trimmed)) inTextBlock = false;
    if (!inBody && (/^\s*K:/.test(line) || /^\s*\[\s*K:/.test(trimmed))) inBody = true;
    if (!inBody || inTextBlock) {
      out.push(line);
      continue;
    }
    if (trimmed !== "") {
      out.push(line);
      continue;
    }
    // Inside tune body, blank lines can be parsed as tune separators and stop playback.
    // Keep output stable by replacing them with comment placeholders.
    out.push("%");
  }
  return out.join("\n");
}

function sanitizeAbcForPlayback(text) {
  const src = String(text || "");
  const lines = src.split(/\r\n|\n|\r/);
  const out = [];
  const warnings = [];
  let inTextBlock = false;
  let inBody = false;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex];
    const trimmed = rawLine.trim();
    if (/^%%\s*begintext\b/i.test(trimmed)) inTextBlock = true;
    if (/^%%\s*endtext\b/i.test(trimmed)) inTextBlock = false;
    if (!inBody && (/^\s*K:/.test(rawLine) || /^\s*\[\s*K:/.test(trimmed))) inBody = true;

    if (inTextBlock || !inBody) {
      // Still remove line-continuation backslashes outside text blocks even before body;
      // they are never meaningful for playback parsing.
      const cleaned = rawLine.replace(/[ \t]*\\\s*$/, (m) => {
        warnings.push({ kind: "line-continuation", line: lineIndex + 1 });
        return " ".repeat(String(m || "").length);
      });
      out.push(cleaned);
      continue;
    }

    // Split comments (keep them intact; only sanitize music part).
    let musicPart = rawLine;
    let commentPart = "";
    if (!trimmed.startsWith("%%")) {
      const commentIdx = rawLine.indexOf("%");
      if (commentIdx >= 0) {
        musicPart = rawLine.slice(0, commentIdx);
        commentPart = rawLine.slice(commentIdx);
      }
    }

    // 1) Remove trailing line-continuation backslash: `...\` -> `...`
    musicPart = musicPart.replace(/[ \t]*\\\s*$/, (m) => {
      warnings.push({ kind: "line-continuation", line: lineIndex + 1 });
      return " ".repeat(String(m || "").length);
    });

    // 2) Make multi-repeat tokens more stable: `|:::` -> `|::`, `:::` -> `::`, `:::|` -> `::|`
    // Keep `::` unchanged (common boundary repeat); only collapse 3+ down to the double-repeat form.
    const beforeRepeats = musicPart;
    musicPart = musicPart
      .replace(/\|:{3,}/g, (m) => `|::${" ".repeat(Math.max(0, String(m || "").length - 3))}`)
      .replace(/:{3,}\|/g, (m) => `::|${" ".repeat(Math.max(0, String(m || "").length - 3))}`)
      .replace(/:{3,}/g, (m) => `::${" ".repeat(Math.max(0, String(m || "").length - 2))}`);
    if (musicPart !== beforeRepeats) warnings.push({ kind: "multi-repeat-simplified", line: lineIndex + 1 });

    // 3) Replace spacer rests `y` with normal rests `z` (playback-only stability).
    // Target `y` tokens with optional durations like `y4`, `y2/`, `y/2`.
    const beforeY = musicPart;
    musicPart = musicPart.replace(/(^|[^A-Za-z0-9_])y(?=([0-9]|\/|$))/g, "$1z");
    if (musicPart !== beforeY) warnings.push({ kind: "spacer-rest-y", line: lineIndex + 1 });

    out.push(`${musicPart}${commentPart}`);
  }

  return { text: out.join("\n"), warnings };
}

function isInlineFieldOnlyLine(rawLine) {
  const trimmed = String(rawLine || "").trim();
  if (!trimmed.startsWith("[")) return false;
  let rest = trimmed;
  // Consume one or more leading inline fields: `[P:...] [M:...] ...`
  while (true) {
    const m = rest.match(/^\[\s*[A-Za-z]+\s*:\s*[^\]]*\]\s*/);
    if (!m) break;
    rest = rest.slice(m[0].length);
  }
  const tail = rest.trim();
  if (!tail) return true;
  // Treat "only comment after inline field" as header-like (no music content).
  if (tail.startsWith("%")) return true;
  return false;
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
    let kIdx = -1;
    for (let i = start; i < end; i += 1) {
      if (isKeyLine(lines[i])) { kIdx = i; break; }
    }
    if (kIdx < 0) return null;

    let block = null;
    let bodyStart = end;
    for (let j = kIdx + 1; j < end; j += 1) {
      const raw = lines[j];
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
      if (!trimmed) continue;
      if (isCommentLine(raw)) continue;
      if (isPartLine(raw)) { bodyStart = j; break; }
      // Inline field-only lines like `[P:A]` or `[M:...]` are tune-body directives (even if they contain no notes).
      // Treat them as the body start so we don't reorder K: past them (it can break P: parts playback).
      if (isInlineFieldOnlyLine(raw)) { bodyStart = j; break; }
      if (isDirectiveLine(raw) || isFieldLine(raw) || isContinuationLine(raw)) continue;
      bodyStart = j;
      break;
    }

    let firstOffender = null;
    for (let j = kIdx + 1; j < bodyStart; j += 1) {
      const raw = lines[j];
      const trimmed = raw.trim();
      if (!trimmed) continue;
      if (isCommentLine(raw)) continue;
      if (isDirectiveLine(raw) || isFieldLine(raw) || isContinuationLine(raw)) {
        firstOffender = { line: j + 1, text: raw };
        break;
      }
    }
    if (!firstOffender) return null;

    const tuneLabel = (() => {
      for (let i = start; i < end; i += 1) {
        const m = String(lines[i] || "").match(/^\s*X:\s*(\d+)/);
        if (m) return `X:${m[1]}`;
      }
      return null;
    })();

    return {
      kind: "abc2svg-k-field-not-last",
      loc: { line: firstOffender.line, col: 1 },
      detail: `${tuneLabel ? `${tuneLabel}: ` : ""}K: is not the last header field before the music. abc2svg playback may fail when directives/fields appear after K:.`,
    };
  };

  let start = 0;
  let sawTuneStart = false;
  for (let i = 0; i < lines.length; i += 1) {
    if (isTuneStart(lines[i])) {
      if (sawTuneStart) {
        const warn = scanTune(start, i);
        if (warn) return warn;
        start = i;
      } else {
        sawTuneStart = true;
        start = i;
      }
    }
  }
  const warn = scanTune(sawTuneStart ? start : 0, lines.length);
  return warn || null;
}

function normalizeKeyFieldToBeLastBeforeBodyForPlayback(text) {
  const lines = String(text || "").split(/\r\n|\n|\r/);
  const isTuneStart = (line) => /^\s*X:/.test(line);
  const isFieldLine = (line) => /^\s*[A-Za-z]:/.test(line);
  const isContinuationLine = (line) => /^\s*\+:\s*/.test(line);
  const isKeyLine = (line) => /^\s*K:/.test(line);
  const isVoiceLine = (line) => /^\s*V:/.test(line);
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

  const normalizeTune = (start, end) => {
    let kIdx = -1;
    for (let i = start; i < end; i += 1) {
      if (isKeyLine(lines[i])) { kIdx = i; break; }
    }
    if (kIdx < 0) return false;

    let block = null;
    let bodyStart = end;
    for (let j = kIdx + 1; j < end; j += 1) {
      const raw = lines[j];
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
      if (!trimmed) continue;
      if (isCommentLine(raw)) continue;
      // Treat P: like tune-body start for playback ordering: K: must be the last *header* field,
      // but P: is a body marker and often precedes the first music line.
      if (isPartLine(raw)) { bodyStart = j; break; }
      // Inline field-only lines like `[P:A]` or `[M:...]` are tune-body directives (even if they contain no notes).
      // Treat them as the body start so we don't reorder K: past them (it can break P: parts playback).
      if (isInlineFieldOnlyLine(raw)) { bodyStart = j; break; }
      if (isDirectiveLine(raw) || isFieldLine(raw) || isContinuationLine(raw)) continue;
      bodyStart = j;
      break;
    }
    if (bodyStart <= kIdx + 1) return false;

    let hasPostKeyHeader = false;
    for (let j = kIdx + 1; j < bodyStart; j += 1) {
      const raw = lines[j];
      const trimmed = raw.trim();
      if (!trimmed) continue;
      if (isCommentLine(raw)) continue;
      if (isDirectiveLine(raw) || isFieldLine(raw) || isContinuationLine(raw)) {
        hasPostKeyHeader = true;
        break;
      }
    }
    if (!hasPostKeyHeader) return false;

    const insertAt = bodyStart - 1;
    if (insertAt <= kIdx) return false;

    // Offset-stable normalization:
    // Instead of moving lines (which shifts character offsets and breaks Follow/SVG mapping),
    // relocate the *content* of K: to the last header line slot while preserving line lengths.
    //
    // We intentionally sacrifice the original content of the destination line (typically %%score / directives),
    // but keep all other post-K header lines (notably V:) intact.
    //
    // If the last header line is a voice header, we refuse to do the swap (losing V: would break playback).
    // In that rare case, we keep the original order and let other compat paths handle playback.
    const dstRaw = lines[insertAt] || "";
    if (isVoiceLine(dstRaw)) return false;

    const kLine = lines[kIdx] || "";
    const dstLen = String(dstRaw).length;
    const kTrimmed = kLine.replace(/[\r\n]+$/, "");
    if (dstLen < kTrimmed.length) return false;
    const kPadded = (kTrimmed.length >= dstLen)
      ? kTrimmed.slice(0, dstLen)
      : (kTrimmed + " ".repeat(dstLen - kTrimmed.length));

    const srcLen = String(kLine).length;
    const placeholder = srcLen <= 0 ? "%" : (`%${" ".repeat(Math.max(0, srcLen - 1))}`);

    lines[kIdx] = placeholder;
    lines[insertAt] = kPadded;
    return true;
  };

  let changed = false;
  let start = 0;
  let sawTuneStart = false;
  for (let i = 0; i < lines.length; i += 1) {
    if (isTuneStart(lines[i])) {
      if (sawTuneStart) {
        if (normalizeTune(start, i)) changed = true;
        start = i;
      } else {
        sawTuneStart = true;
        start = i;
      }
    }
  }
  if (normalizeTune(sawTuneStart ? start : 0, lines.length)) changed = true;
  return { text: lines.join("\n"), changed };
}

function stripLyricsForPlayback(text) {
  // Important: keep the output string length identical to the input.
  // Follow/highlighting depends on stable character offsets between playback text and rendered SVG.
  const lines = String(text || "").split(/\r\n|\n|\r/);
  const out = [];
  let inTextBlock = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^%%\s*begintext\b/i.test(trimmed)) inTextBlock = true;
    if (/^%%\s*endtext\b/i.test(trimmed)) inTextBlock = false;
    if (inTextBlock) {
      out.push(line);
      continue;
    }
    if (/^\s*w:/.test(line) || /^\s*W:/.test(line)) {
      const len = String(line || "").length;
      if (len <= 0) out.push("%");
      else out.push(`%${" ".repeat(Math.max(0, len - 1))}`);
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

function normalizeBarsForPlayback(text) {
  // abc2svg is strict about barline consistency across voices. Some sources mix `||` and `|` at the same moment,
  // which other players may ignore. For playback-only stability, normalize multi-bars to a single bar.
  // Keep string length stable for Follow mapping: replace `||` with `| ` (bar + space).
  const lines = String(text || "").split(/\r\n|\n|\r/);
  const out = [];
  let inTextBlock = false;
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (/^%%\s*begintext\b/i.test(trimmed)) inTextBlock = true;
    if (/^%%\s*endtext\b/i.test(trimmed)) inTextBlock = false;
    if (inTextBlock) {
      out.push(rawLine);
      continue;
    }
    // Leave directives untouched.
    if (/^\s*%%/.test(rawLine) || /^\s*[A-Za-z]:/.test(rawLine) || isInlineFieldOnlyLine(rawLine)) {
      out.push(rawLine);
      continue;
    }
    out.push(rawLine.replace(/\|\|/g, "| "));
  }
  return out.join("\n");
}

function stripChordSymbolsForPlayback(text) {
  const src = String(text || "");
  if (!src.includes("\"")) return src;
  const lines = src.split(/\r\n|\n|\r/);
  const out = [];
  let inTextBlock = false;
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (/^%%\s*begintext\b/i.test(trimmed)) inTextBlock = true;
    if (/^%%\s*endtext\b/i.test(trimmed)) inTextBlock = false;
    if (inTextBlock) {
      out.push(rawLine);
      continue;
    }
    // Do not touch header/directive-only lines (e.g. V:... nm="...").
    // We only want to suppress inline chord symbols in music body lines.
    if (/^\s*%%/.test(rawLine) || /^\s*[A-Za-z]:/.test(rawLine) || isInlineFieldOnlyLine(rawLine)) {
      out.push(rawLine);
      continue;
    }
    // Remove chord symbols / annotations in quotes. Playback stability > chord display here.
    // Keep the rest of the line intact and preserve line length for Follow mapping.
    const stripped = rawLine.replace(/\"[^\"]*\"/g, (m) => " ".repeat(String(m || "").length));
    if (stripped.trim() === "") {
      const len = String(stripped || "").length;
      out.push(len > 0 ? `%${" ".repeat(Math.max(0, len - 1))}` : "%");
    } else {
      out.push(stripped);
    }
  }
  return out.join("\n");
}

function extractBarSignatureFromText(text) {
  const lines = String(text || "").split(/\r\n|\n|\r/);
  const sig = [];
  let inTextBlock = false;
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (/^%%\s*begintext\b/i.test(trimmed)) { inTextBlock = true; continue; }
    if (/^%%\s*endtext\b/i.test(trimmed)) { inTextBlock = false; continue; }
    if (inTextBlock) continue;
    if (!trimmed) continue;
    // Skip directives/fields that may contain ':' but are not musical bars.
    if (/^\s*%%/.test(rawLine)) continue;
    if (/^\s*[A-Za-z]:/.test(rawLine)) continue;
    if (isInlineFieldOnlyLine(rawLine)) continue;
    if (/^%/.test(trimmed) && !/^%%/.test(trimmed)) continue;
    let line = rawLine;
    const idx = line.indexOf("%");
    if (idx >= 0 && !/^\s*%%/.test(trimmed)) line = line.slice(0, idx);
    let inQuote = false;
    for (let i = 0; i < line.length; ) {
      const ch = line[i];
      if (!inQuote && ch === "[") {
        const slice = line.slice(i);
        if (/^\[\s*[A-Za-z]+:/.test(slice)) {
          const close = line.indexOf("]", i + 1);
          if (close >= 0) { i = close + 1; continue; }
        }
      }
      if (ch === "\"") { inQuote = !inQuote; i += 1; continue; }
      if (!inQuote) {
        const token = matchBarToken(line, i);
        if (token) {
          sig.push(token.token);
          i += token.len;
          continue;
        }
      }
      i += 1;
    }
  }
  return sig;
}

function computeExpectedBarSignatureFromInfo(info) {
  const sig = [];
  if (!info || !Array.isArray(info.bars)) return sig;
  const bars = info.bars;
  for (let i = 0; i < bars.length; i += 1) {
    const bar = bars[i];
    if (bar && bar.startToken) sig.push(String(bar.startToken));
    sig.push((bar && bar.endToken) ? String(bar.endToken) : "|");
  }
  return sig;
}

function diffSignatures(expected, actual) {
  const clean = (arr) => (Array.isArray(arr) ? arr.filter((t) => t != null) : []);
  const a = clean(expected);
  const b = clean(actual);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    if (a[i] !== b[i]) {
      const from = Math.max(0, i - 6);
      const to = Math.min(len, i + 7);
      return {
        ok: false,
        index: i,
        expectedToken: a[i] ?? null,
        actualToken: b[i] ?? null,
        expectedLen: a.length,
        actualLen: b.length,
        expectedSlice: a.slice(from, to),
        actualSlice: b.slice(from, to),
      };
    }
  }
  return { ok: true, expectedLen: a.length, actualLen: b.length };
}

export {
  buildDrumVoiceText,
  computeExpectedBarSignatureFromInfo,
  detectKeyFieldNotLastBeforeBody,
  diffSignatures,
  extractBarSignatureFromText,
  extractDrumPlaybackBars,
  injectGchordOn,
  isInlineFieldOnlyLine,
  normalizeBarsForPlayback,
  normalizeBlankLinesForPlayback,
  normalizeDollarLineBreaksForPlayback,
  normalizeKeyFieldToBeLastBeforeBodyForPlayback,
  normalizeLeadingInlineDirectivesForPlayback,
  sanitizeAbcForPlayback,
  stripChordSymbolsForPlayback,
  stripLyricsForPlayback,
};
