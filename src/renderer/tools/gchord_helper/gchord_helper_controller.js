import {
  buildGchordLines,
  buildGchordPreview,
  getNormalizedGchordBars,
} from "./gchord_helper_model.js";

function openGchordHelperAtCursor({
  view,
  pos,
  lineInfo,
  lineText,
  EditorSelection,
  enableDraggableFixedPopover,
  showToast,
  isInlineFieldOnlyLine = () => false,
} = {}) {
  if (!view || !view.state || !lineInfo) return false;

  const isGchordLine = (text) => /^\s*%%\s*MIDI\s+gchord\b/i.test(String(text || ""));
  const isGchordBarsLine = (text) => /^\s*%%\s*MIDI\s+gchordbars\b/i.test(String(text || ""));
  const isGchordToggleLine = (text) => /^\s*%%\s*MIDI\s+gchord(on|off)\b/i.test(String(text || ""));
  if (!isGchordLine(lineText) && !isGchordBarsLine(lineText)) return false;

  const existing = document.getElementById("abcarusGchordEditorPopover");
  if (existing) {
    try {
      const close = existing.__abcarusClose;
      if (typeof close === "function") close();
      else existing.remove();
    } catch {}
    return true;
  }

  const doc = view.state.doc;
  const splitComment = (s) => {
    const idx = String(s || "").indexOf("%", 2);
    if (idx < 0) return { code: String(s || ""), comment: "" };
    return { code: String(s || "").slice(0, idx), comment: String(s || "").slice(idx) };
  };
  const isMusicLine = (text) => {
    const t = String(text || "").trim();
    if (!t) return false;
    if (/^%/.test(t)) return false;
    if (/^%%/.test(t)) return false;
    if (/^[A-Za-z]:/.test(t)) return false;
    if (isInlineFieldOnlyLine(t)) return false;
    return true;
  };

  let gchordLineNumber = isGchordLine(lineText) ? lineInfo.number : null;
  let gchordBarsLineNumber = isGchordBarsLine(lineText) ? lineInfo.number : null;
  if (gchordLineNumber == null) {
    for (let n = lineInfo.number - 1; n >= 1; n -= 1) {
      const t = doc.line(n).text || "";
      if (isGchordLine(t)) { gchordLineNumber = n; break; }
      if (isMusicLine(t)) break;
    }
  }
  if (gchordLineNumber == null) {
    for (let n = lineInfo.number + 1; n <= doc.lines; n += 1) {
      const t = doc.line(n).text || "";
      if (isGchordLine(t)) { gchordLineNumber = n; break; }
      if (isMusicLine(t)) break;
    }
  }
  if (gchordBarsLineNumber == null) {
    for (let n = lineInfo.number - 1; n >= 1; n -= 1) {
      const t = doc.line(n).text || "";
      if (isGchordBarsLine(t)) { gchordBarsLineNumber = n; break; }
      if (isMusicLine(t)) break;
      if (isGchordLine(t) || isGchordToggleLine(t)) break;
    }
  }
  if (gchordLineNumber == null) {
    try { if (typeof showToast === "function") showToast("Gchord editor: %%MIDI gchord line not found.", 2200); } catch {}
    return true;
  }

  const gchordLine = doc.line(gchordLineNumber).text || "";
  const gchordParts = splitComment(gchordLine);
  const gchordCode = gchordParts.code.replace(/^\s*%%\s*MIDI\s+gchord\b\s*/i, "");
  const gchordPattern = String(gchordCode || "").trim();
  const gchordBarsValue = (() => {
    if (!gchordBarsLineNumber) return "";
    const line = doc.line(gchordBarsLineNumber).text || "";
    const m = line.match(/^\s*%%\s*MIDI\s+gchordbars\s+(\d+)/i);
    return m ? String(m[1]) : "";
  })();

  const pop = document.createElement("div");
  pop.id = "abcarusGchordEditorPopover";
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", "Gchord pattern editor");
  pop.style.position = "fixed";
  pop.style.zIndex = "9999";
  pop.style.width = "min(560px, calc(100vw - 20px))";
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
  title.textContent = "Gchord pattern";
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
    input.style.padding = "6px 8px";
    input.style.borderRadius = "6px";
    input.style.border = "1px solid rgba(0,0,0,0.2)";
    input.style.boxSizing = "border-box";
    wrap.appendChild(label);
    wrap.appendChild(input);
    return { wrap, input };
  };

  const patternField = mkField("Pattern", "e.g. fc2cgcHG");
  const barsField = mkField("gchordbars (optional)", "e.g. 2");
  patternField.input.value = gchordPattern || "";
  barsField.input.value = gchordBarsValue;
  body.appendChild(patternField.wrap);
  body.appendChild(barsField.wrap);

  const statusRow = document.createElement("div");
  statusRow.style.display = "flex";
  statusRow.style.alignItems = "center";
  statusRow.style.justifyContent = "space-between";
  statusRow.style.gap = "10px";
  statusRow.style.width = "100%";
  const status = document.createElement("div");
  status.style.fontSize = "12px";
  status.style.opacity = "0.7";
  statusRow.appendChild(status);
  body.appendChild(statusRow);

  const gchordLegend = document.createElement("div");
  gchordLegend.style.fontSize = "12px";
  gchordLegend.style.opacity = "0.75";
  gchordLegend.textContent = "Legend: z=rest, c=chord, f=bass, b=bass+chord, G/H/I/J/K=notes up from lowest, g/h/i/j/k=octave above. Preview uses the same symbols (z shown where a voice is silent).";
  body.appendChild(gchordLegend);

  const previewBox = document.createElement("div");
  previewBox.style.border = "1px solid rgba(0,0,0,0.12)";
  previewBox.style.borderRadius = "6px";
  previewBox.style.padding = "6px 8px";
  previewBox.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace";
  previewBox.style.fontSize = "12px";
  previewBox.style.whiteSpace = "pre-wrap";
  previewBox.style.lineHeight = "1.4";
  body.appendChild(previewBox);

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

  const updateStatus = () => {
    const raw = String(patternField.input.value || "");
    const preview = buildGchordPreview(raw, barsField.input.value || "");
    status.textContent = preview.statusText;
    previewBox.textContent = preview.previewText;
  };
  updateStatus();
  patternField.input.addEventListener("input", updateStatus);
  barsField.input.addEventListener("input", updateStatus);

  let closePopover = () => { try { pop.remove(); } catch {} };
  const applyChanges = () => {
    const patternValue = String(patternField.input.value || "").trim();
    if (!patternValue) {
      try { if (typeof showToast === "function") showToast("Gchord editor: pattern is empty.", 2000); } catch {}
      return;
    }
    const barsRaw = String(barsField.input.value || "").trim();
    const barsOut = getNormalizedGchordBars(barsRaw);
    if (barsRaw && !barsOut) {
      try { if (typeof showToast === "function") showToast("Gchord editor: gchordbars must be a positive integer.", 2200); } catch {}
      return;
    }

    const gchordIndent = String(gchordLine || "").match(/^[\t ]*/)?.[0] ?? "";
    const gchordComment = gchordParts.comment
      ? (gchordParts.comment.startsWith(" ") ? gchordParts.comment : ` ${gchordParts.comment}`)
      : "";
    const baseGchordLines = buildGchordLines({
      pattern: patternValue,
      bars: barsOut,
      gchordIndent,
      gchordComment,
    });
    const newGchordLine = baseGchordLines.gchordLine;

    const changes = [];
    const gchordLineInfo = doc.line(gchordLineNumber);
    changes.push({ from: gchordLineInfo.from, to: gchordLineInfo.to, insert: newGchordLine });

    if (barsOut) {
      if (gchordBarsLineNumber != null) {
        const barsLineInfo = doc.line(gchordBarsLineNumber);
        const barsIndent = String(barsLineInfo.text || "").match(/^[\t ]*/)?.[0] ?? gchordIndent;
        const barsParts = splitComment(barsLineInfo.text || "");
        const barsComment = barsParts.comment
          ? (barsParts.comment.startsWith(" ") ? barsParts.comment : ` ${barsParts.comment}`)
          : "";
        const newBarsLine = buildGchordLines({
          pattern: patternValue,
          bars: barsOut,
          gchordIndent,
          gchordComment,
          barsIndent,
          barsComment,
        }).barsLine;
        changes.push({ from: barsLineInfo.from, to: barsLineInfo.to, insert: newBarsLine });
      } else {
        changes.push({ from: gchordLineInfo.from, to: gchordLineInfo.from, insert: `${baseGchordLines.barsLine}\n` });
      }
    } else if (gchordBarsLineNumber != null) {
      const barsLineInfo = doc.line(gchordBarsLineNumber);
      const rmTo = (gchordBarsLineNumber < doc.lines) ? (barsLineInfo.to + 1) : barsLineInfo.to;
      changes.push({ from: barsLineInfo.from, to: rmTo, insert: "" });
    }

    view.dispatch({
      changes,
      selection: EditorSelection.cursor(gchordLineInfo.from + newGchordLine.length),
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
  barsField.input.addEventListener("keydown", onInputKey);

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
  openGchordHelperAtCursor,
};
