function cloneParts(parts = {}) {
  return {
    header: String(parts.header || ""),
    before: String(parts.before || ""),
    active: String(parts.active || ""),
    after: String(parts.after || ""),
  };
}

function sameParts(left, right) {
  return left.header === right.header
    && left.before === right.before
    && left.active === right.active
    && left.after === right.after;
}

export function createSingleTuneDocument(parts = {}) {
  let loadedParts = cloneParts(parts);
  let currentParts = cloneParts(parts);

  function getParts() {
    return cloneParts(currentParts);
  }

  function setParts(nextParts = {}) {
    currentParts = cloneParts(nextParts);
    return getParts();
  }

  function setActiveTune(text) {
    currentParts.active = String(text || "");
    return getParts();
  }

  function setHeader(text) {
    currentParts.header = String(text || "");
    return getParts();
  }

  function compose() {
    return currentParts.header + currentParts.before + currentParts.active + currentParts.after;
  }

  function markSaved(nextParts = currentParts) {
    loadedParts = cloneParts(nextParts);
    currentParts = cloneParts(nextParts);
  }

  function discard() {
    currentParts = cloneParts(loadedParts);
    return getParts();
  }

  return {
    compose,
    discard,
    getParts,
    isDirty: () => !sameParts(currentParts, loadedParts),
    markSaved,
    setActiveTune,
    setHeader,
    setParts,
  };
}
