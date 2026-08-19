const CATALOG_FACET_RE = /^\s*\[([A-Za-z][A-Za-z0-9_-]*)\]\s*(.*?)\s*$/;

function parseCatalogGroupValues(groups) {
  const catalogFacets = {};
  for (const rawValue of Array.isArray(groups) ? groups : []) {
    const match = String(rawValue || "").match(CATALOG_FACET_RE);
    if (!match || !match[2]) continue;
    const facet = match[1].toLowerCase();
    if (facet === "__proto__" || facet === "prototype" || facet === "constructor") continue;
    const value = match[2].trim();
    if (!catalogFacets[facet]) catalogFacets[facet] = [];
    if (!catalogFacets[facet].includes(value)) catalogFacets[facet].push(value);
  }
  return catalogFacets;
}

function extractTuneHeader(lines, startIdx, endIdx) {
  let title = "";
  let composer = "";
  const composers = [];
  let key = "";
  let meter = "";
  let unitLength = "";
  let tempo = "";
  let rhythm = "";
  let source = "";
  let origin = "";
  const groups = [];
  let sawHeader = false;
  for (let i = startIdx; i <= endIdx; i += 1) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    const isBlank = trimmed === "";
    const isHeader = /^[A-Za-z]:/.test(line) || /^%/.test(line);
    if (isHeader) sawHeader = true;
    if (!title && /^T:/.test(line)) title = line.slice(2).trim();
    if (/^C:/.test(line)) {
      const value = line.slice(2).trim();
      if (value && !composers.includes(value)) composers.push(value);
      if (!composer) composer = value;
    }
    if (!key && /^K:/.test(line)) key = line.slice(2).trim();
    if (!meter && /^M:/.test(line)) meter = line.slice(2).trim();
    if (!unitLength && /^L:/.test(line)) unitLength = line.slice(2).trim();
    if (!tempo && /^Q:/.test(line)) tempo = line.slice(2).trim();
    if (!rhythm && /^R:/.test(line)) rhythm = line.slice(2).trim();
    if (!source && /^S:/.test(line)) source = line.slice(2).trim();
    if (!origin && /^O:/.test(line)) origin = line.slice(2).trim();
    if (/^G:/.test(line)) {
      const value = line.slice(2).trim();
      if (value && !groups.includes(value)) groups.push(value);
    }
    if (sawHeader && isBlank) break;
    if (!isHeader && !isBlank) break;
  }
  return {
    title,
    composer,
    composers,
    key,
    meter,
    unitLength,
    tempo,
    rhythm,
    source,
    origin,
    group: groups[0] || "",
    groups,
    catalogFacets: parseCatalogGroupValues(groups),
  };
}

module.exports = {
  extractTuneHeader,
  parseCatalogGroupValues,
};
