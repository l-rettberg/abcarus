const fs = require("fs");
const { pathToFileURL } = require("url");
const { ConversionError } = require("../utils");

function readU16BE(buf, off) {
  return (buf[off] << 8) | buf[off + 1];
}

function readU32BE(buf, off) {
  return ((buf[off] << 24) >>> 0) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3];
}

function readVar(buf, off) {
  let v = 0;
  let i = off;
  for (let n = 0; n < 4; n += 1) {
    const b = buf[i++];
    v = (v << 7) | (b & 0x7f);
    if ((b & 0x80) === 0) return { value: v, next: i };
  }
  return { value: v, next: i };
}

function parseSmf(buf) {
  if (!buf || buf.length < 14 || buf.toString("ascii", 0, 4) !== "MThd") {
    throw new ConversionError("Not a MIDI file.", "Missing MIDI header (MThd).", "MIDI_BAD_HEADER");
  }
  const hdrLen = readU32BE(buf, 4);
  const division = readU16BE(buf, 12);
  if (division & 0x8000) {
    throw new ConversionError("Unsupported MIDI timebase.", "SMPTE division is not supported.", "MIDI_UNSUPPORTED_DIVISION");
  }
  const ntrks = readU16BE(buf, 10);
  const tpq = division;
  let off = 8 + hdrLen;
  const tracks = [];
  for (let t = 0; t < ntrks; t += 1) {
    if (off + 8 > buf.length || buf.toString("ascii", off, off + 4) !== "MTrk") {
      throw new ConversionError("Bad MIDI track header.", `Invalid MTrk at index ${t}.`, "MIDI_BAD_TRACK");
    }
    const len = readU32BE(buf, off + 4);
    const start = off + 8;
    const end = start + len;
    if (end > buf.length) {
      throw new ConversionError("Bad MIDI track length.", `Track ${t} length is out of range.`, "MIDI_BAD_TRACK_LEN");
    }
    tracks.push({ index: t, data: buf.subarray(start, end) });
    off = end;
  }
  return { tpq, tracks };
}

function parseMidiEvents(smf) {
  const notes = [];
  const tempos = [];
  const timeSignatures = [];
  const trackNames = [];

  for (const trk of smf.tracks) {
    const data = trk.data;
    let i = 0;
    let tick = 0;
    let running = 0;
    const open = new Map();
    const channelProgram = new Array(16).fill(0);

    while (i < data.length) {
      const dv = readVar(data, i);
      tick += dv.value;
      i = dv.next;
      if (i >= data.length) break;

      let st = data[i];
      if (st < 0x80) {
        if (!running) {
          throw new ConversionError("Invalid MIDI stream.", `Running status without previous status in track ${trk.index}.`, "MIDI_BAD_RUNNING_STATUS");
        }
        st = running;
      } else {
        i += 1;
        running = st;
      }

      if (st === 0xff) {
        if (i + 1 > data.length) break;
        const type = data[i++];
        const lv = readVar(data, i);
        i = lv.next;
        const end = i + lv.value;
        if (end > data.length) break;
        const ev = data.subarray(i, end);
        if (type === 0x51 && ev.length === 3) {
          const mpqn = (ev[0] << 16) | (ev[1] << 8) | ev[2];
          tempos.push({ tick, mpqn });
        } else if (type === 0x58 && ev.length >= 2) {
          timeSignatures.push({ tick, numerator: ev[0], denominator: 2 ** ev[1] });
        } else if (type === 0x03 && ev.length) {
          const name = Buffer.from(ev).toString("utf8").trim();
          if (name) trackNames.push({ tick, name });
        }
        i = end;
        continue;
      }

      if (st === 0xf0 || st === 0xf7) {
        const lv = readVar(data, i);
        i = lv.next + lv.value;
        continue;
      }

      const hi = st & 0xf0;
      const ch = st & 0x0f;
      if (hi === 0x80 || hi === 0x90) {
        const key = data[i++];
        const vel = data[i++];
        const nk = `${ch}:${key}`;
        if (hi === 0x90 && vel > 0) {
          const arr = open.get(nk) || [];
          arr.push({ tick, vel, track: trk.index, ch, key, program: channelProgram[ch] || 0 });
          open.set(nk, arr);
        } else {
          const arr = open.get(nk);
          if (!arr || !arr.length) continue;
          const on = arr.pop();
          if (!arr.length) open.delete(nk);
          if (tick > on.tick) {
            notes.push({
              startTick: on.tick,
              endTick: tick,
              key: on.key,
              vel: on.vel,
              ch: on.ch,
              track: on.track,
              program: on.program,
            });
          }
        }
        continue;
      }

      if (hi === 0xc0) {
        channelProgram[ch] = data[i++];
        continue;
      }
      if (hi === 0xa0 || hi === 0xb0 || hi === 0xe0) {
        i += 2;
        continue;
      }
      if (hi === 0xd0) {
        i += 1;
        continue;
      }

      throw new ConversionError("Unsupported MIDI event.", `Unknown MIDI status 0x${st.toString(16)} in track ${trk.index}.`, "MIDI_BAD_EVENT");
    }
  }

  return { notes, tempos, timeSignatures, trackNames };
}

