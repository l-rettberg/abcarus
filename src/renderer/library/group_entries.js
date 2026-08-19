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

function getGroupLabel(mode) {
  if (GROUP_LABELS[mode]) return GROUP_LABELS[mode];
  const value = String(mode || "").replace(/[_-]+/g, " ").trim();
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Group";
}

function getEditableCategory(mode, value, tune, isUnknown) {
  if (isUnknown) return null;
  if (mode === "composer") return { categoryType: "field:C", field: "C", value };
  if (mode === "group" && !/^\[[A-Za-z][A-Za-z0-9_-]*\]\s*\S/.test(value)) {
    return { categoryType: "field:G", field: "G", value };
  }
  if (Object.prototype.hasOwnProperty.call(tune.catalogFacets || {}, mode)) {
    return { categoryType: `facet:${mode}`, facet: mode, value };
  }
  return null;
}

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
  if (mode === "composer") {
    const values = Array.isArray(tune.composers) && tune.composers.length
      ? tune.composers
      : [tune.composer || ""];
    return Array.from(new Set(values.filter(Boolean)));
  }
  if (Object.prototype.hasOwnProperty.call(tune.catalogFacets || {}, mode)) {
    const values = tune.catalogFacets[mode];
    return Array.from(new Set((Array.isArray(values) ? values : [values]).filter(Boolean)));
  }
  const fieldByMode = {
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
        const category = getEditableCategory(mode, value, tune, !values.length);
        if (!entries.has(groupId)) {
          entries.set(groupId, {
            id: groupId,
            label: `${getGroupLabel(mode)}: ${value}`,
            tunes: [],
            isFile: false,
            ...(category || {}),
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
  getGroupLabel,
  getGroupValue,
  getGroupValues,
};
