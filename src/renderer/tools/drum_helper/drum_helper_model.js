import {
  clampVelocity,
  DEFAULT_DRUM_VELOCITY,
  DRUM_INSTRUMENTS,
} from "../../drums.js";

function parseDrumPattern(pattern) {
  const raw = String(pattern || "").trim();
  if (!raw) return null;
  const tokens = [];
  let hitIndex = 0;
  let totalUnits = 0;
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch !== "d" && ch !== "z") {
      i += 1;
      continue;
    }
    i += 1;
    let num = "";
    while (i < raw.length && /[0-9]/.test(raw[i])) {
      num += raw[i];
      i += 1;
    }
    const len = num ? Number(num) : 1;
    if (!Number.isFinite(len) || len <= 0) continue;
    const token = { type: ch, len };
    if (ch === "d") {
      token.hitIndex = hitIndex;
      hitIndex += 1;
    }
    tokens.push(token);
    totalUnits += len;
  }
  if (!tokens.length || totalUnits <= 0) return null;
  return { tokens, totalUnits, hitCount: hitIndex };
}

function getDrumInstrumentNameForPitch(pitch) {
  const p = Number(pitch);
  if (!Number.isFinite(p)) return "";
  const item = DRUM_INSTRUMENTS.find((d) => d && Number(d.pitch) === p);
  return item && item.name ? String(item.name).trim().toLowerCase() : `drum ${p}`;
}

function getDrumShortcutForPitch(pitch, used) {
  const name = getDrumInstrumentNameForPitch(pitch);
  const words = name.split(/\s+/).filter(Boolean);
  const candidates = [];
  for (let i = 0; i < words.length; i += 1) {
    const ch = words[i] && words[i][0] ? words[i][0].toUpperCase() : "";
    if (ch && /^[A-Z0-9]$/.test(ch)) candidates.push(ch);
  }
  for (const word of words) {
    const raw = word.replace(/[^a-z0-9]/gi, "").toUpperCase();
    if (raw.length >= 2) candidates.push(raw.slice(0, 2));
  }
  for (const c of candidates) {
    if (c && !used.has(c)) {
      used.add(c);
      return c;
    }
  }
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (const ch of alphabet) {
    if (!used.has(ch)) {
      used.add(ch);
      return ch;
    }
  }
  let n = 1;
  while (used.has(`D${n}`)) n += 1;
  const key = `D${n}`;
  used.add(key);
  return key;
}

function makeDrumEditModel({
  patternText,
  pitches,
  velocities,
  drumbars,
  name,
  velocityMap = null,
  defaultVelocity = DEFAULT_DRUM_VELOCITY,
} = {}) {
  const pattern = parseDrumPattern(patternText);
  if (!pattern) return null;
  const pitchList = Array.isArray(pitches) ? pitches.filter((n) => Number.isFinite(Number(n))).map((n) => Number(n)) : [];
  const velocityList = Array.isArray(velocities) ? velocities.filter((n) => Number.isFinite(Number(n))).map((n) => clampVelocity(n)) : [];
  const events = [];
  let hitIndex = 0;
  let unit = 0;
  for (const token of pattern.tokens) {
    const len = Math.max(1, Number(token.len) || 1);
    if (token.type === "d") {
      const pitch = pitchList.length ? pitchList[hitIndex % pitchList.length] : 35;
      const velocity = velocityList.length
        ? velocityList[hitIndex % velocityList.length]
        : clampVelocity(velocityMap && Number.isFinite(velocityMap[pitch]) ? velocityMap[pitch] : defaultVelocity);
      events.push({ hitIndex, unit, len, pitch, velocity });
      hitIndex += 1;
    }
    unit += len;
  }
  const bars = Number(drumbars);
  return {
    name: String(name || "drum1").trim() || "drum1",
    patternText: String(patternText || "").trim(),
    pattern,
    pitches: events.map((event) => event.pitch),
    velocities: events.map((event) => event.velocity),
    drumbars: Number.isFinite(bars) && bars > 0 ? Math.floor(bars) : null,
    events,
  };
}

function formatDrumPatternToken(token) {
  if (!token) return "";
  const type = token.type === "z" ? "z" : "d";
  const len = Number(token.len) || 1;
  return `${type}${len === 1 ? "" : String(len)}`;
}

function formatCompactMidiDrum(model, { indent = "", comment = "" } = {}) {
  if (!model) return "";
  const parts = [model.patternText || model.pattern.tokens.map(formatDrumPatternToken).join("")];
  if (model.pitches.length) parts.push(model.pitches.join(" "));
  if (model.velocities.length) parts.push(model.velocities.join(" "));
  const lines = [];
  if (model.drumbars) lines.push(`${indent}%%MIDI drumbars ${model.drumbars}`);
  lines.push(`${indent}%%MIDI drum ${parts.join(" ").trim()}${comment || ""}`);
  return lines.join("\n");
}

