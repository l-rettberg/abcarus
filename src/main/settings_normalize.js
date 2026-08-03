"use strict";

function hasOwn(obj, key) {
  return Boolean(obj && Object.prototype.hasOwnProperty.call(obj, key));
}

function normalizeMicrotonalSettings(next, patch) {
  if (!next || typeof next !== "object") return next;
  const hasCanonicalPatch = hasOwn(patch, "supportMicrotonalNotation");
  next.supportMicrotonalNotation = hasCanonicalPatch
    ? Boolean(next.supportMicrotonalNotation)
    : Boolean(next.supportMicrotonalNotation || next.makamToolsEnabled || next.studyToolsEnabled);
  next.makamToolsEnabled = Boolean(next.supportMicrotonalNotation);
  next.studyToolsEnabled = Boolean(next.supportMicrotonalNotation);
  return next;
}

module.exports = {
  normalizeMicrotonalSettings,
};
