import { suggestMakamCandidates } from "../../makam_suggestion.mjs";
import { createIntonationCopyController } from "./intonation_copy_controller.js";
import {
  buildIntonationRowsFromEntries,
  formatAeuLabel,
  mod53,
  parseTonalBaseFromK,
  pickAutoBaseStep,
  resolveTonalBaseInput,
  scanIntonationEntries as scanIntonationEntriesCore,
} from "./intonation_model.js";

const DEFAULT_INT_BASE = "pc53=0";

function createIntonationExplorerFeature({
  elements = {},
  host = {},
  microtonalTools = null,
  perdeService = null,
  clipboard = null,
} = {}) {
  const doc = elements.document || (typeof document !== "undefined" ? document : null);
  const byId = (id) => (doc && typeof doc.getElementById === "function" ? doc.getElementById(id) : null);
  elements = {
    panel: elements.panel || byId("intonationExplorerPanel"),
    close: elements.close || byId("intonationExplorerClose"),
    more: elements.more || byId("intonationExplorerMore"),
    menu: elements.menu || byId("intonationExplorerMenu"),
    baseMode: elements.baseMode || byId("intonationExplorerBaseMode"),
    baseManual: elements.baseManual || byId("intonationExplorerBaseManual"),
    declaredMakam: elements.declaredMakam || byId("intonationExplorerDeclaredMakam"),
    compareMakam: elements.compareMakam || byId("intonationExplorerCompareMakam"),
    sort: elements.sort || byId("intonationExplorerSort"),
    skipGrace: elements.skipGrace || byId("intonationExplorerSkipGrace"),
    refresh: elements.refresh || byId("intonationExplorerRefresh"),
    status: elements.status || byId("intonationExplorerStatus"),
    tableBody: elements.tableBody || byId("intonationExplorerTableBody"),
    plot: elements.plot || byId("intonationExplorerPlot"),
    plotOverlay: elements.plotOverlay || byId("intonationExplorerPlotOverlay"),
    plotLine: elements.plotLine || byId("intonationExplorerPlotLine"),
    plotPoints: elements.plotPoints || byId("intonationExplorerPlotPoints"),
    plotLegend: elements.plotLegend || byId("intonationExplorerPlotLegend"),
    copyDna: elements.copyDna || byId("intonationExplorerCopyDna"),
    copyPitchSet: elements.copyPitchSet || byId("intonationExplorerCopyPitchSet"),
    editMakamDna: elements.editMakamDna || byId("intonationExplorerEditMakamDna"),
    candidates: elements.candidates || byId("intonationExplorerCandidates"),
  };

  let visible = false;
  let rows = [];
  let activeStep = null;
  let baseStep = 0;
  let baseLabel = "pc53=0";
  let baseMode = "auto";
  let sortMode = "first";
  let skipGraceNotes = true;
  let is53 = false;
  let declaredMakam = "";
  let compareMakam = "";
  let autoMakamApplied = false;
  let roleAbs53Map = null;
  let lastDnaSource = null;

  const logError = (e) => {
    try {
      if (typeof host.logError === "function") host.logError(e);
    } catch {}
  };

  const showToast = (message, timeout) => {
    try {
      if (typeof host.showToast === "function") host.showToast(message, timeout);
    } catch {}
  };

  const perfEnabled = () => {
    try { return Boolean(typeof host.isPerfEnabled === "function" && host.isPerfEnabled()); } catch { return false; }
  };
  const nowMs = () => {
    try { return typeof host.nowMs === "function" ? host.nowMs() : Date.now(); } catch { return Date.now(); }
  };
  const logPerf = (label, data) => {
    try { if (typeof host.logPerf === "function") host.logPerf(label, data); } catch {}
  };

  function setDnaUi({ dnaText, pitchSetText } = {}) {
    copyController.setReady({ dnaText, pitchSetText });
  }

  function clearPlot() {
    if (elements.plotLine) elements.plotLine.setAttribute("points", "");
    if (elements.plotOverlay) elements.plotOverlay.innerHTML = "";
    if (elements.plotPoints) elements.plotPoints.innerHTML = "";
    if (elements.plotLegend) elements.plotLegend.textContent = "";
  }

  function getMakamDnaEntries() {
    return microtonalTools && typeof microtonalTools.getMakamDnaEntries === "function"
      ? microtonalTools.getMakamDnaEntries()
      : [];
  }

  async function ensureMakamDnaLoaded() {
    if (microtonalTools && typeof microtonalTools.ensureMakamDnaLoaded === "function") {
      await microtonalTools.ensureMakamDnaLoaded();
    }
  }

  function detectMakamFromTuneText(tuneText) {
    return microtonalTools && typeof microtonalTools.detectMakamFromTuneText === "function"
      ? microtonalTools.detectMakamFromTuneText(tuneText)
      : "";
  }

  function getMakamDnaEntry(name) {
    return microtonalTools && typeof microtonalTools.getMakamDnaEntry === "function"
      ? microtonalTools.getMakamDnaEntry(name)
      : null;
  }

  function populateMakams() {
    const names = getMakamDnaEntries()
      .map((e) => String(e && e.makam ? e.makam : "").trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

    const fill = (selectEl) => {
      if (!selectEl) return;
      const current = String(selectEl.value || "");
      selectEl.textContent = "";
      const none = document.createElement("option");
      none.value = "";
      none.textContent = "None";
      selectEl.appendChild(none);
      for (const name of names) {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        selectEl.appendChild(opt);
      }
      selectEl.value = current;
    };

    fill(elements.declaredMakam);
    fill(elements.compareMakam);
  }

  function resolvePerdeName(args) {
    return perdeService && typeof perdeService.resolveName === "function" ? perdeService.resolveName(args) : "";
  }

  function resolvePerdeNamesFromAbcToken(token) {
    return perdeService && typeof perdeService.resolveNamesFromAbcToken === "function"
      ? perdeService.resolveNamesFromAbcToken(token)
      : [];
  }

  async function ensurePerdeApisLoaded() {
    if (perdeService && typeof perdeService.ensureApisLoaded === "function") await perdeService.ensureApisLoaded();
  }

  async function ensurePerdeNameIndexLoaded() {
    if (perdeService && typeof perdeService.ensureNameIndexLoaded === "function") await perdeService.ensureNameIndexLoaded();
  }

  function parseMakamDnaPerdeField(fieldText) {
    return perdeService && typeof perdeService.parseMakamDnaPerdeField === "function"
      ? perdeService.parseMakamDnaPerdeField(fieldText)
      : { name: "", hint: "" };
  }

  function pickOverlayAbs53ForPerde(perdeName, options) {
    return perdeService && typeof perdeService.pickOverlayAbs53 === "function"
      ? perdeService.pickOverlayAbs53(perdeName, options)
      : null;
  }

  function normalizeSigned53(delta) {
    let v = Number(delta) || 0;
    while (v > 26) v -= 53;
    while (v < -26) v += 53;
    return v;
  }

  function shiftAbs53NearObserved(abs53, signedDelta, { observedMinAbs, observedMaxAbs } = {}) {
    if (!Number.isFinite(abs53)) return null;
    let shifted = Number(abs53) + normalizeSigned53(signedDelta);
    if (Number.isFinite(observedMinAbs) && Number.isFinite(observedMaxAbs)) {
      const mid = (Number(observedMinAbs) + Number(observedMaxAbs)) / 2;
      while (shifted - mid > 26.5) shifted -= 53;
      while (mid - shifted > 26.5) shifted += 53;
    }
    return shifted;
  }

  function formatRolePerdeLabel(abs53, fallbackName = "") {
    if (!Number.isFinite(abs53)) return String(fallbackName || "");
    const pc53 = mod53(abs53);
    const octave = Math.floor(Number(abs53) / 53);
    const resolved = resolvePerdeName({ pc53, octave }) || "";
    return resolved || String(fallbackName || "") || `pc53=${formatAeuLabel(pc53)}`;
  }

  function buildMakamRoleOverlay(entry, { targetBaseStep, observedMinAbs, observedMaxAbs } = {}) {
    if (!entry || !(entry.durak || entry.guclu || entry.yeden)) return null;
    const durak = parseMakamDnaPerdeField(entry.durak);
    const guclu = parseMakamDnaPerdeField(entry.guclu);
    const yeden = parseMakamDnaPerdeField(entry.yeden);
    const options = { observedMinAbs, observedMaxAbs };
    const standardDurakAbs = durak && durak.name ? pickOverlayAbs53ForPerde(durak.name, { ...options, hint: durak.hint }) : null;
    const standardGucluAbs = guclu && guclu.name ? pickOverlayAbs53ForPerde(guclu.name, { ...options, hint: guclu.hint }) : null;
    const standardYedenAbs = yeden && yeden.name ? pickOverlayAbs53ForPerde(yeden.name, { ...options, hint: yeden.hint }) : null;
    let delta = 0;
    let transposed = false;
    if (Number.isFinite(standardDurakAbs) && Number.isFinite(targetBaseStep)) {
      delta = normalizeSigned53(mod53(targetBaseStep) - mod53(standardDurakAbs));
      transposed = delta !== 0;
    }
    const durakAbs = shiftAbs53NearObserved(standardDurakAbs, delta, options);
    const gucluAbs = shiftAbs53NearObserved(standardGucluAbs, delta, options);
    const yedenAbs = shiftAbs53NearObserved(standardYedenAbs, delta, options);
    return {
      transposed,
      durakAbs,
      gucluAbs,
      yedenAbs,
      durakLabel: formatRolePerdeLabel(durakAbs, durak.name),
      gucluLabel: formatRolePerdeLabel(gucluAbs, guclu.name),
      yedenLabel: formatRolePerdeLabel(yedenAbs, yeden.name),
      standardDurakName: durak.name,
      standardGucluName: guclu.name,
      standardYedenName: yeden.name,
    };
  }

  function resolvePerdePc53Candidates(perdeName) {
    return perdeService && typeof perdeService.resolvePc53Candidates === "function"
      ? perdeService.resolvePc53Candidates(perdeName)
      : [];
  }

  function formatPerdeNameForRow(row, { rowIs53 } = {}) {
    if (!rowIs53) return "";
    const fromToken = resolvePerdeNamesFromAbcToken(row.abcSpelling).filter(Boolean);
    if (fromToken.length) return fromToken.join(" / ");
    return resolvePerdeName({ pc53: row.absStep, octave: row.octave }) || "";
  }

  const copyController = createIntonationCopyController({
    copyDnaButton: elements.copyDna,
    copyPitchSetButton: elements.copyPitchSet,
    menu: elements.menu,
    clipboard,
    getSource: () => lastDnaSource,
    formatPerdeName: (row, options) => formatPerdeNameForRow(row, { rowIs53: options && options.is53 }),
    showToast,
    logError,
  });

  function updateBaseUi() {
    const mode = (elements.baseMode && elements.baseMode.value) || "auto";
    baseMode = mode;
    if (elements.baseManual) {
      const manual = mode === "manual";
      elements.baseManual.disabled = !manual;
      elements.baseManual.setAttribute("aria-disabled", manual ? "false" : "true");
    }
  }

  function setStatus(message, { error } = {}) {
    if (!elements.status) return;
    elements.status.textContent = String(message || "");
    elements.status.classList.toggle("error", Boolean(error));
  }

  function clearHostHighlights() {
    try { if (typeof host.setHighlightRanges === "function") host.setHighlightRanges([]); } catch {}
    try { if (typeof host.clearSvgBarHighlight === "function") host.clearSvgBarHighlight(); } catch {}
    try { if (typeof host.clearSvgNoteHighlight === "function") host.clearSvgNoteHighlight(); } catch {}
  }

  function renderRows(nextRows, { rowIs53, nextRoleAbs53Map } = {}) {
    if (!elements.tableBody) return;
    elements.tableBody.innerHTML = "";
    const list = Array.isArray(nextRows) ? nextRows : [];
    if (!list.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 4;
      td.textContent = "No pitch classes detected.";
      td.style.fontStyle = "italic";
      tr.appendChild(td);
      elements.tableBody.appendChild(tr);
      return;
    }
    for (const row of list) {
      const tr = document.createElement("tr");
      tr.tabIndex = 0;
      tr.dataset.step = String(row.step);
      tr.title = `pc53 rel=${formatAeuLabel(row.normalizedStep)}; abs=${formatAeuLabel(row.absStep)}`;
      if (activeStep != null && String(row.step) === String(activeStep)) tr.classList.add("active");

      const pc = document.createElement("td");
      const pcRel = document.createElement("span");
      const relLabel = formatAeuLabel(row.normalizedStep);
      const absLabel = formatAeuLabel(row.absStep);
      pcRel.textContent = relLabel;
      pc.append(pcRel);
      if (relLabel !== absLabel) {
        const pcAbs = document.createElement("span");
        pcAbs.textContent = ` (${absLabel})`;
        pcAbs.className = "subtle";
        pc.appendChild(pcAbs);
      }

      const perde = document.createElement("td");
      const perdeName = formatPerdeNameForRow(row, { rowIs53 });
      if (!rowIs53) {
        perde.textContent = "";
        perde.title = "";
        perde.classList.remove("subtle");
      } else {
        const role = (nextRoleAbs53Map && nextRoleAbs53Map.get(String(row.step))) ? nextRoleAbs53Map.get(String(row.step)) : "";
        perde.textContent = perdeName || "??";
        if (role) {
          const badge = document.createElement("span");
          badge.className = "intonation-role";
          badge.textContent = role;
          perde.appendChild(badge);
        }
        if (!perdeName) {
          perde.title = `No Perde label yet for token=${String(row.abcSpelling || "")} (pc53=${formatAeuLabel(row.absStep)}).`;
          perde.classList.add("subtle");
        } else {
          perde.title = "";
          perde.classList.remove("subtle");
        }
      }

      const abc = document.createElement("td");
      abc.textContent = row.abcSpelling || "";
      const weight = document.createElement("td");
      weight.textContent = String(row.count || 0);
      tr.append(pc, perde, abc, weight);
      tr.addEventListener("click", () => activateRow(row.step));
      tr.addEventListener("keydown", (event) => {
        if (!event || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        activateRow(row.step);
      });
      elements.tableBody.appendChild(tr);
    }
  }

  function renderCandidates(candidates) {
    if (!elements.candidates) return;
    elements.candidates.innerHTML = "";
    const list = Array.isArray(candidates) ? candidates : [];
    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "makam-candidate-empty";
      empty.textContent = "No candidates yet.";
      elements.candidates.appendChild(empty);
      return;
    }
    for (const candidate of list) {
      const item = document.createElement("details");
      item.className = "makam-candidate";
      const summary = document.createElement("summary");
      const title = document.createElement("span");
      title.className = "makam-candidate-title";
      title.textContent = String(candidate.makam || "");
      const confidence = document.createElement("span");
      confidence.className = "makam-candidate-confidence";
      confidence.textContent = String(candidate.confidence || "Possible");
      summary.append(title, confidence);
      item.appendChild(summary);

      const evidenceList = document.createElement("div");
      evidenceList.className = "makam-candidate-evidence";
      for (const ev of Array.isArray(candidate.evidence) ? candidate.evidence : []) {
        const row = document.createElement("div");
        row.className = "makam-candidate-evidence-row";
        const label = document.createElement("span");
        label.className = "makam-candidate-evidence-label";
        label.textContent = String(ev.label || ev.kind || "");
        const detail = document.createElement("span");
        detail.className = "makam-candidate-evidence-detail";
        detail.textContent = String(ev.detail || "");
        row.append(label, detail);
        evidenceList.appendChild(row);
      }

      const actions = document.createElement("div");
      actions.className = "makam-candidate-actions";
      const declared = document.createElement("button");
      declared.type = "button";
      declared.dataset.action = "declared";
      declared.dataset.makam = String(candidate.makam || "");
      declared.textContent = "Use as Declared";
      const compare = document.createElement("button");
      compare.type = "button";
      compare.dataset.action = "compare";
      compare.dataset.makam = String(candidate.makam || "");
      compare.textContent = "Compare Overlay";
      actions.append(declared, compare);
      item.append(evidenceList, actions);
      elements.candidates.appendChild(item);
    }
  }

  function renderPlot({ noteEvents, plotBaseStep, overlayMakamName } = {}) {
    if (!elements.plot || !elements.plotLine || !elements.plotPoints) return;
    const events = Array.isArray(noteEvents) ? noteEvents : [];
    if (!events.length) {
      clearPlot();
      return;
    }
    const compressed = [];
    for (const e of events) {
      const last = compressed.length ? compressed[compressed.length - 1] : null;
      if (last && Number(last.abs53) === Number(e.abs53)) continue;
      compressed.push(e);
    }
    if (compressed.length < 2) {
      clearPlot();
      return;
    }

    const absVals = compressed.map((e) => Number(e.abs53)).filter((n) => Number.isFinite(n));
    const minAbs = absVals.length ? Math.min(...absVals) : null;
    const maxAbs = absVals.length ? Math.max(...absVals) : null;
    if (!Number.isFinite(minAbs) || !Number.isFinite(maxAbs) || maxAbs === minAbs) {
      clearPlot();
      return;
    }

    const vb = elements.plot.viewBox && elements.plot.viewBox.baseVal ? elements.plot.viewBox.baseVal : { width: 360, height: 120 };
    const w = Number(vb.width) || 360;
    const h = Number(vb.height) || 120;
    const padX = 8;
    const padY = 10;
    const innerW = Math.max(1, w - padX * 2);
    const innerH = Math.max(1, h - padY * 2);
    const toX = (i) => padX + (i / (compressed.length - 1)) * innerW;
    const toY = (abs53) => padY + ((maxAbs - abs53) / (maxAbs - minAbs)) * innerH;

    elements.plotLine.setAttribute("points", compressed.map((e, i) => `${toX(i).toFixed(2)},${toY(Number(e.abs53)).toFixed(2)}`).join(" "));

    if (elements.plotOverlay) elements.plotOverlay.innerHTML = "";
    const overlayEntry = overlayMakamName ? getMakamDnaEntry(overlayMakamName) : null;
    if (elements.plotOverlay && overlayEntry) {
      const mkLine = (y, color, dash, label) => {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", String(padX));
        line.setAttribute("x2", String(w - padX));
        line.setAttribute("y1", String(y));
        line.setAttribute("y2", String(y));
        line.setAttribute("stroke", color);
        line.setAttribute("stroke-width", "1.2");
        if (dash) line.setAttribute("stroke-dasharray", dash);
        line.setAttribute("opacity", "0.75");
        if (label) line.setAttribute("data-label", label);
        return line;
      };
      const overlayRoles = buildMakamRoleOverlay(overlayEntry, {
        targetBaseStep: plotBaseStep,
        observedMinAbs: minAbs,
        observedMaxAbs: maxAbs,
      });
      const durakAbs = overlayRoles ? overlayRoles.durakAbs : null;
      const gucluAbs = overlayRoles ? overlayRoles.gucluAbs : null;
      const yedenAbs = overlayRoles ? overlayRoles.yedenAbs : null;
      const overlayLabels = [];
      if (Number.isFinite(durakAbs)) {
        elements.plotOverlay.appendChild(mkLine(toY(durakAbs), "rgba(20,110,60,1)", "", `Durak: ${overlayRoles.durakLabel}`));
        overlayLabels.push(`Durak: ${overlayRoles.durakLabel}`);
      }
      if (Number.isFinite(gucluAbs)) {
        elements.plotOverlay.appendChild(mkLine(toY(gucluAbs), "rgba(60,120,210,1)", "5,4", `Güçlü: ${overlayRoles.gucluLabel}`));
        overlayLabels.push(`Güçlü: ${overlayRoles.gucluLabel}`);
      }
      if (Number.isFinite(yedenAbs)) {
        elements.plotOverlay.appendChild(mkLine(toY(yedenAbs), "rgba(210,120,60,1)", "2,4", `Yeden: ${overlayRoles.yedenLabel}`));
        overlayLabels.push(`Yeden: ${overlayRoles.yedenLabel}`);
      }
      if (elements.plotLegend) {
        const overlayName = String(overlayEntry.makam || "");
        const transposed = overlayRoles && overlayRoles.transposed ? " transposed" : "";
        elements.plotLegend.textContent = overlayLabels.length
          ? `Overlay: ${overlayName}${transposed} (${overlayLabels.join(" · ")})`
          : `Overlay: ${overlayName}`;
      }
    } else if (elements.plotLegend) {
      const relBase = Number.isFinite(plotBaseStep) ? formatAeuLabel(mod53(plotBaseStep)) : "pc53=0";
      elements.plotLegend.textContent = `Observed trajectory (base ${relBase})`;
    }

    if (elements.plotPoints) elements.plotPoints.innerHTML = "";
    const turning = [];
    for (let i = 1; i + 1 < compressed.length; i += 1) {
      const a = Number(compressed[i - 1].abs53);
      const b = Number(compressed[i].abs53);
      const c = Number(compressed[i + 1].abs53);
      if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) continue;
      if (b > a && b > c) turning.push({ kind: "peak", idx: i, e: compressed[i] });
      else if (b < a && b < c) turning.push({ kind: "trough", idx: i, e: compressed[i] });
    }
    let sampledTurning = turning;
    const turnCap = 24;
    if (turning.length > turnCap) {
      const picked = [];
      const used = new Set();
      for (let i = 0; i < turnCap; i += 1) {
        const t = turnCap === 1 ? 0 : (i / (turnCap - 1));
        const j = Math.round(t * (turning.length - 1));
        if (used.has(j)) continue;
        used.add(j);
        picked.push(turning[j]);
      }
      sampledTurning = picked;
    }
    const important = [
      { kind: "start", idx: 0, e: compressed[0] },
      ...sampledTurning,
      { kind: "end", idx: compressed.length - 1, e: compressed[compressed.length - 1] },
    ];

    const mkPoint = (it) => {
      const e = it.e || {};
      const abs53 = Number(e.abs53);
      if (!Number.isFinite(abs53)) return null;
      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("cx", toX(it.idx).toFixed(2));
      c.setAttribute("cy", toY(abs53).toFixed(2));
      c.setAttribute("r", it.kind === "start" || it.kind === "end" ? "5.2" : "4.4");
      let fill = "rgba(0,0,0,0.5)";
      if (it.kind === "peak") fill = "rgba(200,60,60,0.9)";
      if (it.kind === "trough") fill = "rgba(60,110,210,0.9)";
      if (it.kind === "start") fill = "rgba(30,140,70,0.95)";
      if (it.kind === "end") fill = "rgba(0,0,0,0.8)";
      c.setAttribute("fill", fill);
      c.setAttribute("stroke", "rgba(255,255,255,0.9)");
      c.setAttribute("stroke-width", "1.2");
      c.setAttribute("data-kind", it.kind);
      c.setAttribute("data-start", String(e.start ?? ""));
      c.setAttribute("data-end", String(e.end ?? ""));
      const pc = formatAeuLabel(mod53(e.pc53 || 0));
      const perde = is53 ? (resolvePerdeName({ pc53: mod53(e.pc53 || 0), octave: e.octave }) || "") : "";
      const role = (roleAbs53Map && roleAbs53Map.get(String(abs53))) ? roleAbs53Map.get(String(abs53)) : "";
      c.setAttribute("title", `${it.kind}: ${String(e.spelling || "")} (pc53=${pc})${perde ? `; perde=${perde}` : ""}${role ? `; role=${role}` : ""}`);
      c.style.cursor = "pointer";
      c.addEventListener("mouseenter", () => {
        try {
          if (Number.isFinite(Number(abs53))) activateRow(abs53);
        } catch {}
      });
      c.addEventListener("click", () => {
        if (!Number.isFinite(Number(e.start))) return;
        try { activateRow(abs53); } catch {}
        try {
          const off = Number(e.start);
          const endOff = Number(e.end) || off + 1;
          if (typeof host.highlightNotesByRanges === "function") host.highlightNotesByRanges([{ start: off, end: endOff }]);
        } catch {}
        try {
          if (typeof host.focusEditorAt === "function") host.focusEditorAt(Number(e.start));
        } catch {}
      });
      return c;
    };

    for (const it of important) {
      const el = mkPoint(it);
      if (el && elements.plotPoints) elements.plotPoints.appendChild(el);
    }
  }

  function activateRow(step) {
    const target = rows.find((r) => String(r.step) === String(step));
    if (!target) return;
    activeStep = target.step;
    renderRows(rows, { rowIs53: is53, nextRoleAbs53Map: roleAbs53Map });
    try {
      const tr = elements.tableBody ? elements.tableBody.querySelector(`tr[data-step="${CSS.escape(String(target.step))}"]`) : null;
      if (tr && tr.scrollIntoView) tr.scrollIntoView({ block: "nearest" });
    } catch {}
    try { if (typeof host.setHighlightRanges === "function") host.setHighlightRanges(target.ranges); } catch {}
    const offsets = (target.ranges || []).map((r) => r && r.start);
    let noteOk = false;
    try { noteOk = typeof host.highlightNotesAtOffsets === "function" ? host.highlightNotesAtOffsets(offsets) : false; } catch {}
    try { if (!noteOk && typeof host.highlightBarsAtOffsets === "function") host.highlightBarsAtOffsets(offsets); } catch {}
    try { if (typeof host.scrollToCurrentHighlight === "function") host.scrollToCurrentHighlight(); } catch {}
    const label = target.abcSpelling ? `${target.abcSpelling} / pc53=${formatAeuLabel(target.normalizedStep)}` : `pc53=${formatAeuLabel(target.normalizedStep)}`;
    setStatus(`Highlighting ${label} (${target.count} hits)`);
  }

  function scanEntries(snapshot, { scanSkipGraceNotes = true, scope = null } = {}) {
    const activeTune = typeof host.resolveActiveTune === "function" ? host.resolveActiveTune(snapshot) : null;
    return scanIntonationEntriesCore(snapshot, {
      activeTune,
      skipGraceNotes: scanSkipGraceNotes,
      scope,
      perfEnabled: perfEnabled(),
      nowMs,
      logPerf,
    });
  }

  async function refresh() {
    if (!visible) return;
    if (typeof host.isRawMode === "function" && host.isRawMode()) {
      setStatus("Intonation Explorer is not available in Raw mode.", { error: true });
      return;
    }
    const perfOn = perfEnabled();
    const tAll0 = perfOn ? nowMs() : 0;
    setStatus("Refreshing...");
    try {
      const tSnap0 = perfOn ? nowMs() : 0;
      const snapshot = typeof host.refreshWorkingCopySnapshot === "function" ? await host.refreshWorkingCopySnapshot() : null;
      if (perfOn) logPerf("snapshot", { ms: Math.round(nowMs() - tSnap0) });
      if (!snapshot || snapshot.text == null) {
        rows = [];
        activeStep = null;
        is53 = false;
        renderRows([], { rowIs53: false });
        clearHostHighlights();
        lastDnaSource = null;
        setDnaUi({ dnaText: "", pitchSetText: "" });
        renderCandidates([]);
        clearPlot();
        setStatus("Unable to load working copy snapshot.", { error: true });
        return;
      }

      const tScan0 = perfOn ? nowMs() : 0;
      const scope = typeof host.getSelectionScope === "function" ? host.getSelectionScope() : null;
      const scanned = scanEntries(snapshot, { scanSkipGraceNotes: skipGraceNotes, scope });
      if (perfOn) {
        logPerf("scan", {
          ms: Math.round(nowMs() - tScan0),
          entries: scanned && scanned.entries ? scanned.entries.length : 0,
          notes: scanned && scanned.noteEvents ? scanned.noteEvents.length : 0,
          is53: Boolean(scanned && scanned.is53),
        });
      }
      if (scanned.error) {
        rows = [];
        activeStep = null;
        is53 = false;
        renderRows([], { rowIs53: false });
        clearHostHighlights();
        lastDnaSource = null;
        setDnaUi({ dnaText: "", pitchSetText: "" });
        renderCandidates([]);
        clearPlot();
        setStatus(scanned.error, { error: true });
        return;
      }

      is53 = Boolean(scanned.is53);
      if (is53) {
        try { await ensurePerdeApisLoaded(); } catch {}
      }
      updateBaseUi();
      const fullText = String(snapshot.text || "");
      const tuneText = scanned.tune ? fullText.slice(scanned.tune.start, scanned.tune.end) : "";
      const scopeLabel = scanned.scope && scanned.scope.type === "selection" ? "selection" : "tune";

      try {
        if (!autoMakamApplied && !declaredMakam && !compareMakam) {
          const detected = detectMakamFromTuneText(tuneText);
          if (detected) {
            autoMakamApplied = true;
            declaredMakam = detected;
            compareMakam = detected;
            if (elements.declaredMakam) elements.declaredMakam.value = detected;
            if (elements.compareMakam) elements.compareMakam.value = detected;
          }
        }
      } catch {}

      const mode = baseMode || "auto";
      let base = 0;
      let label = "pc53=0";
      if (mode === "manual") {
        const rawManual = (elements.baseManual && elements.baseManual.value) || DEFAULT_INT_BASE;
        const resolved = resolveTonalBaseInput(rawManual);
        if (!resolved.ok) {
          setStatus(resolved.error, { error: true });
          return;
        }
        base = resolved.base;
        label = resolved.label;
      } else if (mode === "fromK") {
        const resolved = parseTonalBaseFromK(tuneText);
        if (!resolved.ok) {
          setStatus(resolved.error, { error: true });
          return;
        }
        base = resolved.base;
        label = `K:${resolved.label}`;
      } else {
        base = pickAutoBaseStep(scanned.entries);
        label = `Auto pc53=${formatAeuLabel(base)}`;
      }
      baseStep = base;
      baseLabel = label;

      const tRows0 = perfOn ? nowMs() : 0;
      rows = buildIntonationRowsFromEntries(scanned.entries, base, { sortMode });
      if (perfOn) logPerf("rows", { ms: Math.round(nowMs() - tRows0), rows: rows.length });
      activeStep = null;

      const tRoles0 = perfOn ? nowMs() : 0;
      let nextRoleAbs53Map = null;
      try {
        const entry = getMakamDnaEntry(declaredMakam);
        const events = Array.isArray(scanned.noteEvents) ? scanned.noteEvents : [];
        const absVals = events.map((ev) => Number(ev.abs53)).filter((n) => Number.isFinite(n));
        const observedMinAbs = absVals.length ? Math.min(...absVals) : null;
        const observedMaxAbs = absVals.length ? Math.max(...absVals) : null;
        if (entry && (entry.durak || entry.guclu || entry.yeden)) {
          try { await ensurePerdeNameIndexLoaded(); } catch {}
          const roles = buildMakamRoleOverlay(entry, {
            targetBaseStep: baseStep,
            observedMinAbs,
            observedMaxAbs,
          });
          nextRoleAbs53Map = new Map();
          if (roles && Number.isFinite(roles.durakAbs)) nextRoleAbs53Map.set(String(roles.durakAbs), "durak");
          if (roles && Number.isFinite(roles.gucluAbs)) nextRoleAbs53Map.set(String(roles.gucluAbs), "güçlü");
          if (roles && Number.isFinite(roles.yedenAbs)) nextRoleAbs53Map.set(String(roles.yedenAbs), "yeden");
        }
      } catch {}
      roleAbs53Map = nextRoleAbs53Map;
      if (perfOn) logPerf("roles", { ms: Math.round(nowMs() - tRoles0), has: Boolean(roleAbs53Map && roleAbs53Map.size) });

      const tRender0 = perfOn ? nowMs() : 0;
      renderRows(rows, { rowIs53: is53, nextRoleAbs53Map: roleAbs53Map });
      if (perfOn) logPerf("renderTable", { ms: Math.round(nowMs() - tRender0) });

      try {
        await ensurePerdeNameIndexLoaded();
        const candidates = suggestMakamCandidates({
          tuneText,
          rows,
          noteEvents: scanned.noteEvents,
          baseStep,
          makamEntries: getMakamDnaEntries(),
          resolvePerdePc53: resolvePerdePc53Candidates,
          maxCandidates: 5,
        });
        renderCandidates(candidates);
      } catch (e) {
        logError(e);
        renderCandidates([]);
      }

      clearHostHighlights();
      const sortLabel = `sort:${String(sortMode || "count")}`;
      const modeLabel = is53 ? "EDO-53" : "EDO-12";
      setStatus(`Base ${baseLabel} (${scopeLabel}; ${rows.length} classes; ${sortLabel}; ${modeLabel})`);

      lastDnaSource = {
        tuneText,
        rows,
        noteEvents: scanned.noteEvents,
        baseStep,
        baseLabel,
        is53,
        scopeLabel,
      };
      setDnaUi({ dnaText: "ready", pitchSetText: "ready" });

      try {
        const tPlot0 = perfOn ? nowMs() : 0;
        renderPlot({ noteEvents: scanned.noteEvents, plotBaseStep: baseStep, overlayMakamName: compareMakam });
        if (perfOn) logPerf("plot", { ms: Math.round(nowMs() - tPlot0) });
      } catch {}
      if (perfOn) logPerf("total", { ms: Math.round(nowMs() - tAll0) });
    } catch (err) {
      const msg = (err && err.message) ? String(err.message) : String(err || "");
      setDnaUi({ dnaText: "", pitchSetText: "" });
      renderCandidates([]);
      clearPlot();
      setStatus(msg ? `Unable to refresh the explorer: ${msg}` : "Unable to refresh the explorer.", { error: true });
      logError(err);
    }
  }

  function show() {
    if (!elements.panel) return;
    if (typeof host.enableDraggableToolPanel === "function") host.enableDraggableToolPanel(elements.panel);
    visible = true;
    elements.panel.classList.remove("hidden");
    elements.panel.setAttribute("aria-hidden", "false");
    if (typeof host.ensureToolPanelDefaultLeftPosition === "function") host.ensureToolPanelDefaultLeftPosition(elements.panel);
    setDnaUi({ dnaText: "", pitchSetText: "" });
    renderCandidates([]);
    clearPlot();
    if (elements.baseMode) elements.baseMode.value = "auto";
    if (elements.baseManual && !elements.baseManual.value) elements.baseManual.value = DEFAULT_INT_BASE;
    if (elements.sort) elements.sort.value = "first";
    if (elements.skipGrace) elements.skipGrace.checked = true;
    baseMode = "auto";
    sortMode = "first";
    skipGraceNotes = true;
    autoMakamApplied = false;
    roleAbs53Map = null;
    Promise.resolve()
      .then(() => ensureMakamDnaLoaded())
      .then(() => {
        populateMakams();
      })
      .finally(() => {
        updateBaseUi();
        refresh().catch(() => {});
      });
  }

  function hide() {
    if (!elements.panel) return;
    visible = false;
    elements.panel.classList.add("hidden");
    elements.panel.setAttribute("aria-hidden", "true");
    if (elements.menu) elements.menu.classList.add("hidden");
    setStatus("");
    clearHostHighlights();
    setDnaUi({ dnaText: "", pitchSetText: "" });
    renderCandidates([]);
    clearPlot();
  }

  function wire() {
    if (elements.close) elements.close.addEventListener("click", () => hide());
    if (elements.refresh) elements.refresh.addEventListener("click", () => { refresh().catch(() => {}); });
    if (elements.declaredMakam) {
      elements.declaredMakam.addEventListener("change", () => {
        declaredMakam = (elements.declaredMakam && elements.declaredMakam.value) || "";
        refresh().catch(() => {});
      });
    }
    if (elements.compareMakam) {
      elements.compareMakam.addEventListener("change", () => {
        compareMakam = (elements.compareMakam && elements.compareMakam.value) || "";
        refresh().catch(() => {});
      });
    }
    if (elements.more && elements.menu) {
      const hideMenu = () => { try { elements.menu.classList.add("hidden"); } catch {} };
      const toggleMenu = () => { try { elements.menu.classList.toggle("hidden"); } catch {} };
      elements.more.addEventListener("click", (ev) => {
        try { if (ev) ev.stopPropagation(); } catch {}
        toggleMenu();
      });
      document.addEventListener("click", (ev) => {
        if (!elements.menu || elements.menu.classList.contains("hidden")) return;
        const t = ev && ev.target ? ev.target : null;
        if (t && (elements.menu.contains(t) || elements.more.contains(t))) return;
        hideMenu();
      });
      document.addEventListener("keydown", (ev) => {
        if (!elements.menu || elements.menu.classList.contains("hidden")) return;
        if (!ev || ev.key !== "Escape") return;
        try { ev.preventDefault(); } catch {}
        hideMenu();
      });
    }
    if (elements.editMakamDna) {
      elements.editMakamDna.addEventListener("click", async () => {
        try { if (elements.menu) elements.menu.classList.add("hidden"); } catch {}
        if (microtonalTools && typeof microtonalTools.openMakamDnaModal === "function") await microtonalTools.openMakamDnaModal();
      });
    }
    if (elements.candidates) {
      elements.candidates.addEventListener("click", (event) => {
        const target = event && event.target && event.target.closest ? event.target.closest("button[data-action][data-makam]") : null;
        if (!target) return;
        const makam = String(target.dataset.makam || "");
        if (!makam) return;
        if (target.dataset.action === "declared") {
          declaredMakam = makam;
          if (elements.declaredMakam) elements.declaredMakam.value = makam;
          refresh().catch(() => {});
          return;
        }
        if (target.dataset.action === "compare") {
          compareMakam = makam;
          if (elements.compareMakam) elements.compareMakam.value = makam;
          refresh().catch(() => {});
        }
      });
    }
    if (elements.baseMode) {
      elements.baseMode.addEventListener("change", () => {
        updateBaseUi();
        refresh().catch(() => {});
      });
    }
    if (elements.baseManual) {
      elements.baseManual.addEventListener("keydown", (event) => {
        if (!event || event.key !== "Enter") return;
        event.preventDefault();
        refresh().catch(() => {});
      });
    }
    if (elements.sort) {
      elements.sort.addEventListener("change", () => {
        sortMode = (elements.sort && elements.sort.value) || "count";
        refresh().catch(() => {});
      });
    }
    if (elements.skipGrace) {
      elements.skipGrace.addEventListener("change", () => {
        skipGraceNotes = Boolean(elements.skipGrace && elements.skipGrace.checked);
        refresh().catch(() => {});
      });
    }
  }

  return {
    close: hide,
    hide,
    isVisible: () => visible,
    open: show,
    populateMakams,
    refresh,
    show,
    toggle: () => {
      if (visible) hide();
      else show();
    },
    wire,
  };
}

export {
  createIntonationExplorerFeature,
};
