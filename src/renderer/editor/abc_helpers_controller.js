import {
  buildDecorationPickerItems,
  buildGmProgramItems,
  buildKeySignatureItems,
  findMidiProgramCommentEdit,
  findMidiProgramNumberEdit,
  filterKeySignatureItems,
  getDecorationDetails,
  getRangeDecorationBase,
  getMidiProgramCommand,
} from "./abc_helpers_model.js";
import { BUILTIN_MAKAM_K_SIGNATURES } from "../makam_dna/makam_k_signatures.mjs";
import { ABC2SVG_DECORATIONS } from "../abc_decorations_abc2svg.js";
import { isInBeginTextBlockAtLine } from "./editor_commands.js";
import { GM_PROGRAM_NAMES } from "./gm_programs.js";
import { openDrumHelperAtCursor } from "../tools/drum_helper/drum_helper_controller.js";
import { openGchordHelperAtCursor } from "../tools/gchord_helper/gchord_helper_controller.js";

function openAbcHelperAtCursor({
  view,
  EditorSelection,
  enableDraggableFixedPopover,
  showToast = () => {},
  drumVelocityMap = null,
  isInlineFieldOnlyLine = () => false,
  renderAbcToSvgMarkup = null,
  loadDecorationCatalogEnrichment = null,
} = {}) {
  if (!view || !view.state) return true;
  try {
    const pos = view.state.selection.main.head;
    const lineInfo = view.state.doc.lineAt(pos);
    const lineText = String(lineInfo.text || "");
    if (isInBeginTextBlockAtLine(view.state, lineInfo.number)) {
      showToast("Decoration picker: not available in %%begintext blocks.", 2200);
      return true;
    }
    if (openKeySignaturePickerAtCursor({
      view,
      pos,
      lineInfo,
      lineText,
      EditorSelection,
      enableDraggableFixedPopover,
    })) return true;
    if (openMidiProgramPickerAtCursor({
      view,
      pos,
      lineInfo,
      lineText,
      programNames: GM_PROGRAM_NAMES,
      EditorSelection,
      enableDraggableFixedPopover,
      showToast,
    })) return true;
    if (openDrumHelperAtCursor({
      view,
      pos,
      lineInfo,
      lineText,
      EditorSelection,
      enableDraggableFixedPopover,
      showToast,
      drumVelocityMap,
    })) return true;
    if (openGchordHelperAtCursor({
      view,
      pos,
      lineInfo,
      lineText,
      EditorSelection,
      enableDraggableFixedPopover,
      showToast,
      isInlineFieldOnlyLine,
    })) return true;
    openDecorationPickerAtCursor({
      view,
      pos,
      lineText,
      catalog: ABC2SVG_DECORATIONS,
      EditorSelection,
      enableDraggableFixedPopover,
      renderAbcToSvgMarkup,
      loadDecorationCatalogEnrichment,
      showToast,
    });
  } catch {}
  return true;
}

