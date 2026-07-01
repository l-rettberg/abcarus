import {
  buildGmProgramItems,
  findMidiProgramCommentEdit,
  findMidiProgramNumberEdit,
  getMidiProgramCommand,
} from "./abc_helpers_model.js";

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
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", "GM program picker");
  pop.style.position = "fixed";
  pop.style.zIndex = "9999";
  pop.style.maxWidth = "520px";
  pop.style.padding = "8px 10px";
  pop.style.borderRadius = "8px";
  pop.style.border = "1px solid rgba(0,0,0,0.18)";
  pop.style.background = "rgba(255,255,255,0.98)";
  pop.style.boxShadow = "0 8px 24px rgba(0,0,0,0.18)";
  pop.style.fontSize = "13px";
  pop.style.lineHeight = "1.35";

  const head = document.createElement("div");
  head.style.display = "flex";
  head.style.alignItems = "center";
  head.style.justifyContent = "space-between";
  head.style.gap = "12px";

  const title = document.createElement("div");
  title.textContent = `GM ${cmd} (0–127)`;
  title.style.fontWeight = "600";
  head.appendChild(title);

  const hint = document.createElement("div");
  hint.textContent = "Type to filter · Enter=insert · Esc=close";
  hint.style.opacity = "0.65";
  hint.style.fontSize = "12px";
  head.appendChild(hint);
  pop.appendChild(head);
  if (typeof enableDraggableFixedPopover === "function") enableDraggableFixedPopover(pop, head);

  const body = document.createElement("div");
  body.style.marginTop = "6px";
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

export {
  openMidiProgramPickerAtCursor,
};
