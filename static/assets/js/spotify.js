(() => {
  const frame = document.getElementById("spotify-frame");
  const input = document.getElementById("spotify-url");
  const load = document.getElementById("load-spotify");
  const status = document.getElementById("spotify-status");
  const label = document.getElementById("spotify-current-label");
  const open = document.getElementById("open-spotify");
  if (!frame) return;

  const parseSpotify = (raw) => {
    try {
      const url = new URL(String(raw).trim());
      if (!/^(open\.)?spotify\.com$/i.test(url.hostname)) return null;
      const parts = url.pathname.split("/").filter(Boolean);
      const type = parts[0];
      const id = parts[1];
      const allowed = ["track", "album", "playlist", "artist", "show", "episode"];
      if (!allowed.includes(type) || !id) return null;
      return { type, id, url: url.href };
    } catch { return null; }
  };

  const play = (raw, display = "Spotify") => {
    const parsed = parseSpotify(raw);
    if (!parsed) {
      if (status) status.textContent = "Paste a valid Spotify track, album, artist, show, episode, or playlist link.";
      return false;
    }
    frame.src = `https://open.spotify.com/embed/${parsed.type}/${encodeURIComponent(parsed.id)}?utm_source=generator&theme=0`;
    if (label) label.textContent = display;
    if (status) status.textContent = "Loaded in the Spotify player.";
    return true;
  };

  document.querySelectorAll(".spotify-preset").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".spotify-preset").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      const url = button.dataset.spotify;
      if (input) input.value = url || "";
      play(url, button.querySelector("strong")?.textContent || "Spotify");
    });
  });

  load?.addEventListener("click", () => play(input?.value, "Custom Spotify selection"));
  input?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); play(input.value, "Custom Spotify selection"); }
  });
  open?.addEventListener("click", () => window.open("https://open.spotify.com/", "_blank", "noopener,noreferrer"));
})();
