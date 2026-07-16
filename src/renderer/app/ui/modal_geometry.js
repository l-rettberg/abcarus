function readTranslateXY(value) {
  const raw = String(value || "");
  const m = raw.match(/translate\(\s*(-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px\)/);
  if (!m) return { x: 0, y: 0 };
  return { x: Number(m[1]) || 0, y: Number(m[2]) || 0 };
}

function clampTranslateToViewport(pos, baseRect, {
  margin = 12,
  viewportWidth = window.innerWidth,
  viewportHeight = window.innerHeight,
} = {}) {
  if (!baseRect) return pos;
  const minX = margin - baseRect.left;
  const maxX = (viewportWidth - margin) - baseRect.right;
  const minY = margin - baseRect.top;
  const maxY = (viewportHeight - margin) - baseRect.bottom;
  return {
    x: Math.min(maxX, Math.max(minX, pos.x)),
    y: Math.min(maxY, Math.max(minY, pos.y)),
  };
}

function formatTranslateXY(pos) {
  return `translate(${Math.round(pos.x)}px, ${Math.round(pos.y)}px)`;
}

export {
  clampTranslateToViewport,
  formatTranslateXY,
  readTranslateXY,
};
