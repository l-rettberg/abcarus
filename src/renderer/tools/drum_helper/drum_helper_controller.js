import {
  clampVelocity,
  DEFAULT_DRUM_VELOCITY,
  DRUM_INSTRUMENTS,
} from "../../drums.js";
import {
  formatCompactMidiDrum,
  formatDrumTablature,
  formatReadableMidiDrum,
  makeDrumEditModel,
  parseDrumPattern,
  parseDrumTablatureBlock,
} from "./drum_helper_model.js";

function isDrumMainLine(text) {
  return /^\s*%%\s*MIDI\s+drum\b(?!\s+\+:)/i.test(String(text || ""));
}

function isDrumContinuationLine(text) {
  const s = String(text || "");
  return /^\s*%%\s*MIDI\s+drum\s+\+:/i.test(s) || /^\s*\+:\s*/i.test(s);
}

function isDrumTablatureBoundaryLine(text) {
  return /^\s*%%\s*(begin|end)drum\b/i.test(String(text || ""));
}

function isDrumTablatureRefLine(text) {
  return /^\s*%%\s*drum\b/i.test(String(text || ""));
}

function isDrumTablatureTrackLine(text) {
  return /^\s*[A-Za-z0-9][A-Za-z0-9]?\s+\|[-ox|]+\|\s*$/i.test(String(text || ""));
}

function isDrumLine(text) {
  return (
    isDrumMainLine(text)
    || isDrumContinuationLine(text)
    || isDrumTablatureBoundaryLine(text)
    || isDrumTablatureRefLine(text)
    || isDrumTablatureTrackLine(text)
  );
}

function splitComment(s) {
  const text = String(s || "");
  const idx = text.indexOf("%", 2);
  if (idx < 0) return { code: text, comment: "" };
  return { code: text.slice(0, idx), comment: text.slice(idx) };
}

