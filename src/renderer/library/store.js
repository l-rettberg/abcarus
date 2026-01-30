export function createLibraryViewStore({ getIndex, safeBasename }) {
  let modalRowsCache = null;
  let modalRowsCacheRoot = "";

  function normalizeTitleKey(raw) {
    const input = String(raw || "");
    if (!input.trim()) return "";
    const strict = Boolean(window && window.__abcarusLibraryTitleKeyStrict);
    const maxLenRaw = window && Number.isFinite(Number(window.__abcarusLibraryTitleKeyLength))
      ? Math.round(Number(window.__abcarusLibraryTitleKeyLength))
      : 25;
    const maxLen = maxLenRaw > 0 ? maxLenRaw : 25;
    if (strict) {
      const cleaned = input.replace(/\s+/g, " ").trim();
      if (maxLen > 0 && cleaned.length > maxLen) return cleaned.slice(0, maxLen);
      return cleaned;
    }
    let normalized = "";
    try {
      normalized = input.normalize("NFKD");
    } catch {
      normalized = input;
    }
    try {
      normalized = normalized.replace(/\p{M}+/gu, "");
    } catch {
      normalized = normalized.replace(/[\u0300-\u036f]+/g, "");
    }
    normalized = normalized.toLowerCase();
    normalized = normalized
      .replace(/[’‘ʻʼ´`]/g, "'")
      .replace(/[‐-‒–—―]/g, "-")
      .replace(/[。．｡․·•∙⋅]/g, ".")
      .replace(/ı/g, "i");
    try {
      normalized = normalized.replace(/[^0-9a-z\u00c0-\u024f\u0370-\u03ff\u1f00-\u1fff\u0400-\u04ff\u0530-\u058f\u0590-\u05ff\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\u10a0-\u10ff\u2d00-\u2d2f\uFB50-\uFDFF\uFE70-\uFEFF]+/giu, " ");
    } catch {
      normalized = normalized.replace(/[^0-9a-z]+/gi, " ");
    }
    normalized = normalized.replace(/\s+/g, " ").trim();
    if (!normalized) return "";
    if (maxLen > 0 && normalized.length > maxLen) return normalized.slice(0, maxLen);
    return normalized;
  }

  function invalidate() {
    modalRowsCache = null;
    modalRowsCacheRoot = "";
  }

  function buildModalRows(index) {
    const normalize = (v) => String(v == null ? "" : v).trim();
    const pad2 = (n) => String(n).padStart(2, "0");
    const formatYmd = (ms) => {
      const d = new Date(ms);
      if (!Number.isFinite(d.getTime())) return "";
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    };

    const rows = [];
    for (const file of index.files || []) {
      const modified = file && file.updatedAtMs ? formatYmd(file.updatedAtMs) : "";
      const filePath = file && file.path ? file.path : "";
      const fileLabel = file && file.basename ? file.basename : safeBasename(filePath);
      const tunes = file && Array.isArray(file.tunes) ? file.tunes : [];
      for (const tune of tunes) {
        const xNumber = tune && tune.xNumber != null ? tune.xNumber : "";
        const title = tune && (tune.title || tune.preview) ? (tune.title || tune.preview) : "";
        const titleKey = normalizeTitleKey(title);
        const composer = tune && tune.composer ? tune.composer : "";
        const origin = tune && tune.origin ? tune.origin : "";
        const group = tune && tune.group ? tune.group : "";
        const key = tune && tune.key ? tune.key : "";
        const meter = tune && tune.meter ? tune.meter : "";
        const tempo = tune && tune.tempo ? tune.tempo : "";
        const rhythm = tune && tune.rhythm ? tune.rhythm : "";
        const searchText = `${normalize(fileLabel)} ${normalize(xNumber)} ${normalize(title)} ${normalize(titleKey)} ${normalize(composer)} ${normalize(key)} ${normalize(meter)} ${normalize(tempo)} ${normalize(rhythm)} ${normalize(origin)} ${normalize(group)} ${normalize(modified)}`.toLowerCase();
        rows.push({
          file: fileLabel,
          filePath,
          tuneId: tune && tune.id ? tune.id : "",
          tuneNo: xNumber,
          xNumber,
          title,
          composer,
          origin,
          group,
          key,
          meter,
          tempo,
          rhythm,
          modified,
          searchText,
        });
      }
    }
    return rows;
  }

  function getModalRows() {
    const index = typeof getIndex === "function" ? getIndex() : null;
    if (!index || !index.root || !Array.isArray(index.files) || !index.files.length) return [];
    const cacheEnabled = Boolean(window && window.__abcarusLibraryCacheEnabled);
    if (cacheEnabled && modalRowsCache && modalRowsCacheRoot === index.root) return modalRowsCache;
    modalRowsCache = buildModalRows(index);
    modalRowsCacheRoot = index.root;
    return modalRowsCache;
  }

  return {
    invalidate,
    getModalRows,
  };
}
