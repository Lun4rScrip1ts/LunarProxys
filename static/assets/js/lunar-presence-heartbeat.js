(() => {
  let inFlight = false;

  const touchPresence = async () => {
    if (inFlight || document.hidden) return;
    inFlight = true;
    try {
      await fetch("/api/presence/heartbeat", {
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Cache-Control": "no-cache" },
      });
    } catch {}
    finally { inFlight = false; }
  };

  touchPresence();
  setInterval(touchPresence, 30_000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) touchPresence();
  });
  window.addEventListener("focus", touchPresence);
})();