function uniqByTick(items, mapFn) {
  const byTick = new Map();
  for (const it of items) byTick.set(it.tick, mapFn(it));
  return [...byTick.entries()].map(([tick, value]) => ({ tick, ...value })).sort((a, b) => a.tick - b.tick);
}

function buildTempoTimeline(rawTempos) {
  const tempos = uniqByTick(rawTempos || [], (it) => ({ mpqn: it.mpqn }));
  if (!tempos.length || tempos[0].tick !== 0) tempos.unshift({ tick: 0, mpqn: 500000 });
  const seg = [];
  let secs = 0;
  for (let i = 0; i < tempos.length; i += 1) {
    const cur = tempos[i];
    const next = tempos[i + 1];
    seg.push({ tick: cur.tick, secsAtTick: secs, mpqn: cur.mpqn });
    if (next) {
      const dt = next.tick - cur.tick;
      secs += (dt * cur.mpqn) / 1000000;
    }
  }
  return seg;
}

function tickToSeconds(tick, timeline, tpq) {
  let seg = timeline[0];
  for (let i = 1; i < timeline.length; i += 1) {
    if (timeline[i].tick > tick) break;
    seg = timeline[i];
  }
  const dt = tick - seg.tick;
  return seg.secsAtTick + ((dt / tpq) * (seg.mpqn / 1000000));
}

function toNoteSequence(parsed, smf) {
  const timeline = buildTempoTimeline(parsed.tempos);
  const tempos = timeline.map((t) => ({ time: t.secsAtTick, qpm: 60000000 / t.mpqn }));
  const timeSignatures = uniqByTick(parsed.timeSignatures || [], (it) => ({ numerator: it.numerator, denominator: it.denominator }))
    .map((ts) => ({
      time: tickToSeconds(ts.tick, timeline, smf.tpq),
      numerator: ts.numerator,
      denominator: ts.denominator,
    }));
  if (!timeSignatures.length || timeSignatures[0].time !== 0) {
    timeSignatures.unshift({ time: 0, numerator: 4, denominator: 4 });
  }

  const instrumentMap = new Map();
  let nextInstrumentId = 0;
  const getInstrumentId = (note) => {
    const isDrum = note.ch === 9;
    const key = `${isDrum ? "D" : "N"}:${note.program}:${note.ch}`;
    let id = instrumentMap.get(key);
    if (id == null) {
      id = nextInstrumentId;
      nextInstrumentId += 1;
      instrumentMap.set(key, id);
    }
    return id;
  };

  const notes = (parsed.notes || []).map((n) => ({
    instrument: getInstrumentId(n),
    program: Number.isFinite(n.program) ? n.program : 0,
    isDrum: n.ch === 9,
    pitch: n.key,
    velocity: n.vel,
    startTime: tickToSeconds(n.startTick, timeline, smf.tpq),
    endTime: tickToSeconds(n.endTick, timeline, smf.tpq),
  })).filter((n) => n.endTime > n.startTime + 1e-9)
    .sort((a, b) => (a.instrument - b.instrument) || (a.startTime - b.startTime) || (a.pitch - b.pitch));

  let totalTime = 0;
  for (const n of notes) {
    if (n.endTime > totalTime) totalTime = n.endTime;
  }

  return {
    notes,
    tempos,
    timeSignatures,
    totalTime,
    title: parsed.trackNames && parsed.trackNames.length ? parsed.trackNames[0].name : "",
  };
}

async function loadTone2Abc(converterPath) {
  const href = pathToFileURL(converterPath).href;
  const mod = await import(href);
  const fn = mod && (mod.default || mod);
  if (typeof fn !== "function") {
    throw new ConversionError(
      "MIDI converter failed to load.",
      "third_party/midi2abc/midi2abc.mjs does not export a default function.",
      "MIDI2ABC_LOAD_FAILED"
    );
  }
  return fn;
}

