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
  buildGmProgramItems,
  findMidiProgramCommentEdit,
  findMidiProgramNumberEdit,
  getMidiProgramCommand,
};
