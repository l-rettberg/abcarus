import {
  hoverTooltip,
} from "../../../third_party/codemirror/cm.js";

function buildAbcHoverTooltip() {
  const helpByHeaderKey = new Map([
    ["K", "Key signature (e.g. K:Dm, K:G, K:C#m). abc2svg treats K: as the header/body boundary."],
    ["M", "Meter/time signature (e.g. M:4/4, M:6/8, M:C, M:C|)."],
    ["L", "Default note length unit (e.g. L:1/8)."],
  ]);

  const helpByMidiCommand = new Map([
    ["program", "Select instrument program (0\u2013127)."],
    ["instrument", "Instrument selection (engine-defined; often an alias of program)."],
    ["temperamentequal", "Enable EDO-N tuning (e.g. %%MIDI temperamentequal 53)."],
    ["drum", "Enable/define drums (engine-defined)."],
    ["drumon", "Enable drums (engine-defined)."],
    ["drumoff", "Disable drums (engine-defined)."],
  ]);

  const buildDom = (title, body) => {
    const dom = document.createElement("div");
    dom.style.maxWidth = "320px";
    dom.style.padding = "3px 6px";
    dom.style.fontSize = "12px";
    dom.style.lineHeight = "1.3";

    const line = document.createElement("div");
    line.textContent = `${title} \u2014 ${body}`;
    dom.appendChild(line);

    return dom;
  };

  const getHelpAtLine = (text) => {
    if (!text) return null;

    const headerMatch = /^\s*([KML]):/.exec(text);
    if (headerMatch) {
      const key = headerMatch[1];
      const help = helpByHeaderKey.get(key) || null;
      if (!help) return null;
      return { title: `${key}:`, help };
    }

    const midiMatch = /^\s*(%{1,2})\s*MIDI\s+([A-Za-z]+)/i.exec(text);
    if (midiMatch) {
      const cmd = String(midiMatch[2] || "").toLowerCase();
      const help = helpByMidiCommand.get(cmd) || null;
      if (!help) return null;
      return { title: `%%MIDI ${cmd}`, help };
    }

    return null;
  };

  return hoverTooltip((view, pos) => {
    if (!view) return null;
    const line = view.state.doc.lineAt(pos);
    const text = line.text;
    const leadingSpaces = /^\s*/.exec(text)?.[0]?.length || 0;

    const help = getHelpAtLine(text);
    if (help && /^\s*([KML]):/.test(text)) {
      const from = line.from + leadingSpaces;
      const to = Math.min(line.to, from + 2);
      return {
        pos: from,
        end: to,
        above: false,
        create() {
          return { dom: buildDom(help.title, help.help) };
        },
      };
    }

    if (help && /^\s*%{1,2}\s*MIDI\b/i.test(text)) {
      const from = line.from + leadingSpaces;
      const to = Math.min(line.to, line.from + text.trim().length);
      return {
        pos: from,
        end: to,
        above: false,
        create() {
          return { dom: buildDom(help.title, help.help) };
        },
      };
    }

    return null;
  }, { hoverTime: 900 });
}

export {
  buildAbcHoverTooltip,
};
