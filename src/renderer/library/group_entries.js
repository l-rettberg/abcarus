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
  makam: "Makam",
  form: "Form",
  repertoire: "Repertoire",
  cultural: "Cultural",
  period: "Period",
};

function getGroupValues(tune, mode, { normalizeTitleKey = null } = {}) {
  if (!tune) return [];
  if (mode === "x") return [tune.xNumber || ""];
  if (mode === "titlekey") {
    const normalize = typeof normalizeTitleKey === "function" ? normalizeTitleKey : (value) => String(value || "");
    return [normalize(tune.title || tune.preview || "", 25)];
  }
  if (mode === "group") {
    const values = Array.isArray(tune.groups) ? tune.groups : [tune.group || ""];
    return Array.from(new Set(values.filter(Boolean)));
  }
  if (Object.prototype.hasOwnProperty.call(tune.catalogFacets || {}, mode)) {
    const values = tune.catalogFacets[mode];
    return Array.from(new Set((Array.isArray(values) ? values : [values]).filter(Boolean)));
  }
  const fieldByMode = {
    composer: "composer",
    meter: "meter",
    key: "key",
    unit: "unitLength",
    tempo: "tempo",
    rhythm: "rhythm",
    source: "source",
    origin: "origin",
  };
  const field = fieldByMode[mode];
  return field ? [tune[field] || ""] : [];
}

function getGroupValue(tune, mode, options = {}) {
  return getGroupValues(tune, mode, options)[0] || "";
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
      const values = getGroupValues(tune, mode, options).filter(Boolean);
      for (const value of values.length ? values : ["Unknown"]) {
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
  }
  return Array.from(entries.values());
}

export {
  GROUP_LABELS,
  buildGroupEntries,
  getGroupValue,
  getGroupValues,
};
