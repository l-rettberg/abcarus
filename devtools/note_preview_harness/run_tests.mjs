import {
  findCompletedNoteTokenBeforePosition,
  parseAbcNoteToken,
  parseHeadersNear,
} from "../../src/renderer/note_preview/abc_note_parse.mjs";

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

function makeDoc(text) {
  const lines = String(text || "").split(/\n/);
  const starts = [];
  let off = 0;
  for (let i = 0; i < lines.length; i += 1) {
    starts.push(off);
    off += lines[i].length + (i < lines.length - 1 ? 1 : 0);
  }
  const total = off;
  return {
    length: total,
    lineAt(pos) {
      const p = Math.max(0, Math.min(total, Number(pos)));
      let idx = 0;
      for (let i = 0; i < lines.length; i += 1) {
        const from = starts[i];
        const to = from + lines[i].length;
        if (p <= to || i === lines.length - 1) {
          idx = i;
          break;
        }
      }
      return { number: idx + 1, from: starts[idx], text: lines[idx] };
    },
    line(n) {
      const idx = Math.max(0, Math.min(lines.length - 1, Number(n) - 1));
      return { number: idx + 1, from: starts[idx], text: lines[idx] };
    },
  };
}

function run() {
  const doc = makeDoc("X:1\nM:4/4\nL:1/8\nQ:1/4=120\nK:Dm\nA B c2 d/ e3/2 |\n");
  const fullText = "X:1\nM:4/4\nL:1/8\nQ:1/4=120\nK:Dm\nA B c2 d/ e3/2 |\n";
  const pos = fullText.indexOf(" |");
  const token = findCompletedNoteTokenBeforePosition(doc, pos);
  assert(token && token.token === "e3/2", "should find final completed token");

  const ctx = parseHeadersNear(doc, token.from);
  const parsed = parseAbcNoteToken(token.token, ctx, { lengthMode: "typed", skipMicrotones: true });
  assert(parsed && Number.isFinite(parsed.midi), "token should parse to midi");
  assert(parsed.midi === 76, `expected midi 76 for e in Dm, got ${parsed ? parsed.midi : "null"}`);
  assert(parsed.durationMs > 300 && parsed.durationMs < 500, `duration out of range: ${parsed.durationMs}`);

  const baseLen = parseAbcNoteToken("c2", ctx, { lengthMode: "base", skipMicrotones: true });
  assert(baseLen && baseLen.durationMs >= 200 && baseLen.durationMs <= 300, "base mode should ignore suffix");

  const keySharp = parseAbcNoteToken("F", parseHeadersNear(makeDoc("K:G\nF |\n"), 5), { lengthMode: "typed" });
  assert(keySharp && keySharp.midi === 66, `K:G should sharpen F to F#, got ${keySharp ? keySharp.midi : "null"}`);

  const explicitNatural = parseAbcNoteToken("=F", parseHeadersNear(makeDoc("K:G\n=F |\n"), 6), { lengthMode: "typed" });
  assert(explicitNatural && explicitNatural.midi === 65, "explicit natural should override key signature");

  const micro = parseAbcNoteToken("^3c", ctx, { lengthMode: "typed", skipMicrotones: true });
  assert(micro === null, "microtonal-like token should be skipped when skipMicrotones=true");

  console.log("[note_preview_harness] OK");
}

run();
