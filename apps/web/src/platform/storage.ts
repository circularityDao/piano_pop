// Storage seam (plan §3-D11). A thin wrapper over localStorage so a later
// Capacitor build can swap in @capacitor/preferences (or encrypted native
// storage) without touching usePreferences. All access is guarded so SSR /
// privacy-mode / quota failures degrade to in-memory and never throw.

interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

function makeLocalStorage(): KeyValueStore {
  let mem: Record<string, string> | null = null;
  const memStore = (): Record<string, string> => (mem ??= {});
  const available = (() => {
    try {
      const k = "__pp_probe__";
      window.localStorage.setItem(k, "1");
      window.localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  })();
  if (!available) {
    return {
      get: (k) => (k in memStore() ? memStore()[k] : null),
      set: (k, v) => {
        memStore()[k] = v;
      },
      remove: (k) => {
        delete memStore()[k];
      },
    };
  }
  return {
    get: (k) => {
      try {
        return window.localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    set: (k, v) => {
      try {
        window.localStorage.setItem(k, v);
      } catch {
        /* quota / private mode — ignore */
      }
    },
    remove: (k) => {
      try {
        window.localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    },
  };
}

export const storage: KeyValueStore = makeLocalStorage();