function formatReadableMidiDrum(model, { indent = "", comment = "" } = {}) {
  if (!model) return "";
  const tokenCells = model.pattern.tokens.map(formatDrumPatternToken);
  let widthHit = 0;
  const widths = tokenCells.map((cell, idx) => {
    const token = model.pattern.tokens[idx];
    const event = token && token.type === "d" ? model.events[widthHit++] : null;
    const pitch = event ? String(event.pitch) : "";
    const velocity = event ? String(event.velocity) : "";
    return Math.max(cell.length, pitch.length, velocity.length, 1);
  });
  let hit = 0;
  const patternCells = [];
  const pitchCells = [];
  const velocityCells = [];
  for (const token of model.pattern.tokens) {
    const idx = patternCells.length;
    const width = widths[idx] || 1;
    const cell = formatDrumPatternToken(token);
    patternCells.push(cell.padEnd(width, " "));
    if (token.type === "d") {
      const event = model.events[hit] || null;
      pitchCells.push(String(event ? event.pitch : "").padEnd(width, " "));
      velocityCells.push(String(event ? event.velocity : "").padEnd(width, " "));
      hit += 1;
    } else {
      pitchCells.push("".padEnd(width, " "));
      velocityCells.push("".padEnd(width, " "));
    }
  }
  const lines = [];
  if (model.drumbars) lines.push(`${indent}%%MIDI drumbars ${model.drumbars}`);
  lines.push(`${indent}%%MIDI drum     ${patternCells.join(" ").trimEnd()}${comment || ""}`);
  lines.push(`${indent}%%MIDI drum +:  ${pitchCells.join(" ").trimEnd()}`);
  lines.push(`${indent}%%MIDI drum +:  ${velocityCells.join(" ").trimEnd()}`);
  return lines.join("\n");
}

function formatDrumTablature(model, { indent = "" } = {}) {
  if (!model) return "";
  const uniquePitches = [];
  const seen = new Set();
  for (const event of model.events) {
    const pitch = Number(event && event.pitch);
    if (!Number.isFinite(pitch) || seen.has(pitch)) continue;
    seen.add(pitch);
    uniquePitches.push(pitch);
  }
  if (!uniquePitches.length) uniquePitches.push(35);
  const usedKeys = new Set();
  const tracks = uniquePitches.map((pitch) => ({
    pitch,
    key: getDrumShortcutForPitch(pitch, usedKeys),
    name: getDrumInstrumentNameForPitch(pitch),
    cells: Array(Math.max(1, Number(model.pattern.totalUnits) || 1)).fill("-"),
  }));
  const byPitch = new Map(tracks.map((t) => [t.pitch, t]));
  for (const event of model.events) {
    const track = byPitch.get(Number(event.pitch));
    if (!track) continue;
    const start = Math.max(0, Number(event.unit) || 0);
    if (start < track.cells.length) track.cells[start] = "o";
  }
  const bars = model.drumbars && model.drumbars > 1 && model.pattern.totalUnits % model.drumbars === 0
    ? model.drumbars
    : 1;
  const unitsPerBar = Math.max(1, Math.floor(model.pattern.totalUnits / bars));
  const withBars = (cells) => {
    const chunks = [];
    for (let i = 0; i < cells.length; i += unitsPerBar) chunks.push(cells.slice(i, i + unitsPerBar).join(""));
    return `|${chunks.join("|")}|`;
  };
  const name = String(model.name || "drum1").replace(/[^A-Za-z0-9_-]+/g, "_") || "drum1";
  const lines = [`${indent}%%begindrum ${name}`];
  for (const track of tracks) lines.push(`${indent}${track.key} ${withBars(track.cells)}`);
  lines.push("");
  const nameWidth = Math.max(...tracks.map((t) => t.name.replace(/\s+/g, "-").length), 1);
  for (const track of tracks) {
    const padded = track.name.replace(/\s+/g, "-").padEnd(nameWidth, "-");
    lines.push(`${indent}${track.key} |-${padded}-|`);
  }
  lines.push(`${indent}%%enddrum`);
  lines.push("");
  lines.push(`${indent}%%drum ${name}`);
  return lines.join("\n");
}

export {
  formatCompactMidiDrum,
  formatDrumTablature,
  formatReadableMidiDrum,
  makeDrumEditModel,
  parseDrumPattern,
};
