function createErrorsScanState() {
  let filterActive = false;
  let token = 0;
  let inFlight = false;

  function invalidate() {
    token += 1;
    return token;
  }

  function begin({ filterToErrorTunes = filterActive } = {}) {
    filterActive = Boolean(filterToErrorTunes);
    token += 1;
    inFlight = true;
    return token;
  }

  function finish() {
    inFlight = false;
  }

  function cancel() {
    inFlight = false;
    token += 1;
    return token;
  }

  function setFilterActive(next) {
    filterActive = Boolean(next);
  }

  function clearFilter() {
    filterActive = false;
  }

  function isCurrent(candidateToken) {
    return Number(candidateToken) === token;
  }

  return {
    begin,
    cancel,
    clearFilter,
    finish,
    invalidate,
    isCurrent,
    isFilterActive: () => filterActive,
    isInFlight: () => inFlight,
    setFilterActive,
  };
}

export {
  createErrorsScanState,
};
