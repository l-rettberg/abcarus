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
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const { getSettingsSchema, getDefaultSettings } = require(schemaPath);

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
    playbackNativeMidiDrums: false,
    playbackMidiFxPreset: "Custom",
    playbackMidiReverb: 0,
    playbackMidiChorus: 0,
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

  console.log("% PASS settings schema sanity");
}

try {
  main();
} catch (e) {
  console.log("% FAIL settings schema sanity");
  console.log("% " + String(e && e.message ? e.message : e));
  process.exitCode = 1;
}
