function normalizeMakamKey(name) {
  const raw = String(name || "").trim();
  if (!raw) return "";
  const base = raw
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ");
  const map = {
    "ç": "c",
    "ğ": "g",
    "ı": "i",
    "ş": "s",
    "ö": "o",
    "ü": "u",
    "â": "a",
    "î": "i",
    "û": "u",
  };
  return base
    .split("")
    .map((ch) => (map[ch] ? map[ch] : ch))
    .join("")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

function extractEntriesFromMakamDnaPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return null;
  if (Array.isArray(payload.entries)) return payload.entries;
  if (payload.rawTable && Array.isArray(payload.rawTable.entries)) return payload.rawTable.entries;
  return null;
}

function parseMakamDnaText(text) {
  const raw = String(text || "").trim();
  if (!raw) return { ok: false, error: "Empty JSON." };
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : "Invalid JSON." };
  }
  const entries = extractEntriesFromMakamDnaPayload(parsed);
  if (!Array.isArray(entries)) return { ok: false, error: "Expected an array (or an object with entries/rawTable.entries)." };
  const cleaned = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const makam = String(entry.makam || "").trim();
    if (!makam) continue;
    cleaned.push(entry);
  }
  if (!cleaned.length) return { ok: false, error: "No valid entries (each entry must include a non-empty makam)." };
  return { ok: true, entries: cleaned };
}

function formatMakamDnaForEditor(entries) {
  const today = new Date();
  const iso = Number.isFinite(today.getTime()) ? today.toISOString().slice(0, 10) : "";
  const wrapper = {
    schemaVersion: 1,
    updatedAt: iso || "",
    rawTable: {
      note: "User-edited dataset (local). Entries are used by Intonation Explorer for makam overlays/labels.",
      entries: Array.isArray(entries) ? entries : [],
    },
  };
  return JSON.stringify(wrapper, null, 2);
}

function createMakamDnaStore({ api = null, onError = () => {} } = {}) {
  let activeEntries = [];
  let activeUserText = "";
  let loaded = false;
  let builtinPromise = null;
  let nameIndex = { idx: new Map(), sorted: [] };

  const getEntries = () => Array.isArray(activeEntries) ? activeEntries : [];

  const rebuildNameIndex = () => {
    const names = getEntries()
      .map((e) => String(e && e.makam ? e.makam : "").trim())
      .filter(Boolean);
    const sorted = names
      .slice()
      .sort((a, b) => normalizeMakamKey(b).length - normalizeMakamKey(a).length);
    const idx = new Map();
    for (const name of sorted) {
      const key = normalizeMakamKey(name);
      if (!key) continue;
      if (!idx.has(key)) idx.set(key, name);
    }
    nameIndex = { idx, sorted };
  };

  const getBuiltinEntries = async () => {
    if (builtinPromise) return builtinPromise;
    builtinPromise = import("../../makam_dna/makam_dna.mjs")
      .then((mod) => (Array.isArray(mod.BUILTIN_MAKAM_DNA) ? mod.BUILTIN_MAKAM_DNA : []))
      .catch(() => []);
    return builtinPromise;
  };

  const ensureLoaded = async () => {
    if (loaded) return;
    loaded = true;
    activeEntries = await getBuiltinEntries();
    rebuildNameIndex();
    if (!api || typeof api.getMakamDnaUser !== "function") return;
    try {
      const res = await api.getMakamDnaUser();
      if (!res || !res.ok || !res.text) return;
      const parsed = parseMakamDnaText(String(res.text || ""));
      if (!parsed.ok) return;
      activeEntries = parsed.entries;
      activeUserText = String(res.text || "");
      rebuildNameIndex();
    } catch (e) {
      onError(e);
    }
  };

  const applyUserText = (text) => {
    const parsed = parseMakamDnaText(text);
    if (!parsed.ok) return { ok: false, error: parsed.error || "Invalid Makam DNA." };
    activeEntries = parsed.entries;
    activeUserText = String(text || "");
    rebuildNameIndex();
    return { ok: true };
  };

  const resetBuiltin = async () => {
    activeEntries = await getBuiltinEntries();
    activeUserText = "";
    loaded = true;
    rebuildNameIndex();
    return formatMakamDnaForEditor(getEntries());
  };

  const getInitialEditorText = () => (
    activeUserText && activeUserText.trim()
      ? activeUserText
      : formatMakamDnaForEditor(getEntries())
  );

  const detectFromTuneText = (tuneText) => {
    const text = String(tuneText || "");
    if (!text.trim()) return "";
    const mT = text.match(/(?:^|\n)T:\s*([^\r\n]+)/);
    const mR = text.match(/(?:^|\n)R:\s*([^\r\n]+)/);
    const hay = normalizeMakamKey([mR ? mR[1] : "", mT ? mT[1] : ""].filter(Boolean).join(" "));
    if (!hay) return "";
    for (const name of nameIndex.sorted) {
      const key = normalizeMakamKey(name);
      if (!key) continue;
      if (hay.includes(key)) return name;
    }
    return "";
  };

  const getEntry = (name) => {
    const target = String(name || "").trim().toLowerCase();
    if (!target) return null;
    return getEntries().find((e) => String(e.makam || "").trim().toLowerCase() === target) || null;
  };

  rebuildNameIndex();

  return {
    applyUserText,
    detectFromTuneText,
    ensureLoaded,
    formatForEditor: formatMakamDnaForEditor,
    getBuiltinEntries,
    getEntries,
    getEntry,
    getInitialEditorText,
    parseText: parseMakamDnaText,
    rebuildNameIndex,
    resetBuiltin,
  };
}

export {
  createMakamDnaStore,
  formatMakamDnaForEditor,
  normalizeMakamKey,
  parseMakamDnaText,
};
