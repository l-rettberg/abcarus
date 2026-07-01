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

export {
  buildDecorationExample,
  parseDecorationCatalogEnrichment,
};
