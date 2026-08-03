import {
  buildSortedErrorsForNav,
  normalizeErrors,
} from "./errors_model.js";

function createErrorsRuntimeState({
  isEnabled,
  clearFocusMessage,
  updateIndicator,
  syncActiveNavIndex,
} = {}) {
  let errors = [];

  function getErrors() {
    return errors.slice();
  }

  function getSortedErrorsForNav() {
    return buildSortedErrorsForNav(errors);
  }

  function updateIndicatorAndPopover() {
    const enabled = typeof isEnabled === "function" ? Boolean(isEnabled()) : true;
    if (!enabled) {
      if (typeof clearFocusMessage === "function") clearFocusMessage();
      if (typeof updateIndicator === "function") updateIndicator({ enabled: false });
      return;
    }
    if (typeof updateIndicator === "function") updateIndicator({ enabled: true });
  }

  function setErrors(nextErrors) {
    errors = normalizeErrors(nextErrors);
    updateIndicatorAndPopover();
    if (typeof syncActiveNavIndex === "function") syncActiveNavIndex();
  }

  return {
    getErrors,
    getSortedErrorsForNav,
    setErrors,
    updateIndicatorAndPopover,
  };
}

export {
  createErrorsRuntimeState,
};
