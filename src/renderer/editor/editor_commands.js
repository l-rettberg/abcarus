import {
  EditorSelection,
  EditorView,
  indentUnit,
  openSearchPanel,
} from "../../../third_party/codemirror/cm.js";

function scrollEditorToPos(view, pos, { y = "start" } = {}) {
  if (!view) return;
  const docLen = view.state.doc.length;
  const safePos = Math.max(0, Math.min(Number(pos) || 0, docLen));
  const effects = [];
  if (typeof EditorView.scrollIntoView === "function") {
    try {
      effects.push(EditorView.scrollIntoView(safePos, { y }));
    } catch {}
  }
  view.dispatch({
    selection: EditorSelection.cursor(safePos),
    effects,
    scrollIntoView: true,
  });
  if (typeof view.lineBlockAt !== "function" || !view.scrollDOM) return;
  const applyManualScroll = () => {
    try {
      const block = view.lineBlockAt(safePos);
      if (!block || !Number.isFinite(Number(block.top))) return;
      view.scrollDOM.scrollTop = Math.max(0, Number(block.top) - 8);
    } catch {}
  };
  if (typeof view.requestMeasure === "function") {
    try {
      view.requestMeasure({
        read: () => view.lineBlockAt(safePos),
        write: (block) => {
          if (!block || !Number.isFinite(Number(block.top))) return;
          view.scrollDOM.scrollTop = Math.max(0, Number(block.top) - 8);
        },
      });
      return;
    } catch {}
  }
  applyManualScroll();
}

function openFindPanel(view) {
  openSearchPanel(view);
  applySearchPanelHints(view);
  return true;
}

function openReplacePanel(view) {
  openSearchPanel(view);
  applySearchPanelHints(view);
  setTimeout(() => {
    const panel = view.dom.querySelector(".cm-search");
    if (!panel) return;
    const replace = panel.querySelector("input[name='replace']");
    if (replace) {
      replace.focus();
      replace.select();
    }
  }, 0);
  return true;
}

function getSelectedLines(state) {
  const lines = [];
  const seen = new Set();
  for (const range of state.selection.ranges) {
    const fromLine = state.doc.lineAt(range.from);
    const toLine = state.doc.lineAt(range.to);
    const last = (range.to === toLine.from && range.to > range.from)
      ? Math.max(fromLine.number, toLine.number - 1)
      : toLine.number;
    for (let lineNo = fromLine.number; lineNo <= last; lineNo += 1) {
      const line = state.doc.line(lineNo);
      if (seen.has(line.from)) continue;
      seen.add(line.from);
      lines.push(line);
    }
  }
  return lines;
}

function indentSelectionMore(view) {
  if (view.state.readOnly) return false;
  const unit = view.state.facet(indentUnit);
  const changes = getSelectedLines(view.state).map((line) => ({
    from: line.from,
    insert: unit,
  }));
  if (!changes.length) return false;
  view.dispatch({ changes, userEvent: "input.indent" });
  return true;
}

function indentSelectionLess(view) {
  if (view.state.readOnly) return false;
  const unit = view.state.facet(indentUnit);
  const unitSize = unit.length;
  const changes = [];
  for (const line of getSelectedLines(view.state)) {
    const match = /^[\t ]+/.exec(line.text);
    if (!match) continue;
    const prefix = match[0];
    let remove = 0;
    if (prefix.startsWith("\t")) remove = 1;
    else remove = Math.min(prefix.length, unitSize);
    if (remove > 0) {
      changes.push({ from: line.from, to: line.from + remove, insert: "" });
    }
  }
  if (!changes.length) return false;
  view.dispatch({ changes, userEvent: "delete.dedent" });
  return true;
}

function foldBeginTextBlocks(state, lineStart) {
  const line = state.doc.lineAt(lineStart);
  if (!/^%%\s*begintext\b/i.test(line.text)) return null;
  for (let i = line.number + 1; i <= state.doc.lines; i += 1) {
    const next = state.doc.line(i);
    if (/^%%\s*endtext\b/i.test(next.text)) {
      return { from: line.to, to: next.from };
    }
  }
  return null;
}

function isInBeginTextBlockAtLine(state, lineNumber) {
  const n = Math.max(1, Math.min(state.doc.lines, Number(lineNumber) || 1));
  for (let i = n; i >= 1; i -= 1) {
    const text = String(state.doc.line(i).text || "");
    if (/^%%\s*endtext\b/i.test(text)) return false;
    if (/^%%\s*begintext\b/i.test(text)) return true;
  }
  return false;
}

