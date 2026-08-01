import {
  hoverTooltip,
} from "../../../third_party/codemirror/cm.js";
import { getAbcHelpAtLine } from "./abc_help.js";

function buildAbcHoverTooltip() {
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

  return hoverTooltip((view, pos) => {
    if (!view) return null;
    const line = view.state.doc.lineAt(pos);
    const text = line.text;
    const leadingSpaces = /^\s*/.exec(text)?.[0]?.length || 0;

    const help = getAbcHelpAtLine(text);
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
