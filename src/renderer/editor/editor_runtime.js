import {
  gotoLine,
} from "../../../third_party/codemirror/cm.js";
import {
  insertTextAtEditorSelection,
  openFindPanel,
  openReplacePanel,
  scrollEditorToPos,
  setEditorSelectionAt,
  setEditorSelectionAtLineCol,
  setEditorSelectionRange,
} from "./editor_commands.js";
import { createMainEditorFeature } from "./main_editor_feature.js";

export function createEditorRuntime({
  logError = (...args) => console.error(...args),
  createFeature = createMainEditorFeature,
} = {}) {
  let feature = null;
  let view = null;
  let dirtySuppressed = false;

  function getView() {
    return view;
  }

  function hasView() {
    return Boolean(view);
  }

  function init(options = {}) {
    if (view || !options.host) return view;
    feature = createFeature(options);
    view = feature.init();
    return view;
  }

  function isDirtySuppressed() {
    return dirtySuppressed;
  }

  function setDirtySuppressed(value) {
    dirtySuppressed = Boolean(value);
  }

  function withDirtySuppressed(action) {
    const previous = dirtySuppressed;
    dirtySuppressed = true;
    try {
      return action();
    } finally {
      dirtySuppressed = previous;
    }
  }

  function getText() {
    return view ? view.state.doc.toString() : "";
  }

  function setText(text) {
    if (!view) return false;
    if (text != null && typeof text !== "string") {
      logError(
        "[abcarus] editorRuntime.setText received non-string; dropped:",
        Object.prototype.toString.call(text),
      );
      return false;
    }
    const doc = view.state.doc;
    view.dispatch({
      changes: { from: 0, to: doc.length, insert: text || "" },
    });
    return true;
  }

  function setTextClean(text) {
    return withDirtySuppressed(() => setText(text));
  }

  function getSelection() {
    return view ? view.state.selection : null;
  }

  function refresh() {
    if (!view) return false;
    view.dispatch({ selection: view.state.selection, scrollIntoView: false });
    return true;
  }

  function resetSelectionToStart() {
    if (!view) return false;
    try {
      view.dispatch({ selection: { anchor: 0, head: 0 }, scrollIntoView: false });
      return true;
    } catch {
      return false;
    }
  }

  function getFocusedView(headerView, activeElement = null) {
    if (headerView && headerView.dom && activeElement && headerView.dom.contains(activeElement)) {
      return headerView;
    }
    if (view && view.dom && activeElement && view.dom.contains(activeElement)) return view;
    return view || headerView || null;
  }

  function getIndexFromLoc(loc) {
    if (!view || !loc) return null;
    const line = Math.max(1, Math.min(loc.line, view.state.doc.lines));
    const lineInfo = view.state.doc.line(line);
    const col = Math.max(1, loc.col || 1);
    return Math.min(lineInfo.to, lineInfo.from + col - 1);
  }

  return {
    clearPendingRender: () => feature && feature.clearPendingRender(),
    getDom: () => view ? view.dom : null,
    getFocusedView,
    getIndexFromLoc,
    getLength: () => view ? view.state.doc.length : 0,
    getScroll: () => view && view.scrollDOM ? view.scrollDOM.scrollTop : 0,
    getSelection,
    getText,
    getView,
    gotoLine: () => view ? gotoLine(view) : false,
    hasView,
    init,
    insertTextAtSelection: (text) => insertTextAtEditorSelection(view, text),
    isDirtySuppressed,
    openFind: () => view ? openFindPanel(view) : false,
    openReplace: () => view ? openReplacePanel(view) : false,
    refresh,
    refreshCursorStatus: () => feature && feature.refreshCursorStatus(),
    resetSelectionToStart,
    scrollToPos: (pos, options = {}) => scrollEditorToPos(view, pos, options),
    setDirtySuppressed,
    setPendingPlaybackRangeOrigin: (origin) => (
      feature && feature.setPendingPlaybackRangeOrigin(origin)
    ),
    setScroll(value) {
      if (view && view.scrollDOM) view.scrollDOM.scrollTop = value;
    },
    setSelectionAt: (idx, options = {}) => setEditorSelectionAt(view, idx, options),
    setSelectionAtLineCol: (line, col, options = {}) => (
      setEditorSelectionAtLineCol(view, line, col, options)
    ),
    setSelectionRange: (start, end, options = {}) => (
      setEditorSelectionRange(view, start, end, options)
    ),
    setSuppressPlaybackRangeSelectionSync: (value) => (
      feature && feature.setSuppressPlaybackRangeSelectionSync(value)
    ),
    setText,
    setTextClean,
    withDirtySuppressed,
  };
}
