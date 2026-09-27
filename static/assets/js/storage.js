// The codec must stay synchronous: main.js reads the theme before first paint.
// XOR plus base64url is obfuscation, not encryption. The key ships with the page, so this only
// keeps settings from being readable at a glance or found by a string scan.
(() => {
  const KEY = "cfg";
  const SCHEMA = 1;
  const XOR_KEY = [0x3f, 0x5c, 0x91, 0x27, 0xe8, 0x4a, 0xb3, 0x6d, 0x1e, 0xc5, 0x72, 0xa9];

  // Codec 0 is never written, only accepted, so the write codec can change without a migration.
  const WRITE_CODEC = "1";
  const CODECS = {
    0: { encode: text => text, decode: text => text },
    1: { encode: text => base64url(xor(new TextEncoder().encode(text))), decode: text => new TextDecoder().decode(xor(unbase64url(text))) },
  };

  // Semantic changes only. Adding or removing a field needs no entry.
  const MIGRATIONS = {};

  function xor(bytes) {
    const out = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ XOR_KEY[i % XOR_KEY.length];
    return out;
  }

  function base64url(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function unbase64url(text) {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }

  let fields = {};
  // Unreadable data is copied to cfg.x on the next write rather than overwritten, so a value
  // written by a newer build survives a rollback.
  let preserve = false;
  let syncTimer = null;
  let syncInFlight = false;
  let syncingFromAccount = false;

  function decode(raw) {
    if (raw == null || raw === "") return {};
    const codec = CODECS[raw[0]];
    if (!codec) {
      preserve = true;
      return {};
    }
    let state;
    try {
      state = JSON.parse(codec.decode(raw.slice(1)));
    } catch {
      preserve = true;
      return {};
    }
    if (!state || typeof state !== "object" || typeof state.d !== "object" || state.d === null) {
      preserve = true;
      return {};
    }
    if (!Number.isInteger(state.v) || state.v > SCHEMA) {
      preserve = true;
      return {};
    }
    let data = state.d;
    for (let v = state.v; v < SCHEMA; v++) data = MIGRATIONS[v] ? MIGRATIONS[v](data) : data;
    return data;
  }

  function read() {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  }

  function write(data) {
    try {
      if (preserve) {
        const original = read();
        if (original != null) localStorage.setItem(`${KEY}.x`, original);
        preserve = false;
      }
      localStorage.setItem(KEY, WRITE_CODEC + CODECS[WRITE_CODEC].encode(JSON.stringify({ v: SCHEMA, d: data })));
      fields = data;
      scheduleAccountSync();
    } catch {}
  }

  // Re-read first so this tab's older snapshot cannot clobber another tab's change.
  function mutate(apply) {
    const data = { ...decode(read()) };
    apply(data);
    write(data);
  }

  function sideKey(name) {
    return `${KEY}.${name}`;
  }

  // Clearing preserve matters: the value that could not be read may have just been replaced by
  // another tab, and backing up the replacement would be wrong.
  function reload() {
    preserve = false;
    fields = decode(read());
  }

  fields = decode(read());

  // Only another tab reaches here; the event never fires in the tab that caused it. A null key
  // means clear(). Other keys, including the sidecars, must not reset app state.
  window.addEventListener("storage", event => {
    if (event.key === KEY || event.key === null) reload();
  });

  async function syncAccountSettings() {
    if (syncingFromAccount) return;
    try {
      const response = await fetch("/api/profile/settings", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: fields }),
      });
      if (!response.ok) return;
    } catch {}
    finally {
      syncInFlight = false;
    }
  }

  function scheduleAccountSync() {
    if (syncingFromAccount) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      if (syncInFlight) return;
      syncInFlight = true;
      syncAccountSettings();
    }, 250);
  }

  async function loadAccountSettings(options = {}) {
    try {
      const response = await fetch("/api/profile/settings", { credentials: "same-origin" });
      if (!response.ok) return false;
      const data = await response.json();
      if (!data || !data.settings || typeof data.settings !== "object") return false;

      const accountSettings = data.settings;
      const localSettings = fields && typeof fields === "object" ? { ...fields } : {};
      const localKeys = Object.keys(localSettings);
      const accountKeys = Object.keys(accountSettings);

      syncingFromAccount = true;
      if (accountKeys.length) {
        // The server is authoritative for a logged-in account. Never merge the
        // previous account's local settings into this account.
        fields = { ...accountSettings };
        write(fields);
      } else if (options.adoptLocalIfEmpty && localKeys.length) {
        // Preserve settings that were created before the first account login,
        // then immediately sync them into that first account.
        fields = localSettings;
        write(fields);
      } else {
        // A valid account with no saved settings gets clean defaults instead of
        // inheriting the previous account's settings.
        fields = {};
        write(fields);
      }
      syncingFromAccount = false;
      return accountKeys.length > 0;
    } catch {
      syncingFromAccount = false;
      return false;
    }
  }

  window.store = {
    get(field) {
      return Object.hasOwn(fields, field) ? fields[field] : null;
    },
    set(field, value) {
      mutate(data => {
        data[field] = String(value);
      });
    },
    remove(field) {
      mutate(data => {
        delete data[field];
      });
    },
    getRaw(name) {
      try {
        return localStorage.getItem(sideKey(name));
      } catch {
        return null;
      }
    },
    setRaw(name, value) {
      try {
        localStorage.setItem(sideKey(name), value);
      } catch {}
    },
    removeRaw(name) {
      try {
        localStorage.removeItem(sideKey(name));
      } catch {}
    },
    all() {
      return { ...fields };
    },
    reload,
    replaceAll(data) {
      syncingFromAccount = true;
      fields = data && typeof data === "object" ? { ...data } : {};
      write(fields);
      syncingFromAccount = false;
    },
    loadAccountSettings,
  };
})();
