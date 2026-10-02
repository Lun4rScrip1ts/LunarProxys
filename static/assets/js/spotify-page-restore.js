(() => {
  const restore = () => {
    const player = document.getElementById("spotify-floating-player");
    const frame = document.getElementById("spotify-floating-frame");
    const label = document.getElementById("spotify-floating-label");
    if (!player || !frame) return;
    try {
      const state = JSON.parse(localStorage.getItem("lunarSpotifyLast") || "null");
      if (!state?.type || !state?.id || localStorage.getItem("lunarSpotifyGlobalPlayerClosed") === "1") return;
      frame.src = `https://open.spotify.com/embed/${encodeURIComponent(state.type)}/${encodeURIComponent(state.id)}?utm_source=lunar&theme=0`;
      if (label) label.textContent = state.label || "Spotify";
      player.hidden = false;
    } catch {}
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", restore, { once: true });
  else restore();
})();
