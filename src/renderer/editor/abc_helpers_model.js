const WESTERN_KEY_SIGNATURES = [
  { k: "C", detail: "C major" },
  { k: "G", detail: "G major" },
  { k: "D", detail: "D major" },
  { k: "A", detail: "A major" },
  { k: "E", detail: "E major" },
  { k: "B", detail: "B major" },
  { k: "F#", detail: "F# major" },
  { k: "C#", detail: "C# major" },
  { k: "F", detail: "F major" },
  { k: "Bb", detail: "Bb major" },
  { k: "Eb", detail: "Eb major" },
  { k: "Ab", detail: "Ab major" },
  { k: "Db", detail: "Db major" },
  { k: "Gb", detail: "Gb major" },
  { k: "Cb", detail: "Cb major" },
  { k: "Am", detail: "A minor" },
  { k: "Em", detail: "E minor" },
  { k: "Bm", detail: "B minor" },
  { k: "F#m", detail: "F# minor" },
  { k: "C#m", detail: "C# minor" },
  { k: "G#m", detail: "G# minor" },
  { k: "D#m", detail: "D# minor" },
  { k: "A#m", detail: "A# minor" },
  { k: "Dm", detail: "D minor" },
  { k: "Gm", detail: "G minor" },
  { k: "Cm", detail: "C minor" },
  { k: "Fm", detail: "F minor" },
  { k: "Bbm", detail: "Bb minor" },
  { k: "Ebm", detail: "Eb minor" },
  { k: "Abm", detail: "Ab minor" },
  { k: "none", detail: "No key signature" },
];

function buildWesternKeySignatureItems() {
  return WESTERN_KEY_SIGNATURES.map((item) => ({
    k: item.k,
    label: item.k,
    detail: item.detail,
    info: item.detail,
    source: "western",
    count: 0,
    makams: [],
  }));
}

function buildMakamKeySignatureItems(makamSignatures) {
  const groups = new Map();
  for (const entry of Array.isArray(makamSignatures) ? makamSignatures : []) {
    const k = String(entry && entry.k || "").trim();
    const makam = String(entry && entry.makam || "").trim();
    const count = Number(entry && entry.count) || 0;
    if (!k || !makam) continue;
    const group = groups.get(k) || { k, count: 0, makams: [] };
    group.count += count;
    group.makams.push({ makam, count });
    groups.set(k, group);
  }

  return Array.from(groups.values())
    .sort((a, b) => (b.count - a.count) || a.k.localeCompare(b.k))
    .map((group) => {
      const top = group.makams
        .slice()
        .sort((a, b) => (b.count - a.count) || a.makam.localeCompare(b.makam))
        .slice(0, 4);
      const makamText = top.map((m) => `${m.makam} ${m.count}`).join(", ");
      const more = group.makams.length > top.length ? `, +${group.makams.length - top.length} more` : "";
      const detail = `SymbTr makam (${group.count}): ${makamText}${more}`;
      return {
        k: group.k,
        label: group.k,
        detail,
        info: detail,
        source: "symbtr-makam",
        count: group.count,
        makams: group.makams,
      };
    });
}

function buildKeySignatureItems(makamSignatures) {
  return buildWesternKeySignatureItems().concat(buildMakamKeySignatureItems(makamSignatures));
}

function filterKeySignatureItems(items, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return Array.isArray(items) ? items : [];
  const terms = q.split(/\s+/g).filter(Boolean);
  return (Array.isArray(items) ? items : []).filter((item) => {
    const makams = Array.isArray(item && item.makams)
      ? item.makams.map((m) => m && m.makam).join(" ")
      : "";
    const hay = `${item && item.k || ""} ${item && item.detail || ""} ${makams}`.toLowerCase();
    return terms.every((term) => hay.includes(term));
  });
}

function buildKeySignatureCompletionOptions(makamSignatures) {
  return buildKeySignatureItems(makamSignatures).map((item) => ({
    label: item.k,
    type: "keyword",
    detail: item.source === "western" ? item.detail : "SymbTr makam",
    info: item.info,
    boost: item.source === "western" ? 2 : 0,
  }));
}

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

function getRangeDecorationBase(name) {
  const n = String(name || "");
  if (n.endsWith("(")) return n.slice(0, -1);
  if (n.endsWith(")")) return n.slice(0, -1);
  return "";
}

function getDecorationDetails(dec, enrichment) {
  const name = dec && dec.name ? String(dec.name) : "";
  const fromEnrichment = enrichment && name ? enrichment.get(name) : null;
  const description = fromEnrichment && fromEnrichment.description ? String(fromEnrichment.description) : "";
  const example = fromEnrichment && fromEnrichment.example
    ? String(fromEnrichment.example)
    : buildDecorationExample(name, dec && dec.char ? String(dec.char) : "");
  return { description, example };
}

function buildDecorationPickerItems(catalog, {
  query = "",
  enrichment = null,
  favoriteNames = new Set(),
  favoritesFirst = true,
  hideNoPreview = false,
  previewStatus = new Map(),
} = {}) {
  const allRaw = (Array.isArray(catalog) ? catalog : []).map((d) => ({
    char: String(d && d.char || ""),
    abc: String(d && d.abc || ""),
    name: String(d && d.name || ""),
    isInternal: Boolean(d && d.isInternal),
  }));

  // Collapse paired decorations (foo( + foo)) into a single item keyed by the opening element.
  const endSet = new Set(allRaw.filter((d) => d.name.endsWith(")")).map((d) => d.name));
  const all = [];
  for (const d of allRaw) {
    if (d.name.endsWith(")")) continue;
    if (d.name.endsWith("(")) {
      const base = d.name.slice(0, -1);
      const endName = `${base})`;
      if (endSet.has(endName)) {
        all.push({
          ...d,
          displayName: `${base}(\u2026${base})`,
          pairEndAbc: `!${endName}!`,
        });
        continue;
      }
    }
    all.push({ ...d, displayName: d.name });
  }

  const q = String(query || "").trim().toLowerCase();
  const filtered = q
    ? all.filter((d) => {
      const extra = (() => {
        const fromEnrichment = enrichment && d.name ? enrichment.get(d.name) : null;
        return fromEnrichment && fromEnrichment.description ? String(fromEnrichment.description) : "";
      })();
      const hay = `${d.char} ${d.displayName || d.name} ${d.name} ${d.abc} ${d.pairEndAbc || ""} ${extra}`.toLowerCase();
      return hay.includes(q);
    })
    : all;

  let ordered = filtered;
  if (favoritesFirst && favoriteNames && favoriteNames.size) {
    const fav = [];
    const rest = [];
    for (const d of filtered) {
      if (favoriteNames.has(d.name)) fav.push(d);
      else rest.push(d);
    }
    ordered = fav.concat(rest);
  }

  return hideNoPreview
    ? ordered.filter((d) => previewStatus.get(d.name) !== "none")
    : ordered;
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
  buildDecorationPickerItems,
  buildGmProgramItems,
  buildKeySignatureCompletionOptions,
  buildKeySignatureItems,
  findMidiProgramCommentEdit,
  findMidiProgramNumberEdit,
  filterKeySignatureItems,
  getDecorationDetails,
  getRangeDecorationBase,
  getMidiProgramCommand,
  parseDecorationCatalogEnrichment,
};