function openMidiProgramPickerAtCursor({
  view,
  pos,
  lineInfo,
  lineText,
  programNames,
  EditorSelection,
  enableDraggableFixedPopover,
  showToast,
} = {}) {
  if (!view || !view.state || !lineInfo) return false;
  const cmd = getMidiProgramCommand(lineText);
  if (!cmd) return false;

  const existing = document.getElementById("abcarusMidiProgramPopover");
  if (existing) {
    try {
      const close = existing.__abcarusClose;
      if (typeof close === "function") close();
      else existing.remove();
    } catch {}
    return true;
  }

  const anchorLineFrom = lineInfo.from;
  const anchorText = lineInfo.text || "";
  const GM_PROGRAMS = Array.isArray(programNames) && programNames.length ? programNames : [];

  const pop = document.createElement("div");
  pop.id = "abcarusMidiProgramPopover";
  pop.className = "abc-helper-popover";
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", "GM program picker");
  pop.style.position = "fixed";
  pop.style.zIndex = "9999";
  pop.style.maxWidth = "520px";

  const head = document.createElement("div");
  head.className = "abc-helper-header";
  head.style.display = "flex";
  head.style.alignItems = "center";
  head.style.justifyContent = "space-between";
  head.style.gap = "12px";

  const title = document.createElement("div");
  title.className = "abc-helper-title";
  title.textContent = `GM ${cmd} (0–127)`;
  head.appendChild(title);

  const hint = document.createElement("div");
  hint.className = "abc-helper-hint";
  hint.textContent = "Type to filter · Enter=insert · Esc=close";
  head.appendChild(hint);
  pop.appendChild(head);
  if (typeof enableDraggableFixedPopover === "function") enableDraggableFixedPopover(pop, head);

  const body = document.createElement("div");
  body.className = "abc-helper-body";
  pop.appendChild(body);

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Search instrument… (e.g. guitar, flute)";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.style.width = "100%";
  input.style.padding = "6px 8px";
  input.style.borderRadius = "6px";
  input.style.border = "1px solid rgba(0,0,0,0.2)";
  body.appendChild(input);

  const list = document.createElement("div");
  list.style.marginTop = "6px";
  list.style.maxHeight = "240px";
  list.style.overflow = "auto";
  list.style.border = "1px solid rgba(0,0,0,0.12)";
  list.style.borderRadius = "6px";
  body.appendChild(list);

  let items = [];
  let activeIdx = 0;

  const applyMidiProgramNumber = (programNumber, programName) => {
    try {
      const lineNow = view.state.doc.lineAt(pos);
      const textNow = lineNow.text || "";
      let edit = findMidiProgramNumberEdit(textNow, cmd, programNumber);
      let baseFrom = lineNow.from;
      let textUse = textNow;
      if (!edit) {
        edit = findMidiProgramNumberEdit(anchorText, cmd, programNumber);
        baseFrom = anchorLineFrom;
        textUse = anchorText;
      }
      if (!edit) {
        try { if (typeof showToast === "function") showToast("Can't apply GM program here.", 1800); } catch {}
        return false;
      }
      const from = baseFrom + edit.from;
      const to = baseFrom + edit.to;
      const insert = edit.insert;
      const cursorPos = from + insert.length;
      view.dispatch({
        changes: { from, to, insert },
        selection: EditorSelection.cursor(cursorPos),
        userEvent: "input",
      });

      try {
        const lineAfter = view.state.doc.lineAt(pos);
        const textAfter = lineAfter.text || textUse;
        const commentEdit = findMidiProgramCommentEdit(textAfter, cmd, programName);
        if (commentEdit) {
          view.dispatch({
            changes: {
              from: lineAfter.from + commentEdit.from,
              to: lineAfter.from + commentEdit.to,
              insert: commentEdit.insert,
            },
            userEvent: "input",
          });
        }
      } catch {}
      try { view.focus(); } catch {}
      return true;
    } catch (err) {
      try {
        const msg = err && err.message ? String(err.message) : String(err || "unknown error");
        if (typeof showToast === "function") showToast(`Failed to apply GM program: ${msg}`, 2400);
      } catch {}
      return false;
    }
  };

  const render = () => {
    list.textContent = "";
    items = buildGmProgramItems(GM_PROGRAMS, input.value || "");
    if (activeIdx >= items.length) activeIdx = 0;
    let activeRow = null;
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i];
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.gap = "10px";
      row.style.padding = "6px 8px";
      row.style.cursor = "pointer";
      row.style.borderTop = i === 0 ? "none" : "1px solid rgba(0,0,0,0.06)";
      if (i === activeIdx) {
        row.style.background = "rgba(30,144,255,0.12)";
        activeRow = row;
      }

      const num = document.createElement("div");
      num.textContent = String(it.idx);
      num.style.minWidth = "2.5em";
      num.style.opacity = "0.75";
      row.appendChild(num);

      const nm = document.createElement("div");
      nm.textContent = it.name;
      row.appendChild(nm);

      row.addEventListener("click", (ev) => {
        try { ev.preventDefault(); ev.stopPropagation(); } catch {}
        const ok = applyMidiProgramNumber(it.idx, it.name);
        if (ok) closePopover();
      }, true);
      list.appendChild(row);
    }
    try { if (activeRow) activeRow.scrollIntoView({ block: "nearest" }); } catch {}
  };

  input.addEventListener("input", () => {
    activeIdx = 0;
    render();
  });

  input.addEventListener("keydown", (ev) => {
    try {
      if (!ev) return;
      const k = String(ev.key || "");
      if (k === "ArrowDown") {
        if (items.length) activeIdx = Math.min(items.length - 1, activeIdx + 1);
        render();
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
      if (k === "ArrowUp") {
        if (items.length) activeIdx = Math.max(0, activeIdx - 1);
        render();
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
      if (k === "Enter") {
        const it = items[activeIdx];
        if (it) {
          const ok = applyMidiProgramNumber(it.idx, it.name);
          if (ok) closePopover();
        }
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
      if (k === "Escape") {
        closePopover();
        ev.preventDefault();
        ev.stopPropagation();
      }
    } catch {}
  });

  let closePopover = () => { try { pop.remove(); } catch {} };
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
  render();
  setTimeout(() => { try { input.focus(); input.select(); } catch {} }, 0);
  return true;
}

function openKeySignaturePickerAtCursor({
  view,
  pos,
  lineInfo,
  lineText,
  makamSignatures = BUILTIN_MAKAM_K_SIGNATURES,
  EditorSelection,
  enableDraggableFixedPopover,
} = {}) {
  if (!view || !view.state || !lineInfo || !EditorSelection) return false;
  if (!/^\s*K:/.test(String(lineText || ""))) return false;

  const existing = document.getElementById("abcarusKeySignaturePopover");
  if (existing) {
    try {
      const close = existing.__abcarusClose;
      if (typeof close === "function") close();
      else existing.remove();
    } catch {}
    return true;
  }

  const allItems = buildKeySignatureItems(makamSignatures);
  const pop = document.createElement("div");
  pop.id = "abcarusKeySignaturePopover";
  pop.className = "abc-helper-popover";
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", "Key signature picker");
  pop.style.position = "fixed";
  pop.style.zIndex = "9999";
  pop.style.width = "min(720px, calc(100vw - 20px))";
  pop.style.maxWidth = "calc(100vw - 20px)";
  pop.style.maxHeight = "calc(100vh - 20px)";
  pop.style.overflow = "auto";

  const head = document.createElement("div");
  head.className = "abc-helper-header";
  head.style.display = "flex";
  head.style.alignItems = "center";
  head.style.justifyContent = "space-between";
  head.style.gap = "12px";

  const title = document.createElement("div");
  title.className = "abc-helper-title";
  title.textContent = "Key signature";
  head.appendChild(title);

  const hint = document.createElement("div");
  hint.className = "abc-helper-hint";
  hint.textContent = "Search makam or key · Enter=insert · Esc=close";
  head.appendChild(hint);
  pop.appendChild(head);
  if (typeof enableDraggableFixedPopover === "function") enableDraggableFixedPopover(pop, head);

  const body = document.createElement("div");
  body.className = "abc-helper-body";
  pop.appendChild(body);

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Search… (e.g. hicaz, rast, C _4B, F#m)";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.style.width = "100%";
  input.style.padding = "6px 8px";
  input.style.borderRadius = "6px";
  input.style.border = "1px solid rgba(0,0,0,0.2)";
  input.style.boxSizing = "border-box";
  body.appendChild(input);

  const list = document.createElement("div");
  list.style.marginTop = "6px";
  list.style.maxHeight = "320px";
  list.style.overflow = "auto";
  list.style.border = "1px solid rgba(0,0,0,0.12)";
  list.style.borderRadius = "6px";
  body.appendChild(list);

  let items = [];
  let activeIdx = 0;
  let closePopover = () => { try { pop.remove(); } catch {} };

  const applyKeySignature = (item) => {
    try {
      if (!item || !item.k) return false;
      const currentLine = view.state.doc.lineAt(pos);
      const text = currentLine.text || "";
      const m = /^(\s*K:\s*)(.*)$/.exec(text);
      if (!m) return false;
      const prefix = m[1] || "";
      const rest = m[2] || "";
      const commentIdx = rest.indexOf("%");
      const comment = commentIdx >= 0 ? rest.slice(commentIdx) : "";
      const insert = `${item.k}${comment ? (comment.startsWith(" ") ? comment : ` ${comment}`) : ""}`;
      const from = currentLine.from + prefix.length;
      view.dispatch({
        changes: { from, to: currentLine.to, insert },
        selection: EditorSelection.cursor(from + String(item.k).length),
        userEvent: "input",
      });
      try { view.focus(); } catch {}
      return true;
    } catch {}
    return false;
  };

  const render = () => {
    list.textContent = "";
    items = filterKeySignatureItems(allItems, input.value || "");
    if (activeIdx >= items.length) activeIdx = 0;
    let activeRow = null;
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "12em 1fr";
      row.style.gap = "10px";
      row.style.padding = "6px 8px";
      row.style.cursor = "pointer";
      row.style.borderTop = i === 0 ? "none" : "1px solid rgba(0,0,0,0.06)";
      if (i === activeIdx) {
        row.style.background = "rgba(30,144,255,0.12)";
        activeRow = row;
      }

      const key = document.createElement("div");
      key.textContent = item.k;
      key.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace";
      key.style.fontWeight = "600";
      key.style.whiteSpace = "nowrap";
      row.appendChild(key);

      const detail = document.createElement("div");
      detail.textContent = item.detail || "";
      detail.style.opacity = "0.75";
      detail.style.overflow = "hidden";
      detail.style.whiteSpace = "nowrap";
      detail.style.textOverflow = "ellipsis";
      row.appendChild(detail);

      row.addEventListener("click", (ev) => {
        try { ev.preventDefault(); ev.stopPropagation(); } catch {}
        const ok = applyKeySignature(item);
        if (ok) closePopover();
      }, true);
      list.appendChild(row);
    }
    try { if (activeRow) activeRow.scrollIntoView({ block: "nearest" }); } catch {}
  };

  input.addEventListener("input", () => {
    activeIdx = 0;
    render();
  });

  input.addEventListener("keydown", (ev) => {
    try {
      if (!ev) return;
      const key = String(ev.key || "");
      if (key === "ArrowDown") {
        if (items.length) activeIdx = Math.min(items.length - 1, activeIdx + 1);
        render();
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
      if (key === "ArrowUp") {
        if (items.length) activeIdx = Math.max(0, activeIdx - 1);
        render();
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
      if (key === "Enter") {
        const item = items[activeIdx];
        if (item) {
          const ok = applyKeySignature(item);
          if (ok) closePopover();
        }
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
      if (key === "Escape") {
        closePopover();
        ev.preventDefault();
        ev.stopPropagation();
      }
    } catch {}
  }, true);

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
  render();
  setTimeout(() => { try { input.focus(); input.select(); } catch {} }, 0);
  return true;
}

function openDecorationPickerAtCursor({
  view,
  pos,
  lineText,
  catalog,
  EditorSelection,
  enableDraggableFixedPopover,
  renderAbcToSvgMarkup,
  loadDecorationCatalogEnrichment,
  showToast,
} = {}) {
  if (!view || !view.state || !EditorSelection) return false;
  if (/^\s*[A-Za-z]:/.test(lineText) || /^\s*[Ww]:/.test(lineText) || /^\s*%%\s*(begintext|endtext)\b/i.test(lineText)) {
    try { if (typeof showToast === "function") showToast("Decoration picker: place cursor on a music line.", 2200); } catch {}
    return true;
  }

  const existing = document.getElementById("abcarusAbcInsertPopover");
  if (existing) {
    try {
      const close = existing.__abcarusClose;
      if (typeof close === "function") close();
      else existing.remove();
    } catch {}
    return true;
  }

  const coords = view.coordsAtPos(pos);

  const pop = document.createElement("div");
  pop.id = "abcarusAbcInsertPopover";
  pop.className = "abc-helper-popover";
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", "ABC insert");
  pop.style.position = "fixed";
  pop.style.zIndex = "9999";
  pop.style.width = "min(1040px, calc(100vw - 20px))";
  pop.style.maxWidth = "calc(100vw - 20px)";
  pop.style.maxHeight = "calc(100vh - 20px)";
  pop.style.overflow = "auto";
  pop.style.resize = "both";
  pop.style.minWidth = "760px";
  pop.style.minHeight = "260px";

  const head = document.createElement("div");
  head.className = "abc-helper-header";
  head.style.display = "flex";
  head.style.alignItems = "center";
  head.style.justifyContent = "space-between";
  head.style.gap = "12px";
  head.style.cursor = "move";
  head.style.userSelect = "none";
  head.style.touchAction = "none";

  const title = document.createElement("div");
  title.className = "abc-helper-title";
  title.textContent = "Insert decoration";
  head.appendChild(title);

  const hint = document.createElement("div");
  hint.className = "abc-helper-hint";
  hint.textContent = "Drag to move · Resize corner · Enter=insert · Shift+Enter=!name! · (Select text for range) · Esc=close";
  hint.style.fontSize = "11px";
  hint.style.whiteSpace = "nowrap";
  head.appendChild(hint);

  pop.appendChild(head);
  if (typeof enableDraggableFixedPopover === "function") enableDraggableFixedPopover(pop, head);

  const body = document.createElement("div");
  body.className = "abc-helper-body";
  pop.appendChild(body);

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Search… (e.g. trill, segno, fermata)";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.style.width = "100%";
  input.style.padding = "6px 8px";
  input.style.borderRadius = "6px";
  input.style.border = "1px solid rgba(0,0,0,0.2)";
  body.appendChild(input);

  const controls = document.createElement("div");
  controls.style.marginTop = "6px";
  controls.style.display = "flex";
  controls.style.alignItems = "center";
  controls.style.gap = "14px";
  controls.style.fontSize = "12px";
  controls.style.opacity = "0.9";
  body.appendChild(controls);

  const mkCheckbox = (labelText) => {
    const label = document.createElement("label");
    label.style.display = "flex";
    label.style.alignItems = "center";
    label.style.gap = "6px";
    label.style.cursor = "pointer";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    label.appendChild(cb);
    const t = document.createElement("span");
    t.textContent = labelText;
    label.appendChild(t);
    return { label, cb };
  };

  const favoritesFirstCtl = mkCheckbox("Favorites first");
  const hideNoPreviewCtl = mkCheckbox("Hide no-preview");
  controls.appendChild(favoritesFirstCtl.label);
  controls.appendChild(hideNoPreviewCtl.label);

  const contentRow = document.createElement("div");
  contentRow.style.marginTop = "6px";
  contentRow.style.display = "flex";
  contentRow.style.gap = "10px";
  contentRow.style.flexWrap = "wrap";
  body.appendChild(contentRow);

  const listWrap = document.createElement("div");
  listWrap.style.flex = "1 1 520px";
  listWrap.style.minWidth = "360px";
  contentRow.appendChild(listWrap);

  const list = document.createElement("div");
  list.style.maxHeight = "300px";
  list.style.overflowY = "auto";
  list.style.overflowX = "hidden";
  list.style.border = "1px solid rgba(0,0,0,0.12)";
  list.style.borderRadius = "6px";
  listWrap.appendChild(list);

  const details = document.createElement("div");
  details.style.flex = "1 1 440px";
  details.style.minWidth = "360px";
  details.style.display = "flex";
  details.style.flexDirection = "column";
  details.style.gap = "8px";
  contentRow.appendChild(details);

  const detailsTitle = document.createElement("div");
  detailsTitle.style.fontWeight = "600";
  detailsTitle.textContent = "Details";
  details.appendChild(detailsTitle);

  const detailsDesc = document.createElement("div");
  detailsDesc.style.opacity = "0.9";
  detailsDesc.style.fontSize = "12px";
  detailsDesc.style.lineHeight = "1.35";
  detailsDesc.textContent = "";
  details.appendChild(detailsDesc);

  const detailsExample = document.createElement("div");
  detailsExample.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace";
  detailsExample.style.fontSize = "12px";
  detailsExample.style.opacity = "0.8";
  detailsExample.textContent = "";
  details.appendChild(detailsExample);

  const previewWrap = document.createElement("div");
  previewWrap.style.border = "1px solid rgba(0,0,0,0.12)";
  previewWrap.style.borderRadius = "6px";
  previewWrap.style.padding = "6px";
  previewWrap.style.background = "rgba(250,250,250,0.9)";
  previewWrap.style.maxHeight = "340px";
  previewWrap.style.overflow = "auto";
  previewWrap.style.display = "flex";
  previewWrap.style.alignItems = "center";
  previewWrap.style.justifyContent = "center";
  details.appendChild(previewWrap);

  const preview = document.createElement("div");
  preview.textContent = "";
  previewWrap.appendChild(preview);

  let closePopover = () => { try { pop.remove(); } catch {} };
  let reposition = () => {};
  let dragging = false;
  let dragPointerId = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragOriginLeft = 0;
  let dragOriginTop = 0;
  let dragWidth = 0;
  let dragHeight = 0;

  let enrichment = null;
  let previewSeq = 0;
  let previewTimer = null;
  const previewStatus = new Map();
  let favoriteNames = new Set();
  let favoritesFirst = true;
  let hideNoPreview = false;
  let activeName = "";

  const loadJsonLocalStorage = (key, fallbackValue) => {
    try {
      const raw = window && window.localStorage ? window.localStorage.getItem(key) : null;
      if (!raw) return fallbackValue;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallbackValue : parsed;
    } catch {
      return fallbackValue;
    }
  };
  const saveJsonLocalStorage = (key, value) => {
    try {
      if (!window || !window.localStorage) return;
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  };

  const FAVORITES_KEY = "abcarus.decorationPicker.favorites";
  const FAVORITES_FIRST_KEY = "abcarus.decorationPicker.favoritesFirst";
  const HIDE_NO_PREVIEW_KEY = "abcarus.decorationPicker.hideNoPreview";

  const loadFavorites = () => {
    const arr = loadJsonLocalStorage(FAVORITES_KEY, []);
    if (!Array.isArray(arr)) return new Set();
    const set = new Set();
    for (const v of arr) {
      const s = String(v || "").trim();
      if (s) set.add(s);
    }
    return set;
  };
  const saveFavorites = () => {
    const arr = Array.from(favoriteNames.values()).slice(0, 80);
    saveJsonLocalStorage(FAVORITES_KEY, arr);
  };
  const toggleFavorite = (name) => {
    const n = String(name || "");
    if (!n) return;
    if (favoriteNames.has(n)) favoriteNames.delete(n);
    else favoriteNames.add(n);
    saveFavorites();
  };

  favoriteNames = loadFavorites();
  favoritesFirst = Boolean(loadJsonLocalStorage(FAVORITES_FIRST_KEY, true));
  hideNoPreview = Boolean(loadJsonLocalStorage(HIDE_NO_PREVIEW_KEY, false));
  favoritesFirstCtl.cb.checked = favoritesFirst;
  hideNoPreviewCtl.cb.checked = hideNoPreview;

  favoritesFirstCtl.cb.addEventListener("change", () => {
    favoritesFirst = Boolean(favoritesFirstCtl.cb.checked);
    saveJsonLocalStorage(FAVORITES_FIRST_KEY, favoritesFirst);
    try { render(); } catch {}
  });
  hideNoPreviewCtl.cb.addEventListener("change", () => {
    hideNoPreview = Boolean(hideNoPreviewCtl.cb.checked);
    saveJsonLocalStorage(HIDE_NO_PREVIEW_KEY, hideNoPreview);
    try { render(); } catch {}
  });

  const parsePx = (v) => {
    const n = Number.parseFloat(String(v || ""));
    return Number.isFinite(n) ? n : null;
  };

  const renderPreview = (name, exampleAbc) => {
    const seq = (previewSeq += 1);
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(async () => {
      if (seq !== previewSeq) return;
      const decName = String(name || "");
      const prevStatus = decName ? previewStatus.get(decName) : null;
      const example = String(exampleAbc || "").trim();
      if (!example) {
        preview.textContent = "";
        return;
      }

      preview.textContent = "Rendering preview…";
      try {
        const abcText = `X:1\n%%pagewidth 18cm\n%%scale 1.6\n%%topspace 0\n%%botspace 0\n%%leftmargin 0.6cm\n%%rightmargin 0.6cm\nM:4/4\nL:1/4\nK:C\n${example}\n`;
        const res = await renderAbcToSvgMarkup(abcText, { suppressGlobalErrors: true, stopOnFirstError: true });
        if (seq !== previewSeq) return;
        if (!res || !res.ok || !res.svg) {
          if (decName) previewStatus.set(decName, "none");
          preview.textContent = "Preview unavailable.";
          if (decName && prevStatus !== "none") {
            try { render(); } catch {}
          }
          return;
        }
        if (decName) previewStatus.set(decName, "ok");
        preview.innerHTML = res.svg;
        if (decName && prevStatus !== "ok") {
          try { render(); } catch {}
        }
        try {
          const svgs = Array.from(preview.querySelectorAll("svg"));
          for (const svg of svgs) {
            svg.style.maxWidth = "100%";
            svg.style.height = "auto";
            svg.style.display = "block";
          }
        } catch {}
      } catch {
        if (seq !== previewSeq) return;
        if (decName) previewStatus.set(decName, "none");
        preview.textContent = "Preview unavailable.";
        if (decName && prevStatus !== "none") {
          try { render(); } catch {}
        }
      }
    }, 80);
  };

  const updateDetails = (dec) => {
    const name = dec && dec.name ? String(dec.name) : "";
    const abc = dec && dec.abc ? String(dec.abc) : "";
    const { description, example } = getDecorationDetails(dec, enrichment);
    detailsTitle.textContent = name ? `Details: ${name}` : "Details";
    detailsDesc.textContent = description || "";
    detailsExample.textContent = example ? `Example: ${example}` : (abc ? `Example: ${abc}c` : "");
    renderPreview(name, example);
  };

  const insertDecoration = (dec, fullForm) => {
    try {
      if (!dec) return false;
      if (view.state.readOnly) return false;

      const name = dec && dec.name ? String(dec.name) : "";
      const base = getRangeDecorationBase(name);

      const sel = view.state.selection.main;
      const selectedText = sel.empty ? "" : view.state.doc.sliceString(sel.from, sel.to);

      if (base) {
        const startTag = `!${base}(!`;
        const endTag = `!${base})!`;
        if (sel.empty) {
          view.dispatch({
            changes: { from: sel.from, to: sel.to, insert: `${startTag}${endTag}` },
            selection: EditorSelection.cursor(sel.from + startTag.length),
            userEvent: "input",
          });
        } else {
          view.dispatch({
            changes: [
              { from: sel.to, to: sel.to, insert: endTag },
              { from: sel.from, to: sel.from, insert: startTag },
            ],
            selection: EditorSelection.range(sel.from + startTag.length, sel.to + startTag.length),
            userEvent: "input",
          });
        }
      } else {
        const hasChar = Boolean(dec.char);
        const insertText = fullForm ? String(dec.abc || "") : (hasChar ? String(dec.char || "") : String(dec.abc || ""));
        if (!insertText) return false;
        const insert = selectedText ? `${insertText}${selectedText}` : insertText;
        const cursorPos = sel.from + insert.length;
        view.dispatch({
          changes: { from: sel.from, to: sel.to, insert },
          selection: EditorSelection.cursor(cursorPos),
          userEvent: "input",
        });
      }

      try { view.focus(); } catch {}
      return true;
    } catch {}
    return false;
  };

  let items = [];
  let activeIdx = 0;

  const render = () => {
    list.textContent = "";
    items = buildDecorationPickerItems(catalog, {
      query: input.value || "",
      enrichment,
      favoriteNames,
      favoritesFirst,
      hideNoPreview,
      previewStatus,
    });

    if (activeName) {
      const idx = items.findIndex((d) => d && d.name === activeName);
      if (idx >= 0) activeIdx = idx;
    }
    if (activeIdx >= items.length) activeIdx = 0;

    let activeRow = null;
    for (let i = 0; i < items.length; i += 1) {
      const dec = items[i];
      const { description } = getDecorationDetails(dec, enrichment);
      const fav = favoriteNames.has(dec.name);
      const noPrev = previewStatus.get(dec.name) === "none";
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "3.2em 1fr 10em";
      row.style.gap = "10px";
      row.style.padding = "6px 8px";
      row.style.cursor = "pointer";
      row.style.borderTop = i === 0 ? "none" : "1px solid rgba(0,0,0,0.06)";
      {
        let rowOpacity = 1;
        if (dec.isInternal) rowOpacity = 0.9;
        if (noPrev) rowOpacity = Math.min(rowOpacity, 0.55);
        row.style.opacity = String(rowOpacity);
      }
      if (i === activeIdx) {
        row.style.background = "rgba(30,144,255,0.12)";
        activeRow = row;
      }

      const ch = document.createElement("div");
      ch.textContent = dec.char || "";
      ch.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace";
      ch.style.fontWeight = "600";
      ch.style.opacity = dec.char ? "1" : "0.25";
      row.appendChild(ch);

      const nmWrap = document.createElement("div");
      nmWrap.style.display = "flex";
      nmWrap.style.flexDirection = "column";
      nmWrap.style.gap = "2px";
      row.appendChild(nmWrap);

      const nameRow = document.createElement("div");
      nameRow.style.display = "flex";
      nameRow.style.alignItems = "center";
      nameRow.style.gap = "8px";
      nmWrap.appendChild(nameRow);

      const star = document.createElement("button");
      star.type = "button";
      star.textContent = fav ? "★" : "☆";
      star.setAttribute("aria-label", fav ? "Unfavorite" : "Favorite");
      star.title = fav ? "Unfavorite" : "Favorite";
      star.style.border = "none";
      star.style.background = "transparent";
      star.style.padding = "0";
      star.style.margin = "0";
      star.style.cursor = "pointer";
      star.style.fontSize = "18px";
      star.style.lineHeight = "1";
      star.style.width = "18px";
      star.style.height = "18px";
      star.style.display = "inline-flex";
      star.style.alignItems = "center";
      star.style.justifyContent = "center";
      star.style.opacity = fav ? "1" : "0.55";
      star.addEventListener("click", (ev) => {
        try { ev.preventDefault(); ev.stopPropagation(); } catch {}
        toggleFavorite(dec.name);
        activeName = dec.name;
        try { render(); } catch {}
      });
      nameRow.appendChild(star);

      const nm = document.createElement("div");
      nm.textContent = dec.displayName || dec.name;
      if (dec.pairEndAbc) nm.style.fontWeight = "600";
      nameRow.appendChild(nm);

      const ds = document.createElement("div");
      ds.textContent = description || "";
      ds.style.fontSize = "12px";
      ds.style.opacity = "0.65";
      ds.style.overflow = "hidden";
      ds.style.whiteSpace = "nowrap";
      ds.style.textOverflow = "ellipsis";
      if (dec.pairEndAbc && !ds.textContent) {
        ds.textContent = "Range decoration (wrap selection)";
      }
      if (noPrev) {
        ds.textContent = ds.textContent ? `${ds.textContent} · no preview` : "No preview (example may be incomplete)";
      }
      nmWrap.appendChild(ds);

      const ab = document.createElement("div");
      ab.textContent = dec.abc;
      ab.style.textAlign = "right";
      ab.style.opacity = "0.75";
      ab.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace";
      ab.style.whiteSpace = "nowrap";
      ab.style.overflow = "hidden";
      ab.style.textOverflow = "ellipsis";
      row.appendChild(ab);

      row.addEventListener("mouseenter", () => {
        activeIdx = i;
        activeName = dec.name;
        updateDetails(dec);
      });
      row.addEventListener("click", (ev) => {
        try {
          if (ev && typeof ev.target?.closest === "function" && ev.target.closest("button")) return;
        } catch {}
        try { ev.preventDefault(); ev.stopPropagation(); } catch {}
        const ok = insertDecoration(dec, false);
        if (ok) closePopover();
      });

      list.appendChild(row);
    }

    try {
      if (activeRow) activeRow.scrollIntoView({ block: "nearest" });
    } catch {}
    activeName = items[activeIdx] && items[activeIdx].name ? String(items[activeIdx].name) : "";
  };

  const onDocKey = (ev) => {
    try {
      if (!ev) return;
      if (ev.key === "Escape") {
        closePopover();
      }
    } catch {}
  };
  const onDocDown = (ev) => {
    try {
      if (!ev) return;
      if (pop.contains(ev.target)) return;
      closePopover();
    } catch {}
  };
  const onDocPointerUp = (ev) => {
    try {
      if (!ev) return;
      if (dragging) return;
      if (!pop.isConnected) return;
      if (!pop.contains(ev.target)) return;
      reposition();
    } catch {}
  };
  const cleanup = () => {
    document.removeEventListener("keydown", onDocKey, true);
    document.removeEventListener("mousedown", onDocDown, true);
    document.removeEventListener("pointerup", onDocPointerUp, true);
    window.removeEventListener("resize", reposition);
    if (previewTimer) clearTimeout(previewTimer);
  };
  closePopover = () => {
    try { cleanup(); } catch {}
    try { pop.remove(); } catch {}
  };
  pop.__abcarusClose = closePopover;

  input.addEventListener("keydown", (ev) => {
    try {
      if (!ev) return;
      const key = String(ev.key || "");
      if (key === "ArrowDown") {
        if (items.length) activeIdx = Math.min(items.length - 1, activeIdx + 1);
        render();
        if (items[activeIdx]) updateDetails(items[activeIdx]);
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
      if (key === "ArrowUp") {
        if (items.length) activeIdx = Math.max(0, activeIdx - 1);
        render();
        if (items[activeIdx]) updateDetails(items[activeIdx]);
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
      if (key === "Enter") {
        const dec = items[activeIdx];
        if (dec) {
          const ok = insertDecoration(dec, Boolean(ev.shiftKey));
          if (ok) closePopover();
        }
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
      if (key === "Escape") {
        closePopover();
        ev.preventDefault();
        ev.stopPropagation();
      }
    } catch {}
  }, true);

  input.addEventListener("input", () => {
    activeIdx = 0;
    render();
  });

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
  reposition = () => {
    try {
      const w = window.innerWidth || 0;
      const h = window.innerHeight || 0;
      const r = pop.getBoundingClientRect();
      let x = parsePx(pop.style.left);
      let y = parsePx(pop.style.top);
      if (x == null) x = r.left;
      if (y == null) y = r.top;
      if (x + r.width + margin > w) x = Math.max(margin, w - r.width - margin);
      if (y + r.height + margin > h) y = Math.max(margin, h - r.height - margin);
      if (y < margin) y = margin;
      if (x < margin) x = margin;
      pop.style.left = `${Math.round(x)}px`;
      pop.style.top = `${Math.round(y)}px`;
    } catch {}
  };
  try {
    const r0 = pop.getBoundingClientRect();
    const w0 = window.innerWidth || 0;
    const h0 = window.innerHeight || 0;
    let x0 = left;
    let y0 = top;
    if (x0 + r0.width + margin > w0) x0 = Math.max(margin, w0 - r0.width - margin);
    if (y0 + r0.height + margin > h0) y0 = Math.max(margin, h0 - r0.height - margin);
    if (y0 < margin) y0 = margin;
    if (x0 < margin) x0 = margin;
    pop.style.left = `${Math.round(x0)}px`;
    pop.style.top = `${Math.round(y0)}px`;
  } catch {}
  reposition();

  head.addEventListener("pointerdown", (ev) => {
    try {
      if (!ev) return;
      if (ev.button !== 0) return;
      dragging = true;
      dragPointerId = ev.pointerId;
      dragStartX = ev.clientX;
      dragStartY = ev.clientY;
      const r = pop.getBoundingClientRect();
      dragOriginLeft = parsePx(pop.style.left);
      dragOriginTop = parsePx(pop.style.top);
      if (dragOriginLeft == null) dragOriginLeft = r.left;
      if (dragOriginTop == null) dragOriginTop = r.top;
      dragWidth = r.width;
      dragHeight = r.height;
      try { head.setPointerCapture(dragPointerId); } catch {}
      ev.preventDefault();
      ev.stopPropagation();
    } catch {}
  }, true);
  head.addEventListener("pointermove", (ev) => {
    try {
      if (!dragging) return;
      if (dragPointerId != null && ev.pointerId !== dragPointerId) return;
      const w = window.innerWidth || 0;
      const h = window.innerHeight || 0;
      let x = dragOriginLeft + (ev.clientX - dragStartX);
      let y = dragOriginTop + (ev.clientY - dragStartY);
      const maxX = Math.max(margin, w - dragWidth - margin);
      const maxY = Math.max(margin, h - dragHeight - margin);
      if (x < margin) x = margin;
      if (y < margin) y = margin;
      if (x > maxX) x = maxX;
      if (y > maxY) y = maxY;
      pop.style.left = `${Math.round(x)}px`;
      pop.style.top = `${Math.round(y)}px`;
      ev.preventDefault();
      ev.stopPropagation();
    } catch {}
  }, true);
  const stopDragging = (ev) => {
    try {
      if (!dragging) return;
      if (dragPointerId != null && ev && ev.pointerId !== dragPointerId) return;
      try { if (dragPointerId != null) head.releasePointerCapture(dragPointerId); } catch {}
      dragging = false;
      dragPointerId = null;
      reposition();
    } catch {}
  };
  head.addEventListener("pointerup", stopDragging, true);
  head.addEventListener("pointercancel", stopDragging, true);

  document.addEventListener("keydown", onDocKey, true);
  document.addEventListener("mousedown", onDocDown, true);
  document.addEventListener("pointerup", onDocPointerUp, true);
  window.addEventListener("resize", reposition, { passive: true });

  render();
  if (items[activeIdx]) updateDetails(items[activeIdx]);
  setTimeout(() => { try { reposition(); } catch {} }, 0);
  setTimeout(() => { try { input.focus(); input.select(); } catch {} }, 0);

  if (typeof loadDecorationCatalogEnrichment === "function") {
    loadDecorationCatalogEnrichment().then((m) => {
      if (m) enrichment = m;
      try { render(); } catch {}
      try { if (items[activeIdx]) updateDetails(items[activeIdx]); } catch {}
    }).catch(() => {});
  }
  return true;
}

export {
  openAbcHelperAtCursor,
  openDecorationPickerAtCursor,
  openKeySignaturePickerAtCursor,
  openMidiProgramPickerAtCursor,
};
