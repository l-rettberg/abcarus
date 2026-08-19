const SYSTEM_UI_FONT_FAMILY = "system-ui, -apple-system, \"Segoe UI\", Roboto, Ubuntu, Cantarell, \"Noto Sans\", sans-serif";
const LEGACY_EDITOR_FONT_FAMILY = "\"ABCarus Noto Sans Mono\", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const INTERFACE_FONT_PRESETS = Object.freeze([
  { label: "System default", value: SYSTEM_UI_FONT_FAMILY },
  { label: "Sans serif", value: "Arial, Helvetica, sans-serif" },
  { label: "Serif", value: "Georgia, \"Times New Roman\", serif" },
  { label: "Monospace", value: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" },
]);

function safeBasename(value) {
  const normalized = String(value || "").replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || normalized;
}

function isSoundfontPath(value) {
  const path = String(value || "");
  return path.startsWith("file://") || /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith("/");
}

function toFileUrl(filePath) {
  const raw = String(filePath || "");
  if (!raw) return "";
  const normalized = raw.replace(/\\/g, "/");
  if (/^[a-zA-Z]:\\/.test(raw)) return encodeURI(`file:///${normalized}`);
  if (normalized.startsWith("/")) return encodeURI(`file://${normalized}`);
  return encodeURI(`file://${normalized}`);
}

