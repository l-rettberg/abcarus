import { normalizeSourceUrl, parseYouTubeVideoId } from "../../source_link.js";

const TITLE_PREFIX = "N:[YouTube title]";
const CHANNEL_PREFIX = "N:[YouTube channel]";

function oneLine(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function splitLinesWithOffsets(text) {
  const source = String(text || "");
  const lines = [];
  let start = 0;
  while (start < source.length) {
    const match = /\r\n|\n|\r/g;
    match.lastIndex = start;
    const found = match.exec(source);
    const end = found ? found.index : source.length;
    const newline = found ? found[0] : "";
    lines.push({ text: source.slice(start, end), start, end, newline, fullEnd: end + newline.length });
    start = end + newline.length;
  }
  if (!source.length) lines.push({ text: "", start: 0, end: 0, newline: "", fullEnd: 0 });
  return lines;
}

function collectYouTubeSources(abcText) {
  const lines = splitLinesWithOffsets(abcText);
  const sources = [];
  let xNumber = "";
  let title = "";
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const xMatch = line.text.match(/^\s*X:\s*(.*?)\s*$/);
    if (xMatch) {
      xNumber = oneLine(xMatch[1]);
      title = "";
      continue;
    }
    const titleMatch = line.text.match(/^\s*T:\s*(.*?)\s*$/);
    if (titleMatch && !title) title = oneLine(titleMatch[1]);
    const sourceMatch = line.text.match(/^\s*F:\s*(.*?)\s*$/);
    if (!sourceMatch) continue;
    const url = normalizeSourceUrl(sourceMatch[1]);
    const videoId = parseYouTubeVideoId(url);
    if (!url || !videoId) continue;
    let managedEnd = line.fullEnd;
    let j = i + 1;
    while (j < lines.length && (lines[j].text.startsWith(TITLE_PREFIX) || lines[j].text.startsWith(CHANNEL_PREFIX))) {
      managedEnd = lines[j].fullEnd;
      j += 1;
    }
    sources.push({ url, videoId, xNumber, title, insertAt: line.fullEnd, managedEnd, newline: line.newline || "\n", needsLeadingNewline: !line.newline });
  }
  return sources;
}

function applyYouTubeMetadata(abcText, metadataByVideoId) {
  const source = String(abcText || "");
  const entries = collectYouTubeSources(source);
  const changes = [];
  let updated = 0;
  let unchanged = 0;
  for (const entry of entries) {
    const metadata = metadataByVideoId instanceof Map
      ? metadataByVideoId.get(entry.videoId)
      : metadataByVideoId && metadataByVideoId[entry.videoId];
    if (!metadata || !oneLine(metadata.title)) continue;
    const lines = [
      `${TITLE_PREFIX} ${oneLine(metadata.title)}`,
      ...(oneLine(metadata.channel) ? [`${CHANNEL_PREFIX} ${oneLine(metadata.channel)}`] : []),
    ];
    const replacement = `${entry.needsLeadingNewline ? entry.newline : ""}${lines.join(entry.newline)}${entry.newline}`;
    const current = source.slice(entry.insertAt, entry.managedEnd);
    if (current === replacement) unchanged += 1;
    else {
      changes.push({ from: entry.insertAt, to: entry.managedEnd, insert: replacement });
      updated += 1;
    }
  }
  let text = source;
  for (const change of changes.sort((a, b) => b.from - a.from)) {
    text = `${text.slice(0, change.from)}${change.insert}${text.slice(change.to)}`;
  }
  return { text, entries, updated, unchanged };
}

export { CHANNEL_PREFIX, TITLE_PREFIX, applyYouTubeMetadata, collectYouTubeSources };
