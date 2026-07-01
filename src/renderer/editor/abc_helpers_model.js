function buildDecorationExample(name, shorthandChar) {
  if (!name) return "";
  const abc = `!${name}!`;
  if (name.endsWith("(")) {
    const base = name.slice(0, -1);
    return `${abc}c2 d2 !${base})! e2`;
  }
  if (name.endsWith(")")) {
    return `!${name.slice(0, -1)}(! c2 d2 ${abc} e2`;
  }
  if (name === "trill") return `!trill!A4`;
  if (["p", "pp", "ppp", "pppp", "mp", "mf", "f", "ff", "fff", "ffff", "sfz"].includes(name)) return `${abc} c2 d2 e2`;
  if (name === ">") return `!>!c`;
  if (name === "+") return `!+!c`;
  if (name === "^") return `!^!c`;
  if (name === "dot") return `.c`;
  if (name === "gmark") return `!gmark!c`;
  if (["/", "//", "///"].includes(name)) return `${abc}c`;
  if (["-(", "-)", "~(", "~)"].includes(name)) return `${abc}c`;
  if (shorthandChar) return `${shorthandChar}c`;
  return `${abc}c`;
}

function parseDecorationCatalogEnrichment(rawJson) {
  const parsed = JSON.parse(String(rawJson || ""));
  const list = Array.isArray(parsed && parsed.decorations) ? parsed.decorations : [];
  const map = new Map();
  for (const d of list) {
    const name = d && d.name ? String(d.name) : "";
    if (!name) continue;
    map.set(name, {
      description: d && d.description ? String(d.description) : "",
      example: d && d.example ? String(d.example) : "",
      sources: Array.isArray(d && d.sources) ? d.sources.map(String) : [],
    });
  }
  return map;
}

function getMidiProgramCommand(lineText) {
  const m = /^\s*%{1,2}\s*MIDI\s*(program|chordprog|bassprog)\b/i.exec(String(lineText || ""));
  return m ? String(m[1] || "program").toLowerCase() : "";
}

function buildGmProgramItems(programNames, query) {
  const all = Array.isArray(programNames) && programNames.length
    ? programNames
    : Array.from({ length: 128 }, (_, i) => `Program ${i}`);
  const q = String(query || "").trim().toLowerCase();
  const terms = q ? q.split(/\s+/g).filter(Boolean) : [];
  const items = [];
  for (let i = 0; i < Math.min(128, all.length); i += 1) {
    const name = String(all[i] || `Program ${i}`);
    if (terms.length) {
      const hay = `${i} ${i + 1} ${name}`.toLowerCase();
      if (!terms.every((t) => hay.includes(t))) continue;
    }
    items.push({ idx: i, name });
  }
  return items;
}

function findMidiProgramNumberEdit(text, cmd, programNumber) {
  const command = String(cmd || "program").toLowerCase();
  const replaceRe = new RegExp(`^(\\s*%{1,2}\\s*MIDI\\s*${command}\\b\\s*)(\\d+)?`, "i");
  const mm = replaceRe.exec(String(text || ""));
  if (!mm) return null;
  const prefix = mm[1] || "";
  const existingNum = mm[2] || "";
  const insertAt = (mm.index || 0) + prefix.length;
  const needSpace = !/\s$/.test(prefix);
  return {
    from: insertAt,
    to: existingNum ? insertAt + existingNum.length : insertAt,
    insert: (needSpace && !existingNum) ? ` ${programNumber}` : String(programNumber),
  };
}

function findMidiProgramCommentEdit(text, cmd, programName) {
  const name = String(programName || "").trim();
  if (!name) return null;
  const command = String(cmd || "program").toLowerCase();
  const afterRe = new RegExp(`^(\\s*%{1,2}\\s*MIDI\\s*${command}\\b\\s*)(\\d+)`, "i");
  const mm = afterRe.exec(String(text || ""));
  if (!mm) return null;

  const prefix = mm[1] || "";
  const num = mm[2] || "";
  const numEndLocal = (mm.index || 0) + prefix.length + num.length;
  let commentIdx = -1;
  for (let i = numEndLocal; i < text.length; i += 1) {
    if (text[i] === "%" && text[i - 1] !== "\\") {
      commentIdx = i;
      break;
    }
  }
  const commentText = ` % ${name}`;
  const trailingWs = /\s*$/.exec(text);
  const endNoWs = trailingWs ? (text.length - trailingWs[0].length) : text.length;
  if (commentIdx === -1) {
    return { from: endNoWs, to: endNoWs, insert: commentText };
  }
  return { from: commentIdx, to: endNoWs, insert: commentText };
}

export {
  buildDecorationExample,
  buildGmProgramItems,
  findMidiProgramCommentEdit,
  findMidiProgramNumberEdit,
  getMidiProgramCommand,
  parseDecorationCatalogEnrichment,
};
