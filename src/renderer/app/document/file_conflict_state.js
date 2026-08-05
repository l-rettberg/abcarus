export function createFileConflictState({ normalizePath = (p) => String(p || ""), onChange = () => {} } = {}) {
  const paths = new Set();
  function mark(filePath, hasConflict) {
    const path = normalizePath(filePath);
    if (!path) return;
    if (hasConflict) paths.add(path);
    else paths.delete(path);
    onChange();
  }
  return {
    has: (filePath) => paths.has(normalizePath(filePath)),
    mark,
  };
}
