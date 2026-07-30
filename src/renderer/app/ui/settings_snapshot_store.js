export function createSettingsSnapshotStore() {
  let settings = null;

  return {
    get() {
      return settings;
    },
    set(next) {
      settings = next && typeof next === "object" ? next : null;
    },
    patch(patch) {
      settings = {
        ...(settings || {}),
        ...(patch && typeof patch === "object" ? patch : {}),
      };
      return settings;
    },
  };
}
