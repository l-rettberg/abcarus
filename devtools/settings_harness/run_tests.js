#!/usr/bin/env node
/* eslint-disable no-console */
const path = require("path");

function fail(msg) {
  throw new Error(msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

function main() {
  const schemaPath = path.resolve(__dirname, "../../src/main/settings_schema.js");
  const normalizePath = path.resolve(__dirname, "../../src/main/settings_normalize.js");
  const propertiesPath = path.resolve(__dirname, "../../src/main/properties.js");
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const { getSettingsSchema, getDefaultSettings } = require(schemaPath);
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const { normalizeMicrotonalSettings } = require(normalizePath);
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const { encodePropertiesFromSchema, parseSettingsPatchFromProperties } = require(propertiesPath);

  const schema = getSettingsSchema();
  assert(Array.isArray(schema) && schema.length > 0, "schema must be a non-empty array");

  const seen = new Set();
  for (const entry of schema) {
    assert(entry && entry.key, "schema entry missing key");
    assert(!seen.has(entry.key), `duplicate key: ${entry.key}`);
    seen.add(entry.key);
  }

  const defaults = getDefaultSettings();
  assert(defaults && typeof defaults === "object", "defaults must be an object");
  for (const entry of schema) {
    assert(Object.prototype.hasOwnProperty.call(defaults, entry.key), `default missing for key: ${entry.key}`);
  }

  // Guard new selection-playback controls to prevent silent schema drift.
  const requiredDefaults = {
    playbackSelectionLoopEnabled: false,
    playbackSelectionSuppressRepeats: true,
    playbackSelectionMuteGchords: false,
    playbackSelectionAllowMidiDrums: false,
    playbackSelectionMutedVoices: "",
    stripImportedMeasureComments: true,
    autoFormatImportedAbc: true,
  };
  for (const [key, expected] of Object.entries(requiredDefaults)) {
    assert(seen.has(key), `missing schema key: ${key}`);
    assert(
      Object.prototype.hasOwnProperty.call(defaults, key),
      `missing default for key: ${key}`
    );
    const actual = defaults[key];
    assert(
      actual === expected,
      `unexpected default for ${key}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }

  {
    const next = {
      supportMicrotonalNotation: false,
      makamToolsEnabled: true,
      studyToolsEnabled: true,
    };
    normalizeMicrotonalSettings(next, { supportMicrotonalNotation: false });
    assert(next.supportMicrotonalNotation === false, "canonical microtonal OFF patch must override legacy aliases");
    assert(next.makamToolsEnabled === false, "legacy makam alias must sync to canonical OFF");
    assert(next.studyToolsEnabled === false, "legacy study alias must sync to canonical OFF");
  }

  {
    const source = {
      ...defaults,
      globalHeaderText: "%%gchordfont MuseJazz Text 20\n%%MIDI program 1",
    };
    const exported = encodePropertiesFromSchema(source, schema);
    assert(exported.includes("globalHeaderText=\"%%gchordfont MuseJazz Text 20\\n%%MIDI program 1\""), "portable export must include escaped Global Header");
    const imported = parseSettingsPatchFromProperties(exported, schema);
    assert(imported.globalHeaderText === source.globalHeaderText, "portable Global Header must round-trip");

    const legacy = parseSettingsPatchFromProperties("globalHeaderText=%%gchordfont MuseJazz Text 20", schema);
    assert(legacy.globalHeaderText === "%%gchordfont MuseJazz Text 20", "plain Global Header values must remain readable");
  }

  {
    const next = {
      supportMicrotonalNotation: false,
      makamToolsEnabled: true,
      studyToolsEnabled: false,
    };
    normalizeMicrotonalSettings(next, {});
    assert(next.supportMicrotonalNotation === true, "legacy makam alias must enable canonical microtonal setting");
    assert(next.makamToolsEnabled === true, "legacy makam alias must remain synced ON");
    assert(next.studyToolsEnabled === true, "legacy study alias must sync ON when canonical is ON");
  }

  console.log("% PASS settings schema sanity");
}

try {
  main();
} catch (e) {
  console.log("% FAIL settings schema sanity");
  console.log("% " + String(e && e.message ? e.message : e));
  process.exitCode = 1;
}
