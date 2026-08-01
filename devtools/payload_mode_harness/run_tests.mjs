#!/usr/bin/env node
/* eslint-disable no-console */
import {
  buildPlaybackPayloadForDiagnosticsFromRenderText,
  computePayloadTuneOffset,
  findLineNumberAtOffset,
} from "../../src/renderer/tools/payload_mode/payload_mode_model.mjs";

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

function assertSpan(spans, fromLine, toLine) {
  assert(
    spans.some((s) => s && s.fromLine === fromLine && s.toLine === toLine && s.className === "cm-payload-layer-playback"),
    `missing playback span ${fromLine}-${toLine}: ${JSON.stringify(spans)}`
  );
}

function run() {
  assert(computePayloadTuneOffset("%%abc\nX:7\nK:C\nC|\n") === 6, "offset should point at first X:");
  assert(computePayloadTuneOffset("K:C\nC|\n") === 0, "missing X: should default to zero");
  assert(findLineNumberAtOffset("a\nb\nc", 2) === 2, "line lookup should be 1-based");

  const built = buildPlaybackPayloadForDiagnosticsFromRenderText("X:1\nK:C\nC|\n", 4, {
    injectGchordOn: (text, offset) => ({
      changed: true,
      text: `${text.slice(0, offset)}%%MIDI gchordon\n${text.slice(offset)}`,
      offsetDelta: "%%MIDI gchordon\n".length,
    }),
    sanitizeAbcForPlayback: (text) => ({ text, warnings: [{ line: 2 }] }),
  });
  assert(built.text.includes("%%MIDI gchordon"), "gchord injection should be retained");
  assert(built.offset > 4, "offset should account for gchord injection");
  assertSpan(built.spans, 2, 2);
  assertSpan(built.spans, 2, 2);

  const fallback = buildPlaybackPayloadForDiagnosticsFromRenderText("X:1\nK:C\nV:DRUM\nz4|\nV:1\nC|\n", 0, {
  });
  assertSpan(fallback.spans, 3, 4);

  const readableDrum = buildPlaybackPayloadForDiagnosticsFromRenderText("X:1\nK:C\n%%MIDI drum dddd\n%%MIDI drum +: 36 42 38 42\n%%MIDI drum +: 100 90 80 90\nC|\n", 0, {
    normalizeReadableMidiDrumsForPlayback: () => "X:1\nK:C\n%%MIDI drum dddd 36 42 38 42 100 90 80 90\n%\n%\nC|\n",
  });
  assert(readableDrum.text.includes("%%MIDI drum dddd 36 42 38 42 100 90 80 90"), "readable drum payload should use canonical line");
  assertSpan(readableDrum.spans, 3, 3);
  assertSpan(readableDrum.spans, 4, 4);
  assertSpan(readableDrum.spans, 5, 5);

  let expanded = false;
  buildPlaybackPayloadForDiagnosticsFromRenderText("X:1\nK:C\nC|\n", 0, {
    expandRepeats: true,
    expandRepeatsForPlayback: (text) => {
      expanded = true;
      return text;
    },
  });
  assert(expanded, "repeat expansion callback should run only when requested");

  console.log("[payload_mode_harness] OK");
}

try {
  run();
} catch (e) {
  console.log("[payload_mode_harness] FAIL");
  console.log(String(e && e.message ? e.message : e));
  process.exitCode = 1;
}
