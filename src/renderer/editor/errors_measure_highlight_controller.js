function createErrorsMeasureHighlightController({
  getOutputElement,
  getEditorRanges,
  getRenderRanges,
} = {}) {
  function getRanges(renderOffset) {
    const renderRanges = typeof getRenderRanges === "function" ? getRenderRanges() : [];
    if (Array.isArray(renderRanges) && renderRanges.length) return renderRanges;
    const editorRanges = typeof getEditorRanges === "function" ? getEditorRanges() : [];
    if (!Array.isArray(editorRanges) || !editorRanges.length) return [];
    const offset = Number(renderOffset) || 0;
    return editorRanges.map((range) => ({
      start: range.start + offset,
      end: range.end + offset,
    }));
  }

  function apply(renderOffset) {
    const out = typeof getOutputElement === "function" ? getOutputElement() : null;
    if (!out) return;
    const notes = out.querySelectorAll(".note-hl, .bar-hl");
    for (const note of notes) note.classList.remove("measure-error");

    const ranges = getRanges(renderOffset);
    if (!ranges.length) return;

    const barEls = Array.from(out.querySelectorAll(".bar-hl"));
    if (barEls.length) {
      for (const bar of barEls) {
        const start = Number(bar.dataset && bar.dataset.start);
        if (!Number.isFinite(start)) continue;
        const hit = ranges.some((range) => start >= range.start && start < range.end);
        if (hit) bar.classList.add("measure-error");
      }
      return;
    }

    const noteEls = Array.from(out.querySelectorAll(".note-hl"));
    for (const range of ranges) {
      let first = null;
      let last = null;
      for (const note of noteEls) {
        const start = Number(note.dataset && note.dataset.start);
        if (!Number.isFinite(start)) continue;
        if (start >= range.start && start < range.end) {
          if (!first) first = note;
          last = note;
        }
      }
      if (first) first.classList.add("measure-error");
      if (last && last !== first) last.classList.add("measure-error");
    }
  }

  return {
    apply,
  };
}

export {
  createErrorsMeasureHighlightController,
};
