function clampOffset(value, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(Math.max(0, Number(max) || 0), n));
}

function clonePlan(plan) {
  if (!plan) return null;
  return {
    ...plan,
    mutedVoices: plan.mutedVoices && typeof plan.mutedVoices === "object" ? { ...plan.mutedVoices } : {},
  };
}

function cloneMarkers(markers) {
  if (!markers || typeof markers !== "object") return null;
  return {
    start: Number(markers.start),
    end: Number(markers.end),
  };
}

export function createAbLoopRuntime({ minLength = 2 } = {}) {
  let plan = null;
  let revision = 0;
  let markers = null;
  let markerVersion = 0;

  const setMarkers = (nextMarkers) => {
    markers = cloneMarkers(nextMarkers);
    markerVersion += 1;
  };

  return {
    getRevisionToken() {
      return revision;
    },

    incrementRevision() {
      revision += 1;
      return revision;
    },

    getPlan() {
      return clonePlan(plan);
    },

    hasPlan() {
      return Boolean(plan);
    },

    isPlanValid({ rawMode = false, payloadMode = false } = {}) {
      if (!plan) return false;
      if (rawMode || payloadMode) return false;
      if (plan.revisionToken !== revision) return false;
      if (!Number.isFinite(plan.startOffset) || !Number.isFinite(plan.endOffset)) return false;
      if (plan.endOffset - plan.startOffset < minLength) return false;
      return true;
    },

    clearPlan() {
      const had = Boolean(plan);
      plan = null;
      setMarkers(null);
      return had;
    },

    setPlanRange(startOffset, endOffset, maxOffset) {
      const max = Math.max(0, Number(maxOffset) || 0);
      const s = clampOffset(startOffset, max);
      const e = clampOffset(endOffset, max);
      const start = Math.min(s, e);
      const end = Math.max(s, e);
      if (end - start < minLength) return null;
      const prev = plan ? clonePlan(plan) : null;
      plan = {
        mode: "ab-loop",
        startOffset: start,
        endOffset: end,
        mutedVoices: prev && prev.mutedVoices ? { ...prev.mutedVoices } : {},
        suppressRepeats: prev ? Boolean(prev.suppressRepeats) : true,
        muteGchords: prev ? Boolean(prev.muteGchords) : false,
        revisionToken: revision,
      };
      setMarkers({ start, end });
      return clonePlan(plan);
    },

    setPlanOptions(opts = {}) {
      if (!plan) return null;
      plan = {
        ...plan,
        suppressRepeats: opts.suppressRepeats != null ? !!opts.suppressRepeats : plan.suppressRepeats,
        muteGchords: opts.muteGchords != null ? !!opts.muteGchords : plan.muteGchords,
        mutedVoices: opts.mutedVoices || plan.mutedVoices || {},
      };
      return clonePlan(plan);
    },

    setPoint(which, pos) {
      const offset = Number(pos);
      if (!Number.isFinite(offset)) return clonePlan(plan);
      if (!plan) {
        plan = {
          mode: "ab-loop",
          startOffset: offset,
          endOffset: offset,
          mutedVoices: {},
          suppressRepeats: true,
          muteGchords: false,
          revisionToken: revision,
        };
      } else if (which === "a") {
        plan = { ...plan, startOffset: offset, revisionToken: revision };
      } else {
        plan = { ...plan, endOffset: offset, revisionToken: revision };
      }
      setMarkers({ start: plan.startOffset, end: plan.endOffset });
      return clonePlan(plan);
    },

    getMarkers() {
      return cloneMarkers(markers);
    },

    getMarkerVersion() {
      return markerVersion;
    },

    mapMarkers(changes, maxOffset) {
      if (!markers || !changes || typeof changes.mapPos !== "function") return null;
      const max = Math.max(0, Number(maxOffset) || 0);
      const start = changes.mapPos(Number(markers.start), 1);
      const end = changes.mapPos(Number(markers.end), -1);
      markers = {
        start: clampOffset(start, max),
        end: clampOffset(end, max),
      };
      return cloneMarkers(markers);
    },
  };
}