function parseNums(s) {
  const out = [];
  const m = String(s || "").match(/-?\d+/g);
  if (!m) return out;
  for (const raw of m) {
    const n = Number(raw);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

function openDrumHelperAtCursor({
  view,
  pos,
  lineInfo,
  lineText,
  EditorSelection,
  enableDraggableFixedPopover,
  showToast,
  drumVelocityMap,
} = {}) {
  if (!view || !view.state || !lineInfo || !EditorSelection) return false;
  if (!isDrumLine(lineText)) return false;

  const existing = document.getElementById("abcarusDrumEditorPopover");
  if (existing) {
    try {
      const close = existing.__abcarusClose;
      if (typeof close === "function") close();
      else existing.remove();
    } catch {}
    return true;
  }

  const doc = view.state.doc;
  let sourceKind = "";
  let mainLineNumber = null;
  let tablatureBeginLineNumber = null;
  let tablatureEndLineNumber = null;

  if (isDrumMainLine(lineText)) {
    sourceKind = "midi";
    mainLineNumber = lineInfo.number;
  } else if (isDrumContinuationLine(lineText)) {
    for (let n = lineInfo.number; n >= 1; n -= 1) {
      const t = doc.line(n).text || "";
      if (isDrumMainLine(t)) {
        sourceKind = "midi";
        mainLineNumber = n;
        break;
      }
      if (!isDrumContinuationLine(t)) break;
    }
  }

  if (!sourceKind) {
    if (/^\s*%%\s*begindrum\b/i.test(lineText)) {
      tablatureBeginLineNumber = lineInfo.number;
    } else if (isDrumTablatureRefLine(lineText)) {
      const refName = String(lineText || "").replace(/^\s*%%\s*drum\b\s*/i, "").trim().split(/\s+/)[0] || "";
      for (let n = lineInfo.number - 1; n >= 1; n -= 1) {
        const t = doc.line(n).text || "";
        const m = t.match(/^\s*%%\s*begindrum(?:\s+([^\s%]+))?/i);
        if (m && (!refName || String(m[1] || "").trim() === refName)) {
          tablatureBeginLineNumber = n;
          break;
        }
      }
    } else {
      const scanStart = /^\s*%%\s*enddrum\b/i.test(lineText) ? lineInfo.number - 1 : lineInfo.number;
      for (let n = scanStart; n >= 1; n -= 1) {
        const t = doc.line(n).text || "";
        if (/^\s*%%\s*begindrum\b/i.test(t)) {
          tablatureBeginLineNumber = n;
          break;
        }
        if (/^\s*%%\s*enddrum\b/i.test(t)) break;
      }
    }
    if (tablatureBeginLineNumber != null) {
      for (let n = tablatureBeginLineNumber + 1; n <= doc.lines; n += 1) {
        const t = doc.line(n).text || "";
        if (/^\s*%%\s*enddrum\b/i.test(t)) {
          tablatureEndLineNumber = n;
          break;
        }
      }
      if (tablatureEndLineNumber != null) sourceKind = "tablature";
    }
  }

  if (mainLineNumber == null && sourceKind !== "tablature") return false;

  let endLineNumber = sourceKind === "tablature" ? tablatureEndLineNumber : mainLineNumber;
  if (sourceKind !== "tablature") {
    for (let n = mainLineNumber + 1; n <= doc.lines; n += 1) {
      const t = doc.line(n).text || "";
      if (!isDrumContinuationLine(t)) break;
      endLineNumber = n;
    }
  }

  const sourceStartLineNumber = sourceKind === "tablature" ? tablatureBeginLineNumber : mainLineNumber;
  let sourceEndLineNumber = endLineNumber;
  let drumbarsLineNumber = null;
  if (sourceKind !== "tablature") {
    for (let n = mainLineNumber - 1; n >= 1; n -= 1) {
      const t = doc.line(n).text || "";
      if (/^\s*%%\s*MIDI\s+drumbars\b/i.test(t)) {
        drumbarsLineNumber = n;
        break;
      }
      if (/^\s*%%\s*MIDI\s+drum(on|off)\b/i.test(t)) continue;
      break;
    }
  } else {
    const beginLine = doc.line(tablatureBeginLineNumber).text || "";
    const beginName = String(beginLine || "").replace(/^\s*%%\s*begindrum\b\s*/i, "").trim().split(/\s+/)[0] || "";
    let scan = tablatureEndLineNumber + 1;
    while (scan <= doc.lines && !String(doc.line(scan).text || "").trim()) scan += 1;
    if (scan <= doc.lines) {
      const refLine = doc.line(scan).text || "";
      const refName = String(refLine || "").replace(/^\s*%%\s*drum\b\s*/i, "").trim().split(/\s+/)[0] || "";
      if (/^\s*%%\s*drum\b/i.test(refLine) && (!beginName || !refName || beginName === refName)) {
        sourceEndLineNumber = scan;
      }
    }
  }

  let mainLine = "";
  let mainParts = { code: "", comment: "" };
  let patternText = "";
  let pitches = [];
  let velocities = [];
  let drumNameValue = "drum1";
  if (sourceKind === "tablature") {
    const blockLines = [];
    for (let n = tablatureBeginLineNumber; n <= tablatureEndLineNumber; n += 1) {
      blockLines.push(doc.line(n).text || "");
    }
    const model = parseDrumTablatureBlock(blockLines, { velocityMap: drumVelocityMap });
    if (!model) {
      try { if (typeof showToast === "function") showToast("Drum editor: could not parse %%begindrum block.", 2200); } catch {}
      return true;
    }
    patternText = model.patternText || "";
    pitches = Array.isArray(model.pitches) ? model.pitches.slice() : [];
    velocities = Array.isArray(model.velocities) ? model.velocities.slice() : [];
    drumNameValue = model.name || "drum1";
    mainLine = doc.line(tablatureBeginLineNumber).text || "";
  } else {
    mainLine = doc.line(mainLineNumber).text || "";
    mainParts = splitComment(mainLine);
    const mainCode = mainParts.code.replace(/^\s*%%\s*MIDI\s+drum\s+/i, "");
    const mainTokens = String(mainCode || "").trim().split(/\s+/).filter(Boolean);
    const isInt = (t) => /^-?\d+$/.test(String(t || "").trim());
    let firstNum = -1;
    for (let i = 0; i < mainTokens.length; i += 1) {
      if (isInt(mainTokens[i])) {
        firstNum = i;
        break;
      }
    }
    const patternTokens = (firstNum === -1 ? mainTokens : mainTokens.slice(0, firstNum)).filter((t) => t !== "+:");
    patternText = patternTokens.join("");
    const numbers = (firstNum === -1 ? [] : mainTokens.slice(firstNum))
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n));
    for (let n = mainLineNumber + 1; n <= endLineNumber; n += 1) {
      const contRaw = doc.line(n).text || "";
      const contParts = splitComment(contRaw);
      let payload = "";
      const m = contParts.code.match(/^\s*%%\s*MIDI\s+drum\s+\+:\s*(.*)$/i);
      if (m) payload = m[1] || "";
      else payload = contParts.code.replace(/^\s*\+:\s*/i, "");
      numbers.push(...parseNums(payload));
    }
    const parsedPattern = parseDrumPattern(patternText);
    const hitCount = parsedPattern && Number.isFinite(parsedPattern.hitCount) ? parsedPattern.hitCount : 0;
    pitches = numbers.slice(0, hitCount);
    velocities = numbers.slice(hitCount, hitCount * 2);
  }

  const drumbarsValue = (() => {
    if (!drumbarsLineNumber) return "";
    const line = doc.line(drumbarsLineNumber).text || "";
    const m = line.match(/^\s*%%\s*MIDI\s+drumbars\s+(\d+)/i);
    return m ? String(m[1]) : "";
  })();

  const pop = document.createElement("div");
  pop.id = "abcarusDrumEditorPopover";
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", "Drum pattern editor");
  pop.style.position = "fixed";
  pop.style.zIndex = "9999";
  pop.style.width = "min(640px, calc(100vw - 20px))";
  pop.style.maxWidth = "calc(100vw - 20px)";
  pop.style.padding = "8px 10px";
  pop.style.borderRadius = "8px";
  pop.style.border = "1px solid rgba(0,0,0,0.18)";
  pop.style.background = "rgba(255,255,255,0.98)";
  pop.style.boxShadow = "0 8px 24px rgba(0,0,0,0.18)";
  pop.style.fontSize = "13px";
  pop.style.lineHeight = "1.35";
  pop.style.boxSizing = "border-box";

  const head = document.createElement("div");
  head.style.display = "flex";
  head.style.alignItems = "center";
  head.style.justifyContent = "space-between";
  head.style.gap = "12px";

  const title = document.createElement("div");
  title.textContent = "Drum pattern";
  title.style.fontWeight = "600";
  head.appendChild(title);

  const hint = document.createElement("div");
  hint.textContent = "Enter=apply · Esc=close";
  hint.style.opacity = "0.65";
  hint.style.fontSize = "12px";
  head.appendChild(hint);
  pop.appendChild(head);
  if (typeof enableDraggableFixedPopover === "function") enableDraggableFixedPopover(pop, head);

  const body = document.createElement("div");
  body.style.marginTop = "6px";
  body.style.display = "flex";
  body.style.flexDirection = "column";
  body.style.gap = "8px";
  body.style.width = "100%";
  pop.appendChild(body);

  const mkField = (labelText, placeholder) => {
    const wrap = document.createElement("div");
    wrap.style.width = "100%";
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.gap = "8px";
    wrap.style.flexWrap = "wrap";
    const label = document.createElement("div");
    label.textContent = labelText;
    label.style.fontSize = "12px";
    label.style.opacity = "0.7";
    label.style.flex = "0 0 160px";
    label.style.whiteSpace = "nowrap";
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = placeholder || "";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.style.flex = "1 1 240px";
    input.style.minWidth = "220px";
    input.style.boxSizing = "border-box";
    input.style.padding = "6px 8px";
    input.style.borderRadius = "6px";
    input.style.border = "1px solid rgba(0,0,0,0.2)";
    wrap.appendChild(label);
    wrap.appendChild(input);
    return { wrap, input };
  };

  const patternField = mkField("Pattern (d/z + counts)", "e.g. d3ddzd");
  const pitchesField = mkField("Pitches (MIDI numbers)", "e.g. 36 42 42 36 42 38");
  const velocitiesField = mkField("Velocities (0–127)", "e.g. 80 95 95 80 95 90");
  const drumbarsField = mkField("drumbars (optional)", "e.g. 2");
  const drumNameField = mkField("%%drum name", "e.g. conga5");

  patternField.input.value = patternText || "";
  pitchesField.input.value = pitches.join(" ");
  velocitiesField.input.value = velocities.join(" ");
  drumbarsField.input.value = drumbarsValue;
  drumNameField.input.value = drumNameValue || "drum1";

  body.appendChild(patternField.wrap);
  body.appendChild(pitchesField.wrap);
  body.appendChild(velocitiesField.wrap);
  body.appendChild(drumbarsField.wrap);
  body.appendChild(drumNameField.wrap);

  const optionsRow = document.createElement("div");
  optionsRow.style.display = "flex";
  optionsRow.style.alignItems = "center";
  optionsRow.style.justifyContent = "space-between";
  optionsRow.style.gap = "10px";
  optionsRow.style.width = "100%";

  const status = document.createElement("div");
  status.style.fontSize = "12px";
  status.style.opacity = "0.7";
  optionsRow.appendChild(status);

  const outputWrap = document.createElement("label");
  outputWrap.style.display = "flex";
  outputWrap.style.alignItems = "center";
  outputWrap.style.gap = "6px";
  outputWrap.style.fontSize = "12px";
  outputWrap.style.opacity = "0.85";
  const outputLabel = document.createElement("span");
  outputLabel.textContent = "Write";
  const outputSelect = document.createElement("select");
  outputSelect.style.padding = "4px 6px";
  outputSelect.style.borderRadius = "6px";
  outputSelect.style.border = "1px solid rgba(0,0,0,0.2)";
  outputSelect.innerHTML = [
    "<option value=\"compact\">Compact %%MIDI drum</option>",
    "<option value=\"readable\">Readable %%MIDI drum +:</option>",
    "<option value=\"tablature\">%%drum tablature</option>",
  ].join("");
  outputWrap.appendChild(outputLabel);
  outputWrap.appendChild(outputSelect);
  optionsRow.appendChild(outputWrap);
  body.appendChild(optionsRow);

  const drumLegend = document.createElement("div");
  drumLegend.style.fontSize = "12px";
  drumLegend.style.opacity = "0.75";
  drumLegend.textContent = "Legend: d=hit, z=rest, digits=length. Readable +: is ABCarus-only; %%drum is abc2svg/txtmus.";
  body.appendChild(drumLegend);

  const preview = document.createElement("textarea");
  preview.readOnly = true;
  preview.spellcheck = false;
  preview.style.width = "100%";
  preview.style.minHeight = "92px";
  preview.style.maxHeight = "180px";
  preview.style.resize = "vertical";
  preview.style.boxSizing = "border-box";
  preview.style.fontFamily = "var(--font-family-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)";
  preview.style.fontSize = "12px";
  preview.style.padding = "7px 8px";
  preview.style.borderRadius = "6px";
  preview.style.border = "1px solid rgba(0,0,0,0.16)";
  preview.style.background = "rgba(0,0,0,0.03)";
  body.appendChild(preview);

  const hitList = document.createElement("div");
  hitList.style.border = "1px solid rgba(0,0,0,0.12)";
  hitList.style.borderRadius = "6px";
  hitList.style.maxHeight = "180px";
  hitList.style.overflow = "auto";
  hitList.style.fontSize = "12px";
  hitList.style.padding = "4px 0";
  body.appendChild(hitList);

  const pickerWrap = document.createElement("div");
  pickerWrap.style.display = "flex";
  pickerWrap.style.flexDirection = "column";
  pickerWrap.style.gap = "6px";
  pickerWrap.style.marginTop = "2px";
  body.appendChild(pickerWrap);

  const pickerLabel = document.createElement("div");
  pickerLabel.textContent = "Pick drum instrument (adds pitch)";
  pickerLabel.style.fontSize = "12px";
  pickerLabel.style.opacity = "0.7";
  pickerWrap.appendChild(pickerLabel);

  const pickerInput = document.createElement("input");
  pickerInput.type = "text";
  pickerInput.placeholder = "Search (e.g. snare, 38)";
  pickerInput.autocomplete = "off";
  pickerInput.spellcheck = false;
  pickerInput.style.width = "100%";
  pickerInput.style.boxSizing = "border-box";
  pickerInput.style.padding = "6px 8px";
  pickerInput.style.borderRadius = "6px";
  pickerInput.style.border = "1px solid rgba(0,0,0,0.2)";
  pickerWrap.appendChild(pickerInput);

  const pickerList = document.createElement("div");
  pickerList.style.border = "1px solid rgba(0,0,0,0.12)";
  pickerList.style.borderRadius = "6px";
  pickerList.style.maxHeight = "160px";
  pickerList.style.overflow = "auto";
  pickerList.style.fontSize = "12px";
  pickerWrap.appendChild(pickerList);

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.justifyContent = "flex-end";
  actions.style.gap = "8px";
  const applyBtn = document.createElement("button");
  applyBtn.type = "button";
  applyBtn.textContent = "Apply";
  applyBtn.style.padding = "6px 10px";
  applyBtn.style.borderRadius = "6px";
  applyBtn.style.border = "1px solid rgba(0,0,0,0.2)";
  applyBtn.style.background = "white";
  applyBtn.style.cursor = "pointer";
  actions.appendChild(applyBtn);
  body.appendChild(actions);

  const insertPitchIntoInput = (pitch) => {
    try {
      const input = pitchesField.input;
      const current = String(input.value || "");
      const start = Number.isFinite(input.selectionStart) ? input.selectionStart : current.length;
      const end = Number.isFinite(input.selectionEnd) ? input.selectionEnd : start;
      const before = current.slice(0, start);
      const after = current.slice(end);
      const needsLeftSpace = before && !/\s$/.test(before);
      const needsRightSpace = after && !/^\s/.test(after);
      const insert = `${needsLeftSpace ? " " : ""}${pitch}${needsRightSpace ? " " : ""}`;
      const next = `${before}${insert}${after}`;
      const caret = before.length + insert.length;
      input.value = next;
      input.focus();
      input.setSelectionRange(caret, caret);
      updateStatus();
    } catch {}
  };

  const renderPicker = () => {
    const q = String(pickerInput.value || "").trim().toLowerCase();
    const terms = q ? q.split(/\s+/).filter(Boolean) : [];
    const matches = (item) => {
      if (!terms.length) return true;
      const hay = `${item.pitch} ${item.name || ""}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    };
    pickerList.textContent = "";
    const items = DRUM_INSTRUMENTS.filter((d) => d && Number.isFinite(d.pitch) && matches(d));
    for (const it of items) {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.gap = "10px";
      row.style.padding = "6px 8px";
      row.style.cursor = "pointer";
      row.style.borderTop = pickerList.childNodes.length ? "1px solid rgba(0,0,0,0.06)" : "none";
      const num = document.createElement("div");
      num.textContent = String(it.pitch);
      num.style.minWidth = "3em";
      num.style.opacity = "0.75";
      const nm = document.createElement("div");
      nm.textContent = it.name || "";
      row.appendChild(num);
      row.appendChild(nm);
      row.addEventListener("click", (ev) => {
        try { ev.preventDefault(); ev.stopPropagation(); } catch {}
        insertPitchIntoInput(it.pitch);
      }, true);
      pickerList.appendChild(row);
    }
  };

  const getCurrentModel = () => makeDrumEditModel({
    patternText: patternField.input.value || "",
    pitches: parseNums(pitchesField.input.value),
    velocities: parseNums(velocitiesField.input.value).map((v) => clampVelocity(v)),
    drumbars: String(drumbarsField.input.value || "").trim(),
    name: drumNameField.input.value || "drum1",
    velocityMap: drumVelocityMap,
  });

  const getOutputText = () => {
    const model = getCurrentModel();
    if (!model) return "";
    const indent = String(mainLine || "").match(/^[\t ]*/)?.[0] ?? "";
    const commentSuffix = mainParts.comment
      ? (mainParts.comment.startsWith(" ") ? mainParts.comment : ` ${mainParts.comment}`)
      : "";
    const mode = String(outputSelect.value || "compact");
    if (mode === "readable") return formatReadableMidiDrum(model, { indent, comment: commentSuffix });
    if (mode === "tablature") return formatDrumTablature(model, { indent });
    return formatCompactMidiDrum(model, { indent, comment: commentSuffix });
  };

  const updatePreview = () => {
    try {
      const text = getOutputText();
      preview.value = text || "Invalid drum pattern.";
    } catch {
      preview.value = "Invalid drum pattern.";
    }
  };

  const updateStatus = () => {
    const p = parseDrumPattern(patternField.input.value || "");
    const hits = p && Number.isFinite(p.hitCount) ? p.hitCount : 0;
    const totalUnits = p && Number.isFinite(p.totalUnits) ? p.totalUnits : 0;
    const barsRaw = String(drumbarsField.input.value || "").trim();
    let bars = null;
    let barsNote = "";
    if (barsRaw) {
      const n = Number(barsRaw);
      if (Number.isFinite(n) && n > 0) {
        bars = Math.floor(n);
        if (bars > 1 && totalUnits > 0 && totalUnits % bars !== 0) {
          barsNote = " (pattern length not divisible)";
        }
      } else {
        barsNote = " (invalid)";
      }
    }
    const pitchList = parseNums(pitchesField.input.value);
    const velocityList = parseNums(velocitiesField.input.value).map((v) => clampVelocity(v));
    const pitchCount = pitchList.length;
    const velCount = velocityList.length;
    status.textContent = `hits: ${hits} · pitches: ${pitchCount} · velocities: ${velCount}${bars ? ` · bars: ${bars}${barsNote}` : barsNote}`;
    hitList.textContent = "";
    if (!hits) {
      updatePreview();
      return;
    }
    const canSplit = Boolean(bars && bars > 1 && totalUnits > 0 && totalUnits % bars === 0);
    const unitsPerBar = canSplit ? (totalUnits / bars) : 0;
    const hitMeta = [];
    if (p && Array.isArray(p.tokens) && totalUnits > 0) {
      let cursor = 0;
      for (const token of p.tokens) {
        const len = Number(token && token.len) || 0;
        if (token && token.type === "d") {
          const idx = Number.isFinite(token.hitIndex) ? token.hitIndex : hitMeta.length;
          hitMeta[idx] = { startUnit: cursor };
        }
        if (len > 0) cursor += len;
      }
    }
    const nameMap = new Map();
    for (const item of DRUM_INSTRUMENTS) {
      if (item && Number.isFinite(item.pitch)) nameMap.set(item.pitch, item.name || "");
    }
    let lastBar = -1;
    for (let i = 0; i < hits; i += 1) {
      if (canSplit && hitMeta[i]) {
        const barIndex = Math.floor(hitMeta[i].startUnit / unitsPerBar);
        if (barIndex !== lastBar) {
          lastBar = barIndex;
          const header = document.createElement("div");
          header.textContent = `Bar ${barIndex + 1}`;
          header.style.fontWeight = "600";
          header.style.opacity = "0.8";
          header.style.padding = "4px 8px";
          header.style.background = "rgba(0,0,0,0.04)";
          hitList.appendChild(header);
        }
      }
      const pitch = pitchList.length ? pitchList[i % pitchList.length] : 35;
      const vel = velocityList.length
        ? velocityList[i % velocityList.length]
        : clampVelocity(Number.isFinite(drumVelocityMap[pitch]) ? drumVelocityMap[pitch] : DEFAULT_DRUM_VELOCITY);
      const name = nameMap.get(pitch) || "—";
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "3.2em 5em 1fr 5em";
      row.style.gap = "6px";
      row.style.padding = "2px 8px";
      const c1 = document.createElement("div");
      c1.textContent = `#${i + 1}`;
      c1.style.opacity = "0.7";
      const c2 = document.createElement("div");
      c2.textContent = String(pitch);
      const c3 = document.createElement("div");
      c3.textContent = name;
      const c4 = document.createElement("div");
      c4.textContent = String(vel);
      c4.style.textAlign = "right";
      row.appendChild(c1);
      row.appendChild(c2);
      row.appendChild(c3);
      row.appendChild(c4);
      hitList.appendChild(row);
    }
    updatePreview();
  };

  updateStatus();
  renderPicker();
  patternField.input.addEventListener("input", updateStatus);
  drumbarsField.input.addEventListener("input", updateStatus);
  pitchesField.input.addEventListener("input", updateStatus);
  velocitiesField.input.addEventListener("input", updateStatus);
  drumNameField.input.addEventListener("input", updateStatus);
  outputSelect.addEventListener("change", updateStatus);
  pickerInput.addEventListener("input", renderPicker);

  let closePopover = () => { try { pop.remove(); } catch {} };
  const applyChanges = () => {
    const patternValue = String(patternField.input.value || "").trim();
    if (!patternValue) {
      try { if (typeof showToast === "function") showToast("Drum editor: pattern is empty.", 2000); } catch {}
      return;
    }
    const parsed = parseDrumPattern(patternValue);
    if (!parsed) {
      try { if (typeof showToast === "function") showToast("Drum editor: invalid pattern (use d/z + counts).", 2200); } catch {}
      return;
    }
    const hitTotal = Number(parsed.hitCount) || 0;
    const pitchesNow = parseNums(pitchesField.input.value);
    let velocitiesNow = parseNums(velocitiesField.input.value).map((v) => clampVelocity(v));
    if (!velocitiesNow.length && hitTotal > 0) {
      const next = [];
      for (let i = 0; i < hitTotal; i += 1) {
        const pitch = pitchesNow.length ? pitchesNow[i % pitchesNow.length] : null;
        const v = (pitch != null && Number.isFinite(drumVelocityMap[pitch]))
          ? drumVelocityMap[pitch]
          : DEFAULT_DRUM_VELOCITY;
        next.push(clampVelocity(v));
      }
      velocitiesNow = next;
    }

    const model = makeDrumEditModel({
      patternText: patternValue,
      pitches: pitchesNow,
      velocities: velocitiesNow,
      drumbars: String(drumbarsField.input.value || "").trim(),
      name: drumNameField.input.value || "drum1",
      velocityMap: drumVelocityMap,
    });
    if (!model) {
      try { if (typeof showToast === "function") showToast("Drum editor: invalid drum model.", 2200); } catch {}
      return;
    }
    if (String(drumbarsField.input.value || "").trim() && !model.drumbars) {
      try { if (typeof showToast === "function") showToast("Drum editor: drumbars must be a positive integer.", 2200); } catch {}
      return;
    }
    const insert = getOutputText();
    if (!insert.trim()) {
      try { if (typeof showToast === "function") showToast("Drum editor: nothing to write.", 2000); } catch {}
      return;
    }

    const startLine = (drumbarsLineNumber != null) ? drumbarsLineNumber : sourceStartLineNumber;
    const from = doc.line(startLine).from;
    const to = doc.line(sourceEndLineNumber).to;
    view.dispatch({
      changes: { from, to, insert },
      selection: EditorSelection.cursor(from + insert.length),
      userEvent: "input",
    });
    try { view.focus(); } catch {}
    closePopover();
  };

  applyBtn.addEventListener("click", () => applyChanges());
  const onInputKey = (ev) => {
    try {
      if (!ev) return;
      const k = String(ev.key || "");
      if (k === "Enter") {
        ev.preventDefault();
        ev.stopPropagation();
        applyChanges();
        return;
      }
      if (k === "Escape") {
        ev.preventDefault();
        ev.stopPropagation();
        closePopover();
      }
    } catch {}
  };
  patternField.input.addEventListener("keydown", onInputKey);
  pitchesField.input.addEventListener("keydown", onInputKey);
  velocitiesField.input.addEventListener("keydown", onInputKey);
  drumbarsField.input.addEventListener("keydown", onInputKey);
  drumNameField.input.addEventListener("keydown", onInputKey);

  const coords = view.coordsAtPos(pos);
  const margin = 10;
  const vw = window.innerWidth || 0;
  const vh = window.innerHeight || 0;
  let left = margin;
  let top = margin;
  if (coords) {
    left = Math.round(coords.left);
    top = Math.round(coords.bottom + 8);
  }
  document.body.appendChild(pop);
  const r = pop.getBoundingClientRect();
  if (left + r.width + margin > vw) left = Math.max(margin, vw - r.width - margin);
  if (top + r.height + margin > vh) top = Math.max(margin, (coords ? (coords.top - r.height - 8) : (vh - r.height - margin)));
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;

  const onDocKey = (ev) => {
    try { if (ev && ev.key === "Escape") closePopover(); } catch {}
  };
  const onDocDown = (ev) => {
    try { if (ev && !pop.contains(ev.target)) closePopover(); } catch {}
  };
  const cleanup = () => {
    document.removeEventListener("keydown", onDocKey, true);
    document.removeEventListener("mousedown", onDocDown, true);
  };
  closePopover = () => {
    try { cleanup(); } catch {}
    try { pop.remove(); } catch {}
  };
  pop.__abcarusClose = closePopover;
  document.addEventListener("keydown", onDocKey, true);
  document.addEventListener("mousedown", onDocDown, true);
  setTimeout(() => { try { patternField.input.focus(); patternField.input.select(); } catch {} }, 0);
  return true;
}

export {
  openDrumHelperAtCursor,
};
