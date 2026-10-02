(() => {
  const init = () => {
    const library = document.querySelector(".spotify-library-card");
    const playlistsEl = document.getElementById("spotify-playlists");
    if (!library || !playlistsEl) return;

    let detail = document.getElementById("spotify-playlist-detail");
    if (!detail) {
      detail = document.createElement("section");
      detail.id = "spotify-playlist-detail";
      detail.className = "spotify-playlist-detail";
      detail.hidden = true;
      library.after(detail);
    }

    const esc = value => String(value ?? "").replace(/[&<>\"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#039;" })[c]);
    const image = value => value ? `<img src="${esc(value)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="spotify-playlist-track-placeholder"><i class="fa-solid fa-music"></i></span>`;

    const playTrack = track => {
      const player = document.getElementById("spotify-floating-player");
      const frame = document.getElementById("spotify-floating-frame");
      const label = document.getElementById("spotify-floating-label");
      if (!player || !frame || !track?.id) return;
      frame.src = `https://open.spotify.com/embed/track/${encodeURIComponent(track.id)}?utm_source=lunar&theme=0`;
      if (label) label.textContent = `${track.name} — ${track.artists || "Spotify"}`;
      player.hidden = false;
      localStorage.setItem("lunarSpotifyLast", JSON.stringify({ type: "track", id: track.id, label: `${track.name} — ${track.artists || "Spotify"}`, track }));
      window.dispatchEvent(new CustomEvent("lunar:spotify-play", { detail: track }));
    };

    const loadPlaylist = async id => {
      try {
        const response = await fetch("/api/spotify/playlists", { credentials: "same-origin", cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load playlist.");
        const playlist = (data.playlists || []).find(item => item.id === id);
        if (!playlist) throw new Error("Playlist not found.");
        renderPlaylist(playlist);
      } catch (error) {
        detail.hidden = false;
        detail.innerHTML = `<div class="spotify-playlist-detail-empty"><i class="fa-solid fa-circle-exclamation"></i><strong>Could not open playlist</strong><span>${esc(error.message)}</span></div>`;
      }
    };

    const renderPlaylist = playlist => {
      const tracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];
      detail.hidden = false;
      detail.innerHTML = `
        <div class="spotify-playlist-detail-head">
          <div><span class="spotify-kicker"><i class="fa-solid fa-list"></i> LUNAR PLAYLIST</span><h2>${esc(playlist.name)}</h2><small>${tracks.length} song${tracks.length === 1 ? "" : "s"}${playlist.description ? ` · ${esc(playlist.description)}` : ""}</small></div>
          <button type="button" class="spotify-secondary" data-close-playlist-detail><i class="fa-solid fa-xmark"></i> Close</button>
        </div>
        <div class="spotify-playlist-track-list">
          ${tracks.length ? tracks.map((track, index) => `
            <article class="spotify-playlist-track" data-track-id="${esc(track.id)}">
              <span class="spotify-playlist-track-number">${index + 1}</span>
              <span class="spotify-playlist-track-art">${image(track.image)}</span>
              <span class="spotify-playlist-track-info"><strong>${esc(track.name)}</strong><small>${esc(track.artists || "Unknown artist")} · ${esc(track.album || "")}</small></span>
              <span class="spotify-playlist-track-duration">${formatDuration(track.duration_ms)}</span>
              <button class="spotify-playlist-track-play" type="button" title="Play ${esc(track.name)}" data-detail-play="${esc(track.id)}"><i class="fa-solid fa-play"></i></button>
              <button class="spotify-playlist-track-remove" type="button" title="Remove from playlist" data-detail-remove="${esc(track.id)}"><i class="fa-solid fa-trash"></i></button>
            </article>`).join("") : `<div class="spotify-playlist-detail-empty"><i class="fa-solid fa-music"></i><strong>This playlist is empty</strong><span>Use the + button on a Spotify search result to add songs.</span></div>`}
        </div>`;

      detail.querySelector("[data-close-playlist-detail]")?.addEventListener("click", () => { detail.hidden = true; });
      detail.querySelectorAll("[data-detail-play]").forEach(button => button.addEventListener("click", () => {
        const track = tracks.find(item => item.id === button.dataset.detailPlay);
        if (track) playTrack(track);
      }));
      detail.querySelectorAll("[data-detail-remove]").forEach(button => button.addEventListener("click", async () => {
        const response = await fetch(`/api/spotify/playlists/${encodeURIComponent(playlist.id)}/tracks/${encodeURIComponent(button.dataset.detailRemove)}`, { method: "DELETE", credentials: "same-origin" });
        if (response.ok) loadPlaylist(playlist.id);
      }));
      detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };

    const formatDuration = ms => {
      const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
      return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
    };

    document.addEventListener("click", event => {
      const button = event.target.closest?.("[data-playlist]");
      if (!button || !playlistsEl.contains(button)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      loadPlaylist(button.dataset.playlist);
    }, true);
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
