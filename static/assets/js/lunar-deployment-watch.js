(() => {
  const KEY = "lunar-deployment-version";
  let currentVersion = "";
  let checking = false;

  async function getVersion() {
    if (checking) return "";
    checking = true;
    try {
      const response = await fetch("/api/version?t=" + Date.now(), {
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" }
      });
      if (!response.ok) return "";
      const data = await response.json();
      return String(data.version || "");
    } catch {
      return "";
    } finally {
      checking = false;
    }
  }

  async function check() {
    const version = await getVersion();
    if (!version) return;
    if (!currentVersion) {
      currentVersion = version;
      try { localStorage.setItem(KEY, version); } catch {}
      return;
    }
    if (version !== currentVersion) {
      document.documentElement.dataset.lunarDeploymentPending = "true";
    }
  }

  async function applyPendingUpdate() {
    if (!document.documentElement.dataset.lunarDeploymentPending) return;
    const version = await getVersion();
    if (!version || version === currentVersion) return;
    try { localStorage.setItem(KEY, version); } catch {}
    location.reload();
  }

  check();
  setInterval(check, 60_000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) check().then(applyPendingUpdate);
  });
  window.addEventListener("pageshow", () => {
    if (!document.hidden) check().then(applyPendingUpdate);
  });
})();
