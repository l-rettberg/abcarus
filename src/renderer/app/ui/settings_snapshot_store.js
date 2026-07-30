export function createSettingsSnapshotStore({ api = null } = {}) {
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
    async persistPatch(patch) {
      if (!api || typeof api.updateSettings !== "function") return;
      try {
        await api.updateSettings(patch);
      } catch {}
    },
  };
}
