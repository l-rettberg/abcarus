#!/usr/bin/env node
/* eslint-disable no-console */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile("src/renderer/app/ui/font_settings_model.js", "utf8");
const encoded = Buffer.from(source, "utf8").toString("base64");
const model = await import(`data:text/javascript;base64,${encoded}`);

const defaults = {
  uiFontFamily: "system-ui, sans-serif",
  libraryUiFontFamily: "system-ui, sans-serif",
  editorFontFamily: "ui-monospace, monospace",
};

assert.equal(
  model.normalizeEditorFontFamily(
    `"ABCarus Noto Sans Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`,
    `"ABCarus DejaVu Sans Mono", ui-monospace, monospace`,
  ),
  `"ABCarus DejaVu Sans Mono", ui-monospace, monospace`,
);
assert.equal(
  model.normalizeEditorFontFamily(`"ABCarus User Font: Custom.ttf", monospace`, "bundled"),
  `"ABCarus User Font: Custom.ttf", monospace`,
);

const bundledEditorFont = await readFile("assets/fonts/editor/dejavu-sans-mono/DejaVuSansMono.ttf");
assert.ok(bundledEditorFont.length > 300_000, "bundled multilingual editor font is missing or truncated");

const choices = model.buildInterfaceFontOptions({
  selected: defaults.uiFontFamily,
  userFontFiles: ["My Font.otf"],
  defaultFamily: defaults.uiFontFamily,
});
assert.deepEqual(choices.options.slice(0, 4).map((item) => item.label), [
  "System default",
  "Sans serif",
  "Serif",
  "Monospace",
]);
assert.equal(choices.options[4].label, "My Font (added)");
assert.match(choices.options[4].value, /ABCarus User Font: My Font\.otf/);

const custom = model.buildInterfaceFontOptions({
  selected: "Atkinson Hyperlegible, sans-serif",
  defaultFamily: defaults.uiFontFamily,
});
assert.equal(custom.options.at(-1).label, "Custom (current)");
assert.equal(custom.selected, "Atkinson Hyperlegible, sans-serif");

const addedFamily = model.interfaceFontFamilyForFile("My Font.otf", defaults.uiFontFamily);
const removalPatch = model.settingsPatchForRemovedUserFont({
  fileName: "My Font.otf",
  settings: {
    abc2svgNotationFontFile: "user:My Font.otf",
    abc2svgTextFontFile: "user:My Font.otf",
    uiFontFamily: addedFamily,
    libraryUiFontFamily: addedFamily,
    editorFontFamily: `"ABCarus User Font: My Font.otf", monospace`,
  },
  defaults,
});
assert.deepEqual(removalPatch, {
  abc2svgNotationFontFile: "",
  abc2svgTextFontFile: "",
  uiFontFamily: defaults.uiFontFamily,
  libraryUiFontFamily: defaults.libraryUiFontFamily,
  editorFontFamily: defaults.editorFontFamily,
});

const css = model.buildUserFontFaceCss({
  userDir: "/tmp/ABCarus fonts",
  fontFiles: ["Display.otf", "Text.woff2", "Fallback.ttf"],
  toFileUrl: (value) => `file://${value.replace(/ /g, "%20")}`,
});
assert.match(css, /Display\.otf.*format\("opentype"\)/);
assert.match(css, /Text\.woff2.*format\("woff2"\)/);
assert.match(css, /Fallback\.ttf.*format\("truetype"\)/);

console.log("font settings harness: all tests passed");
