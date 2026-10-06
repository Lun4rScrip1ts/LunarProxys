(() => {
  const touchPresence = async () => {
    try {
      await fetch("/api/friends/bootstrap?presence=1", {
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Cache-Control": "no-cache" },
      });
    } catch {}
  };

  touchPresence();
  setInterval(touchPresence, 30_000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) touchPresence();
  });
  window.addEventListener("focus", touchPresence);
})();
