const GROUP_LABELS = {
  file: "File",
  x: "X",
  titlekey: "T",
  composer: "C",
  meter: "M",
  key: "K",
  unit: "L",
  tempo: "Q",
  rhythm: "R",
  source: "S",
  origin: "O",
  group: "G",
};

function getGroupValue(tune, mode, { normalizeTitleKey = null } = {}) {
  if (!tune) return "";
  if (mode === "x") return tune.xNumber || "";
  if (mode === "titlekey") {
    const normalize = typeof normalizeTitleKey === "function" ? normalizeTitleKey : (value) => String(value || "");
    return normalize(tune.title || tune.preview || "", 25);
  }
  if (mode === "composer") return tune.composer || "";
  if (mode === "meter") return tune.meter || "";
  if (mode === "key") return tune.key || "";
  if (mode === "unit") return tune.unitLength || "";
  if (mode === "tempo") return tune.tempo || "";
  if (mode === "rhythm") return tune.rhythm || "";
  if (mode === "source") return tune.source || "";
  if (mode === "origin") return tune.origin || "";
  if (mode === "group") return tune.group || "";
  return "";
}

function buildGroupEntries(files, mode, options = {}) {
  if (mode === "file") {
    return files.map((file) => ({
      id: file.path,
      label: file.basename,
      tunes: Array.isArray(file.tunes) ? file.tunes : [],
      tuneCount: Number.isFinite(file.tuneCount) ? file.tuneCount : undefined,
      xIssues: file && file.xIssues ? file.xIssues : undefined,
      isFile: true,
      updatedAtMs: file.updatedAtMs || 0,
    }));
  }

  const entries = new Map();
  for (const file of files) {
    const tunes = Array.isArray(file.tunes) ? file.tunes : [];
    for (const tune of tunes) {
      const value = getGroupValue(tune, mode, options) || "Unknown";
      const groupId = `${mode}:${value}`;
      if (!entries.has(groupId)) {
        entries.set(groupId, {
          id: groupId,
          label: `${GROUP_LABELS[mode]}: ${value}`,
          tunes: [],
          isFile: false,
          updatedAtMs: 0,
        });
      }
      entries.get(groupId).tunes.push({
        ...tune,
        __fileUpdatedAtMs: file.updatedAtMs || 0,
        filePath: file.path || "",
      });
      const updatedAtMs = file.updatedAtMs || 0;
      const entry = entries.get(groupId);
      if (updatedAtMs > (entry.updatedAtMs || 0)) entry.updatedAtMs = updatedAtMs;
    }
  }
  return Array.from(entries.values());
}

export {
  GROUP_LABELS,
  buildGroupEntries,
  getGroupValue,
};