function parseMidiImportOptions(extraArgs = []) {
  const out = {
    title: "",
    composer: "",
    meter: "",
    unit: "",
    key: "",
    quantize: true,
    grid: "1/16",
  };
  const args = Array.isArray(extraArgs) ? extraArgs.map((x) => String(x || "")) : [];
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    const takeValue = () => {
      const v = args[i + 1];
      if (v == null || String(v).startsWith("-")) {
        throw new ConversionError("Invalid midi2abc flags.", `Missing value for ${a}.`, "MIDI2ABC_BAD_ARGS");
      }
      i += 1;
      return String(v);
    };
    if (a === "--title") out.title = takeValue();
    else if (a === "--composer") out.composer = takeValue();
    else if (a === "--meter") out.meter = takeValue();
    else if (a === "--unit") out.unit = takeValue();
    else if (a === "--key") out.key = takeValue();
    else if (a === "--no-quantize") out.quantize = false;
    else if (a === "--grid") out.grid = takeValue();
    else if (a.trim()) {
      throw new ConversionError(
        "Invalid midi2abc flags.",
        `Unsupported flag: ${a}. Supported: --title --composer --meter --unit --key --no-quantize --grid`,
        "MIDI2ABC_BAD_ARGS"
      );
    }
  }
  if (!/^(1\/8|1\/16|1\/32)$/.test(out.grid)) {
    throw new ConversionError(
      "Invalid midi2abc flags.",
      `Invalid --grid value: ${out.grid}. Allowed: 1/8, 1/16, 1/32.`,
      "MIDI2ABC_BAD_ARGS"
    );
  }
  return out;
}

function replaceAbcHeaderLine(abcText, tag, value) {
  const txt = String(abcText || "");
  const v = String(value || "").trim();
  if (!v) return txt;
  const re = new RegExp(`^${tag}:.*$`, "m");
  if (re.test(txt)) return txt.replace(re, `${tag}:${v}`);
  const lines = txt.split(/\r\n|\n|\r/);
  let insertAt = 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^\s*(X:|T:|C:|Q:|L:|M:)\b/.test(lines[i] || "")) {
      insertAt = i + 1;
      continue;
    }
    break;
  }
  lines.splice(insertAt, 0, `${tag}:${v}`);
  return `${lines.join("\n")}\n`;
}

function quantizeTick(value, grid) {
  return Math.round(value / grid) * grid;
}

function gridToTicks(tpq, gridLabel) {
  const q = Math.max(1, Number(tpq) || 1);
  if (gridLabel === "1/8") return Math.max(1, Math.round(q / 2));
  if (gridLabel === "1/32") return Math.max(1, Math.round(q / 8));
  return Math.max(1, Math.round(q / 4));
}

function quantizeParsedNotes(notes, tpq, gridLabel) {
  const grid = gridToTicks(tpq, gridLabel);
  return (notes || []).map((n) => {
    let startTick = quantizeTick(Number(n.startTick) || 0, grid);
    let endTick = quantizeTick(Number(n.endTick) || 0, grid);
    if (endTick <= startTick) endTick = startTick + grid;
    return { ...n, startTick, endTick };
  });
}

async function convertMidiToAbc({ inputPath, converterPath, extraArgs = [] }) {
  if (!inputPath) {
    throw new ConversionError("No input file selected.", "Choose a MIDI file to import.", "NO_INPUT");
  }
  if (!converterPath || !fs.existsSync(converterPath)) {
    throw new ConversionError(
      "MIDI converter not found.",
      `Missing converter at ${String(converterPath || "")}`,
      "CONVERTER_MISSING"
    );
  }

  const data = await fs.promises.readFile(inputPath);
  const smf = parseSmf(data);
  const parsed = parseMidiEvents(smf);
  const opts = parseMidiImportOptions(extraArgs);
  if (opts.quantize) {
    parsed.notes = quantizeParsedNotes(parsed.notes, smf.tpq, opts.grid);
  }
  const ns = toNoteSequence(parsed, smf);
  if (!ns.notes || !ns.notes.length) {
    throw new ConversionError(
      "No note events found.",
      "The MIDI file does not contain note-on/note-off events.",
      "MIDI_EMPTY"
    );
  }

  const tone2abc = await loadTone2Abc(converterPath);
  let abcText = "";
  const prevLog = console.log;
  try {
    // Upstream midi2abc logs full note sequences; keep app diagnostics readable.
    console.log = () => {};
    abcText = String(tone2abc(ns, {
      title: opts.title || ns.title || "",
      composer: opts.composer || "",
    }) || "");
  } catch (e) {
    throw new ConversionError(
      "MIDI conversion failed.",
      e && e.message ? e.message : String(e),
      "MIDI2ABC_FAILED"
    );
  } finally {
    console.log = prevLog;
  }
  if (!abcText.trim()) {
    throw new ConversionError(
      "No ABC output produced.",
      "The MIDI converter returned an empty output.",
      "NO_OUTPUT"
    );
  }
  if (opts.meter) abcText = replaceAbcHeaderLine(abcText, "M", opts.meter);
  if (opts.unit) abcText = replaceAbcHeaderLine(abcText, "L", opts.unit);
  if (opts.key) abcText = replaceAbcHeaderLine(abcText, "K", opts.key);
  return { abcText, warnings: "Converted by bundled midi2abc (experimental).", backend: "midi2abc" };
}

module.exports = { convertMidiToAbc };
