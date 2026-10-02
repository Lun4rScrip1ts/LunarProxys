(() => {
  "use strict";

  const VERSION_URL = "/api/version";
  const CHECK_INTERVAL = 15 * 1000;
  const RELOAD_GUARD_KEY = "lunar:last-auto-update";
  const RELOAD_GUARD_MS = 30 * 1000;

  let currentVersion = null;
  let checking = false;

  async function getVersion() {
    const response = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    if (!response.ok) throw new Error(`Version check failed: ${response.status}`);
    const data = await response.json();
    if (!data || !data.version) throw new Error("Invalid version response");
    return String(data.version);
  }

  function reloadForUpdate(nextVersion) {
    try {
      const lastReload = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
      const now = Date.now();
      if (now - lastReload < RELOAD_GUARD_MS) return;
      sessionStorage.setItem(RELOAD_GUARD_KEY, String(now));
      localStorage.setItem("lunar:last-known-deployment", nextVersion);
    } catch {}

    // Preserve the current route and query/hash while replacing the page with the
    // newest deployment. The version query prevents a cached document from being reused.
    const url = new URL(window.location.href);
    url.searchParams.set("lunar_update", Date.now().toString());
    window.location.replace(url.toString());
  }

  async function check() {
    if (checking || document.visibilityState === "prerender") return;
    checking = true;
    try {
      const nextVersion = await getVersion();
      if (currentVersion === null) {
        currentVersion = nextVersion;
        return;
      }
      if (nextVersion !== currentVersion) reloadForUpdate(nextVersion);
    } catch {}
    finally { checking = false; }
  }

  check();
  window.setInterval(check, CHECK_INTERVAL);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });
})();
