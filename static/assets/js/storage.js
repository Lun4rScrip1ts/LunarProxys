// Disable Lunar's custom right-click menu before main.js registers it.
// The browser's normal context menu remains available.
window.addEventListener("contextmenu", event => {
  event.stopImmediatePropagation();
}, true);

// The codec must stay synchronous: main.js reads the theme before first paint.
// XOR plus base64url is obfuscation, not encryption. The key ships with the page, so this only
// keeps settings from being readable at a glance or found by a string scan.
(() => {
  const KEY = "cfg";
  const SCHEMA = 1;
  const XOR_KEY = [0x3f, 0x5c, 0x91, 0x27, 0xe8, 0x4a, 0xb3, 0x6d, 0x1e, 0xc5, 0x72, 0xa9];
  const WRITE_CODEC = "1";
  const CODECS = {
    0: { encode: text => text, decode: text => text },
    1: { encode: text => base64url(xor(new TextEncoder().encode(text))), decode: text => new TextDecoder().decode(xor(unbase64url(text))) },
  };
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
  let preserve = false;
  let syncTimer = null;
  let syncInFlight = false;
  let syncPending = false;
  let syncingFromAccount = false;
  function decode(raw) {
    if (raw == null || raw === "") return {};
    const codec = CODECS[raw[0]];
    if (!codec) { preserve = true; return {}; }
    let state;
    try { state = JSON.parse(codec.decode(raw.slice(1))); } catch { preserve = true; return {}; }
    if (!state || typeof state !== "object" || typeof state.d !== "object" || state.d === null) { preserve = true; return {}; }
    if (!Number.isInteger(state.v) || state.v > SCHEMA) { preserve = true; return {}; }
    let data = state.d;
    for (let v = state.v; v < SCHEMA; v++) data = MIGRATIONS[v] ? MIGRATIONS[v](data) : data;
    return data;
  }
  function read() { try { return localStorage.getItem(KEY); } catch { return null; } }
  function write(data) {
    try {
      if (preserve) { const original = read(); if (original != null) localStorage.setItem(`${KEY}.x`, original); preserve = false; }
      localStorage.setItem(KEY, WRITE_CODEC + CODECS[WRITE_CODEC].encode(JSON.stringify({ v: SCHEMA, d: data })));
      fields = data;
      scheduleAccountSync();
    } catch {}
  }
  function mutate(apply) { const data = { ...decode(read()) }; apply(data); write(data); }
  function sideKey(name) { return `${KEY}.${name}`; }
  function reload() { preserve = false; fields = decode(read()); }
  fields = decode(read());
  window.addEventListener("storage", event => { if (event.key === KEY || event.key === null) reload(); });
  async function syncAccountSettings() {
    if (syncingFromAccount) return;
    syncPending = false;
    const snapshot = { ...fields };
    try {
      const response = await fetch("/api/profile/settings", { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: snapshot }) });
      if (!response.ok) syncPending = true;
    } catch { syncPending = true; }
    finally { syncInFlight = false; if (syncPending && !syncingFromAccount) scheduleAccountSync(50); }
  }
  function scheduleAccountSync(delay = 250) {
    if (syncingFromAccount) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      if (syncInFlight) { syncPending = true; return; }
      syncInFlight = true;
      syncAccountSettings();
    }, delay);
  }
  async function flushAccountSettings() {
    if (syncingFromAccount) return false;
    clearTimeout(syncTimer); syncTimer = null;
    if (syncInFlight) { syncPending = true; while (syncInFlight) await new Promise(resolve => setTimeout(resolve, 25)); }
    syncPending = false; syncInFlight = true; await syncAccountSettings(); return !syncPending;
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
      if (accountKeys.length) { fields = { ...accountSettings }; write(fields); }
      else if (options.adoptLocalIfEmpty && localKeys.length) { fields = localSettings; write(fields); }
      else { fields = {}; write(fields); }
      syncingFromAccount = false;
      return accountKeys.length > 0;
    } catch { syncingFromAccount = false; return false; }
  }
  window.store = {
    get(field) { return Object.hasOwn(fields, field) ? fields[field] : null; },
    set(field, value) { mutate(data => { data[field] = String(value); }); },
    remove(field) { mutate(data => { delete data[field]; }); },
    getRaw(name) { try { return localStorage.getItem(sideKey(name)); } catch { return null; } },
    setRaw(name, value) { try { localStorage.setItem(sideKey(name), value); } catch {} },
    removeRaw(name) { try { localStorage.removeItem(sideKey(name)); } catch {} },
    all() { return { ...fields }; },
    reload,
    replaceAll(data) { syncingFromAccount = true; fields = data && typeof data === "object" ? { ...data } : {}; write(fields); syncingFromAccount = false; },
    loadAccountSettings,
    flushAccountSettings,
  };
})();

(() => {
  const loadGlobalSpotifyPlayer = () => {
    if (document.getElementById("lunar-global-spotify-css")) return;
    const css = document.createElement("link");
    css.id = "lunar-global-spotify-css";
    css.rel = "stylesheet";
    css.href = "/assets/css/spotify-global-player.css?v=lunar2";
    document.head.appendChild(css);
    const script = document.createElement("script");
    script.src = "/assets/js/spotify-global-player.js?v=lunar2";
    script.async = true;
    document.head.appendChild(script);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadGlobalSpotifyPlayer, { once: true });
  else loadGlobalSpotifyPlayer();
})();

(() => {
  if (document.getElementById("lunar-update-checker")) return;
  const script = document.createElement("script");
  script.id = "lunar-update-checker";
  script.src = `/assets/js/update-checker.js?v=${Date.now()}`;
  script.async = true;
  document.head.appendChild(script);
})();

(() => {
  if (document.getElementById("lunar-dropdown-css")) return;
  const css = document.createElement("link");
  css.id = "lunar-dropdown-css";
  css.rel = "stylesheet";
  css.href = "/assets/css/lunar-dropdowns.css?v=lunar2";
  document.head.appendChild(css);
  const script = document.createElement("script");
  script.id = "lunar-dropdown-script";
  script.src = "/assets/js/lunar-dropdowns.js?v=lunar2";
  script.async = true;
  document.head.appendChild(script);
})();
