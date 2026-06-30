const DEFAULT_SET_LIST_HEADER_TEXT = "%%stretchlast 1\n";
const MAX_SET_LIST_ITEMS = 500;

function normalizeSetListPageBreaks(value, fallback = "perTune") {
  const mode = String(value || "").trim();
  if (mode === "perTune" || mode === "none" || mode === "auto") return mode;
  return fallback;
}

function createSetListItemId({ now = Date.now, random = Math.random } = {}) {
  const time = typeof now === "function" ? now() : Date.now();
  const rnd = typeof random === "function" ? random() : Math.random();
  return `${time}::${rnd.toString(16).slice(2)}`;
}

function normalizeSetListItem(item, options = {}) {
  if (!item || typeof item !== "object") return null;
  const text = typeof item.text === "string" ? item.text : "";
  if (!text.trim()) return null;
  const nowValue = typeof options.now === "function" ? options.now() : Date.now();
  const id = typeof item.id === "string" && item.id
    ? item.id
    : createSetListItemId(options);
  return {
    id,
    sourceTuneId: typeof item.sourceTuneId === "string" ? item.sourceTuneId : "",
    sourcePath: typeof item.sourcePath === "string" ? item.sourcePath : "",
    xNumber: typeof item.xNumber === "string" ? item.xNumber : "",
    title: typeof item.title === "string" ? item.title : "",
    composer: typeof item.composer === "string" ? item.composer : "",
    headerText: typeof item.headerText === "string" ? item.headerText : "",
    text,
    addedAtMs: Number.isFinite(Number(item.addedAtMs)) ? Number(item.addedAtMs) : nowValue,
  };
}

function parseSetListSavedState(saved, options = {}) {
  if (!saved || typeof saved !== "object") return null;
  const version = saved && saved.version ? String(saved.version) : "";
  if (version !== "1") return null;

  const itemsRaw = Array.isArray(saved.items) ? saved.items : [];
  const items = [];
  for (const item of itemsRaw) {
    const normalized = normalizeSetListItem(item, options);
    if (!normalized) continue;
    items.push(normalized);
    if (items.length >= MAX_SET_LIST_ITEMS) break;
  }

  return {
    pageBreaks: normalizeSetListPageBreaks(saved.pageBreaks, "perTune"),
    compact: Boolean(saved.compact),
    headerText: typeof saved.headerText === "string" ? saved.headerText : DEFAULT_SET_LIST_HEADER_TEXT,
    items,
  };
}

function serializeSetListState({
  items,
  pageBreaks = "perTune",
  compact = false,
  headerText = DEFAULT_SET_LIST_HEADER_TEXT,
  now = Date.now,
} = {}) {
  const nowValue = typeof now === "function" ? now() : Date.now();
  return {
    version: "1",
    savedAtMs: nowValue,
    pageBreaks: normalizeSetListPageBreaks(pageBreaks, "perTune"),
    compact: !!compact,
    headerText: String(headerText || ""),
    items: Array.isArray(items) ? items.map((item) => ({
      id: item && item.id ? String(item.id) : "",
      sourceTuneId: item && item.sourceTuneId ? String(item.sourceTuneId) : "",
      sourcePath: item && item.sourcePath ? String(item.sourcePath) : "",
      xNumber: item && item.xNumber ? String(item.xNumber) : "",
      title: item && item.title ? String(item.title) : "",
      composer: item && item.composer ? String(item.composer) : "",
      headerText: item && item.headerText ? String(item.headerText) : "",
      text: item && item.text ? String(item.text) : "",
      addedAtMs: item && Number.isFinite(Number(item.addedAtMs)) ? Number(item.addedAtMs) : nowValue,
    })) : [],
  };
}

function moveSetListItems(items, fromIndex, toIndex) {
  const source = Array.isArray(items) ? items : [];
  const from = Number(fromIndex);
  const to = Number(toIndex);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return source;
  if (from < 0 || from >= source.length) return source;
  if (to < 0 || to >= source.length) return source;
  if (from === to) return source;
  const next = source.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function removeSetListItemAt(items, index) {
  const source = Array.isArray(items) ? items : [];
  const idx = Number(index);
  if (!Number.isFinite(idx) || idx < 0 || idx >= source.length) return source;
  const next = source.slice();
  next.splice(idx, 1);
  return next;
}

function insertSetListItemAt(items, item, index) {
  const source = Array.isArray(items) ? items : [];
  if (!item) return source;
  const idx = Number(index);
  const next = source.slice();
  if (!Number.isFinite(idx) || idx < 0 || idx >= next.length) {
    next.push(item);
  } else {
    next.splice(idx, 0, item);
  }
  return next;
}

export {
  DEFAULT_SET_LIST_HEADER_TEXT,
  insertSetListItemAt,
  moveSetListItems,
  normalizeSetListItem,
  normalizeSetListPageBreaks,
  parseSetListSavedState,
  removeSetListItemAt,
  serializeSetListState,
};