function moveLineSelection(view, delta) {
  const { state } = view;
  const ranges = [];
  for (const range of state.selection.ranges) {
    const line = state.doc.lineAt(range.head);
    const targetLineNumber = Math.max(1, Math.min(state.doc.lines, line.number + delta));
    const targetLine = state.doc.line(targetLineNumber);
    const col = range.head - line.from;
    const pos = Math.min(targetLine.to, targetLine.from + col);
    ranges.push(EditorSelection.cursor(pos));
  }
  view.dispatch({ selection: EditorSelection.create(ranges), scrollIntoView: true });
  return true;
}

function initSearchPanelShortcuts(documentRef = document) {
  const findButtonByLabel = (panel, label) => {
    if (!panel) return null;
    const buttons = Array.from(panel.querySelectorAll("button"));
    const want = String(label || "").trim().toLowerCase();
    return buttons.find((btn) => String(btn.textContent || "").trim().toLowerCase() === want) || null;
  };

  const triggerPanelAction = (panel, action) => {
    const btn = findButtonByLabel(panel, action);
    if (!btn) return false;
    btn.click();
    return true;
  };

  documentRef.addEventListener("keydown", (e) => {
    const activeEl = documentRef.activeElement;
    const panel = activeEl && activeEl.closest ? activeEl.closest(".cm-search") : null;
    if (!panel) return;

    const key = e.key;
    const isEnter = key === "Enter";
    const isF3 = key === "F3";
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    const alt = e.altKey;

    if (isEnter && !ctrl && !alt) {
      e.preventDefault();
      e.stopPropagation();
      triggerPanelAction(panel, shift ? "previous" : "next");
      return;
    }

    if (isF3 && !ctrl && !alt) {
      e.preventDefault();
      e.stopPropagation();
      triggerPanelAction(panel, shift ? "previous" : "next");
      return;
    }

    if (isEnter && ctrl && !alt && !shift) {
      e.preventDefault();
      e.stopPropagation();
      triggerPanelAction(panel, "replace");
      return;
    }

    if (isEnter && ((ctrl && shift) || alt)) {
      e.preventDefault();
      e.stopPropagation();
      triggerPanelAction(panel, "replace all");
    }
  }, true);
}

function applySearchPanelHints(view) {
  if (!view) return;
  setTimeout(() => {
    const panel = view.dom.querySelector(".cm-search");
    if (!panel) return;
    try {
      const next = panel.querySelector("button[name='next']");
      if (next) next.title = "Next (Enter / F3)";
      const prev = panel.querySelector("button[name='prev']");
      if (prev) prev.title = "Previous (Shift+Enter / Shift+F3)";
      const all = panel.querySelector("button[name='select']");
      if (all) all.title = "Select all matches";
      const replaceBtn = panel.querySelector("button[name='replace']");
      if (replaceBtn) replaceBtn.title = "Replace (Ctrl+Enter)";
      const replaceAllBtn = panel.querySelector("button[name='replaceAll']");
      if (replaceAllBtn) replaceAllBtn.title = "Replace all (Ctrl+Shift+Enter / Alt+Enter)";
    } catch {}
    try {
      wireSearchPanelHotkeys(panel);
    } catch {}
  }, 0);
}

function wireSearchPanelHotkeys(panel) {
  if (!panel || !panel.dataset) return;
  if (panel.dataset.abcarusHotkeys === "1") return;
  panel.dataset.abcarusHotkeys = "1";

  const clickNamed = (name) => {
    const btn = panel.querySelector(`button[name='${name}']`);
    if (!btn || btn.disabled) return false;
    btn.click();
    return true;
  };

  panel.addEventListener("keydown", (ev) => {
    if (!ev) return;
    const key = String(ev.key || "");

    if (key === "F3") {
      if (ev.shiftKey) {
        if (clickNamed("prev")) ev.preventDefault();
      } else if (clickNamed("next")) {
        ev.preventDefault();
      }
      return;
    }

    if (key !== "Enter") return;
    const hasCtrl = Boolean(ev.ctrlKey || ev.metaKey);

    if (!hasCtrl && !ev.altKey) {
      if (ev.shiftKey) {
        if (clickNamed("prev")) ev.preventDefault();
      } else if (clickNamed("next")) {
        ev.preventDefault();
      }
      return;
    }

    if (hasCtrl || ev.altKey) {
      if (ev.shiftKey || ev.altKey) {
        if (clickNamed("replaceAll")) ev.preventDefault();
      } else if (clickNamed("replace")) {
        ev.preventDefault();
      }
    }
  }, true);
}

export {
  foldBeginTextBlocks,
  indentSelectionLess,
  indentSelectionMore,
  initSearchPanelShortcuts,
  isInBeginTextBlockAtLine,
  moveLineSelection,
  openFindPanel,
  openReplacePanel,
  scrollEditorToPos,
};
