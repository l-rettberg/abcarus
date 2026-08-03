function normalizeNullableString(value) {
  const text = value == null ? "" : String(value);
  return text || null;
}

function normalizeTuneIndex(value) {
  if (value == null || value === "") return null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function createActiveTuneContextStore() {
  let filePath = null;
  let tuneId = null;
  let tuneUid = null;
  let tuneIndex = null;
  let tuneMeta = null;
  let newTuneDraft = false;

  function syncUidWithMeta() {
    if (!tuneMeta || typeof tuneMeta !== "object") return;
    if (tuneUid) {
      tuneMeta.tuneUid = tuneUid;
    } else if (tuneMeta.tuneUid) {
      tuneUid = normalizeNullableString(tuneMeta.tuneUid);
    }
  }

  function clearTune() {
    tuneId = null;
    tuneUid = null;
    tuneIndex = null;
    tuneMeta = null;
    newTuneDraft = false;
  }

  function clear({ nextFilePath = null } = {}) {
    filePath = normalizeNullableString(nextFilePath);
    clearTune();
  }

  function setTuneMetaOffsets(start, end) {
    if (!tuneMeta || typeof tuneMeta !== "object") return false;
    tuneMeta.startOffset = Number(start);
    tuneMeta.endOffset = Number(end);
    return true;
  }

  return {
    clear,
    clearTune,
    getActiveFilePath() {
      return filePath;
    },
    setActiveFilePath(value) {
      filePath = normalizeNullableString(value);
    },
    getActiveTuneId() {
      return tuneId;
    },
    setActiveTuneId(value) {
      tuneId = normalizeNullableString(value);
    },
    getActiveTuneUid() {
      return tuneUid;
    },
    setActiveTuneUid(value) {
      tuneUid = normalizeNullableString(value);
      if (tuneMeta && typeof tuneMeta === "object") {
        tuneMeta.tuneUid = tuneUid || "";
      }
    },
    getActiveTuneIndex() {
      return tuneIndex;
    },
    setActiveTuneIndex(value) {
      tuneIndex = normalizeTuneIndex(value);
    },
    getActiveTuneMeta() {
      return tuneMeta;
    },
    setActiveTuneMeta(value) {
      tuneMeta = value && typeof value === "object" ? value : null;
      syncUidWithMeta();
    },
    setTuneMetaOffsets,
    isNewTuneDraft() {
      return newTuneDraft;
    },
    setNewTuneDraft(value) {
      newTuneDraft = Boolean(value);
    },
    snapshot() {
      return {
        filePath,
        tuneId,
        tuneUid,
        tuneIndex,
        tuneMeta,
        newTuneDraft,
      };
    },
  };
}

export {
  createActiveTuneContextStore,
  normalizeTuneIndex,
};