function getCatalogUserFontFiles(fontLists = {}) {
  const refs = [
    ...(Array.isArray(fontLists.notation) ? fontLists.notation : []),
    ...(Array.isArray(fontLists.text) ? fontLists.text : []),
  ];
  const files = [];
  const seen = new Set();
  for (const ref of refs) {
    const match = String(ref || "").match(/^user:(.+)$/);
    const fileName = match ? String(match[1] || "").trim() : "";
    if (!fileName || seen.has(fileName)) continue;
    seen.add(fileName);
    files.push(fileName);
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function interfaceFontFamilyForFile(fileName, defaultFamily = SYSTEM_UI_FONT_FAMILY) {
  const safe = String(fileName || "").trim();
  const fallback = String(defaultFamily || SYSTEM_UI_FONT_FAMILY);
  return safe ? `\"ABCarus User Font: ${safe}\", ${fallback}` : fallback;
}

function userFontFileFromFamily(value) {
  const match = String(value || "").match(/ABCarus User Font: ([^\"]+)/);
  return match ? String(match[1] || "").trim() : "";
}

function buildInterfaceFontOptions({ selected = "", userFontFiles = [], defaultFamily = SYSTEM_UI_FONT_FAMILY } = {}) {
  const options = INTERFACE_FONT_PRESETS.map((preset, index) => ({
    label: preset.label,
    value: index === 0 ? String(defaultFamily || preset.value) : preset.value,
  }));
  for (const fileName of userFontFiles) {
    options.push({
      label: `${safeBasename(fileName).replace(/\.(otf|ttf|woff2?)$/i, "")} (added)`,
      value: interfaceFontFamilyForFile(fileName, defaultFamily),
    });
  }
  const current = String(selected || defaultFamily || SYSTEM_UI_FONT_FAMILY);
  if (current && !options.some((option) => option.value === current)) {
    options.push({ label: "Custom (current)", value: current });
  }
  return { options, selected: current };
}

function createInterfaceFontControl({
  documentRef,
  entry,
  selected,
  defaultFamily,
  getUserFontFiles = () => [],
  onChange = () => {},
  onAdd = async () => "",
  onRemove = async () => false,
} = {}) {
  const select = documentRef.createElement("select");
  select.dataset.settingsKey = String(entry && entry.key ? entry.key : "");
  if (entry && entry.help) select.title = String(entry.help);
  const refresh = (nextSelected = select.value || selected) => {
    const model = buildInterfaceFontOptions({
      selected: nextSelected,
      userFontFiles: getUserFontFiles(),
      defaultFamily,
    });
    select.textContent = "";
    for (const item of model.options) {
      const option = documentRef.createElement("option");
      option.value = item.value;
      option.textContent = item.label;
      select.appendChild(option);
    }
    select.value = model.selected;
  };
  refresh(selected);

  const wrap = documentRef.createElement("div");
  wrap.className = "settings-select-row";
  wrap.appendChild(select);

  const addButton = documentRef.createElement("button");
  addButton.type = "button";
  addButton.textContent = "Add…";
  addButton.title = "Copy a font into ABCarus and add it to the Interface and Library font lists.";

  const removeButton = documentRef.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  const updateRemoveEnabled = () => {
    const fileName = userFontFileFromFamily(select.value);
    const canRemove = Boolean(fileName && getUserFontFiles().includes(fileName));
    removeButton.disabled = !canRemove;
    removeButton.title = canRemove
      ? "Delete the ABCarus-installed copy. The original external font file will not be touched."
      : "Select a font added to ABCarus to remove it.";
  };

  select.addEventListener("change", () => {
    updateRemoveEnabled();
    onChange(String(select.value || (entry && entry.default) || ""));
  });
  addButton.addEventListener("click", async () => {
    const family = await onAdd();
    if (!family) return;
    refresh(family);
    updateRemoveEnabled();
    onChange(family);
  });
  removeButton.addEventListener("click", async () => {
    const fileName = userFontFileFromFamily(select.value);
    if (!fileName || !getUserFontFiles().includes(fileName)) return;
    if (await onRemove(fileName)) {
      refresh(defaultFamily);
      updateRemoveEnabled();
    }
  });
  updateRemoveEnabled();
  wrap.appendChild(addButton);
  wrap.appendChild(removeButton);
  return { wrap, select, refresh, updateRemoveEnabled };
}

function settingsPatchForRemovedUserFont({ fileName, settings = {}, defaults = {} } = {}) {
  const safe = String(fileName || "").trim();
  const ref = `user:${safe}`;
  const patch = {};
  if (String(settings.abc2svgNotationFontFile || "") === ref) patch.abc2svgNotationFontFile = "";
  if (String(settings.abc2svgTextFontFile || "") === ref) patch.abc2svgTextFontFile = "";
  if (userFontFileFromFamily(settings.uiFontFamily) === safe) {
    patch.uiFontFamily = String(defaults.uiFontFamily || SYSTEM_UI_FONT_FAMILY);
  }
  if (userFontFileFromFamily(settings.libraryUiFontFamily) === safe) {
    patch.libraryUiFontFamily = String(defaults.libraryUiFontFamily || defaults.uiFontFamily || SYSTEM_UI_FONT_FAMILY);
  }
  if (String(settings.editorFontFamily || "").includes(`ABCarus User Font: ${safe}`)) {
    patch.editorFontFamily = String(defaults.editorFontFamily || "");
  }
  return patch;
}

function fontFormat(fileName) {
  const extension = ((String(fileName || "").match(/\.([^.]+)$/) || [])[1] || "").toLowerCase();
  if (extension === "otf") return "opentype";
  if (extension === "woff" || extension === "woff2") return extension;
  return "truetype";
}

function buildUserFontFaceCss({ userDir = "", fontFiles = [], toFileUrl = (value) => value } = {}) {
  const root = String(userDir || "").replace(/\\/g, "/").replace(/\/$/, "");
  if (!root) return "";
  const rules = [];
  for (const fileName of fontFiles) {
    const safeName = String(fileName || "").trim();
    if (!safeName) continue;
    const url = toFileUrl(`${root}/${safeName}`);
    if (!url) continue;
    const family = `ABCarus User Font: ${safeName}`.replace(/"/g, '\\"');
    rules.push(`@font-face{font-family:"${family}";src:url("${url}") format("${fontFormat(safeName)}");font-weight:normal;font-style:normal;}`);
  }
  return rules.join("\n");
}

function normalizeFontCatalog(list = {}) {
  return {
    notation: [
      ...(list.bundled && list.bundled.notation ? list.bundled.notation.map((name) => `bundled:${name}`) : []),
      ...(list.user && list.user.notation ? list.user.notation.map((name) => `user:${name}`) : []),
    ],
    text: [
      ...(list.bundled && list.bundled.text ? list.bundled.text.map((name) => `bundled:${name}`) : []),
      ...(list.user && list.user.text ? list.user.text.map((name) => `user:${name}`) : []),
    ],
  };
}

function normalizeUserFontFiles(...sources) {
  const files = [];
  const seen = new Set();
  for (const source of sources) {
    for (const item of Array.isArray(source) ? source : []) {
      const fileName = String(item || "").trim();
      if (!fileName || seen.has(fileName)) continue;
      seen.add(fileName);
      files.push(fileName);
      if (files.length >= 50) return files;
    }
  }
  return files;
}

function normalizeEditorFontFamily(value, defaultFamily = "") {
  const family = String(value || "").trim();
  if (!family || family === LEGACY_EDITOR_FONT_FAMILY) return String(defaultFamily || "").trim();
  return family;
}

export {
  INTERFACE_FONT_PRESETS,
  SYSTEM_UI_FONT_FAMILY,
  buildInterfaceFontOptions,
  buildUserFontFaceCss,
  createInterfaceFontControl,
  getCatalogUserFontFiles,
  interfaceFontFamilyForFile,
  isSoundfontPath,
  normalizeFontCatalog,
  normalizeEditorFontFamily,
  normalizeUserFontFiles,
  settingsPatchForRemovedUserFont,
  safeBasename,
  toFileUrl,
  userFontFileFromFamily,
};
