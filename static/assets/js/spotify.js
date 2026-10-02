(() => {
  const frame = document.getElementById("spotify-frame");
  const empty = document.getElementById("spotify-empty");
  const searchInput = document.getElementById("spotify-search");
  const searchButton = document.getElementById("spotify-search-button");
  const clearButton = document.getElementById("spotify-clear");
  const status = document.getElementById("spotify-status");
  const results = document.getElementById("spotify-results");
  const resultsTitle = document.getElementById("spotify-results-title");
  const resultsCount = document.getElementById("spotify-results-count");
  const label = document.getElementById("spotify-current-label");
  const open = document.getElementById("open-spotify");
  if (!frame || !results) return;

  let selectedType = "track";
  let searchTimer = null;
  let controller = null;

  const escapeHtml = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const imageUrl = item => item?.images?.[0]?.url || item?.album?.images?.[0]?.url || "";
  const artistNames = item => (item?.artists || []).map(artist => artist.name).join(", ");
  const formatDuration = ms => {
    const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  };

  const setStatus = text => { if (status) status.textContent = text; };

  const parseSpotify = raw => {
    try {
      const url = new URL(String(raw).trim());
      if (!/^(open\.)?spotify\.com$/i.test(url.hostname)) return null;
      const parts = url.pathname.split("/").filter(Boolean);
      const type = parts[0];
      const id = parts[1];
      if (!["track", "album", "playlist", "artist", "show", "episode"].includes(type) || !id) return null;
      return { type, id };
    } catch { return null; }
  };

  const playSpotify = (type, id, display) => {
    if (!id) return;
    frame.src = `https://open.spotify.com/embed/${type}/${encodeURIComponent(id)}?utm_source=generator&theme=0`;
    empty?.setAttribute("hidden", "");
    if (label) label.textContent = display || "Spotify";
    setStatus("Loaded in Spotify's official player.");
    document.querySelector(".spotify-player-card")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const resultImage = url => url
    ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : `<span class="spotify-result-placeholder"><i class="fa-brands fa-spotify"></i></span>`;

  const renderTrack = track => `
    <button class="spotify-result-card spotify-track-result" type="button" data-play-type="track" data-play-id="${escapeHtml(track.id)}" data-play-label="${escapeHtml(track.name)} — ${escapeHtml(artistNames(track))}">
      <span class="spotify-result-art">${resultImage(imageUrl(track))}</span>
      <span class="spotify-result-main"><strong>${escapeHtml(track.name)}</strong><small>${escapeHtml(artistNames(track))} · ${escapeHtml(track.album?.name || "")}</small></span>
      <span class="spotify-result-duration">${formatDuration(track.duration_ms)}</span>
      <span class="spotify-result-play"><i class="fa-solid fa-play"></i></span>
    </button>`;

  const renderAlbum = album => `
    <button class="spotify-result-card" type="button" data-play-type="album" data-play-id="${escapeHtml(album.id)}" data-play-label="${escapeHtml(album.name)}">
      <span class="spotify-result-art">${resultImage(imageUrl(album))}</span>
      <span class="spotify-result-main"><strong>${escapeHtml(album.name)}</strong><small>${escapeHtml(artistNames(album))} · Album</small></span>
      <span class="spotify-result-play"><i class="fa-solid fa-play"></i></span>
    </button>`;

  const renderArtist = artist => `
    <button class="spotify-result-card" type="button" data-play-type="artist" data-play-id="${escapeHtml(artist.id)}" data-play-label="${escapeHtml(artist.name)}">
      <span class="spotify-result-art spotify-artist-art">${resultImage(imageUrl(artist))}</span>
      <span class="spotify-result-main"><strong>${escapeHtml(artist.name)}</strong><small>Artist</small></span>
      <span class="spotify-result-play"><i class="fa-solid fa-play"></i></span>
    </button>`;

  const renderPlaylist = playlist => `
    <button class="spotify-result-card" type="button" data-play-type="playlist" data-play-id="${escapeHtml(playlist.id)}" data-play-label="${escapeHtml(playlist.name)}">
      <span class="spotify-result-art">${resultImage(imageUrl(playlist))}</span>
      <span class="spotify-result-main"><strong>${escapeHtml(playlist.name)}</strong><small>${escapeHtml(playlist.owner?.display_name || "Spotify")} · Playlist</small></span>
      <span class="spotify-result-play"><i class="fa-solid fa-play"></i></span>
    </button>`;

  const renderResults = data => {
    const groups = [];
    const tracks = data.tracks || [];
    const albums = data.albums || [];
    const artists = data.artists || [];
    const playlists = data.playlists || [];

    if (selectedType === "track") tracks.forEach(item => groups.push(renderTrack(item)));
    if (selectedType === "album") albums.forEach(item => groups.push(renderAlbum(item)));
    if (selectedType === "artist") artists.forEach(item => groups.push(renderArtist(item)));
    if (selectedType === "playlist") playlists.forEach(item => groups.push(renderPlaylist(item)));

    results.innerHTML = groups.length
      ? groups.join("")
      : `<div class="spotify-results-empty"><i class="fa-solid fa-magnifying-glass"></i><strong>No results found</strong><span>Try a different search.</span></div>`;

    results.querySelectorAll("[data-play-type]").forEach(card => {
      card.addEventListener("click", () => playSpotify(card.dataset.playType, card.dataset.playId, card.dataset.playLabel));
    });
    if (resultsCount) resultsCount.textContent = `${groups.length} result${groups.length === 1 ? "" : "s"}`;
  };

  const search = async () => {
    const q = String(searchInput?.value || "").trim();
    if (!q) {
      setStatus("Enter a song, artist, album, or playlist to search.");
      searchInput?.focus();
      return;
    }

    controller?.abort();
    controller = new AbortController();
    searchButton?.classList.add("is-loading");
    if (resultsTitle) resultsTitle.textContent = `Results for “${q}”`;
    if (resultsCount) resultsCount.textContent = "Searching…";
    results.innerHTML = `<div class="spotify-results-empty"><i class="fa-solid fa-spinner fa-spin"></i><strong>Searching Spotify…</strong><span>Finding matching music.</span></div>`;
    setStatus("Searching Spotify's catalog…");

    try {
      const response = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}&type=${encodeURIComponent(selectedType)}&limit=10`, {
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Spotify search failed.");
      renderResults(data);
      setStatus("Select a result to open it in Spotify's official player.");
    } catch (error) {
      if (error.name === "AbortError") return;
      results.innerHTML = `<div class="spotify-results-empty spotify-results-error"><i class="fa-solid fa-circle-exclamation"></i><strong>Search unavailable</strong><span>${escapeHtml(error.message)}</span></div>`;
      if (resultsCount) resultsCount.textContent = "Search failed";
      setStatus(error.message);
    } finally {
      searchButton?.classList.remove("is-loading");
    }
  };

  document.querySelectorAll(".spotify-filter").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".spotify-filter").forEach(item => item.classList.remove("active"));
      button.classList.add("active");
      selectedType = button.dataset.type || "track";
      if (searchInput?.value.trim()) search();
    });
  });

  searchButton?.addEventListener("click", search);
  searchInput?.addEventListener("keydown", event => {
    if (event.key === "Enter") { event.preventDefault(); search(); }
  });
  searchInput?.addEventListener("input", () => {
    if (clearButton) clearButton.hidden = !searchInput.value;
    clearTimeout(searchTimer);
    if (searchInput.value.trim().length >= 2) searchTimer = setTimeout(search, 450);
  });
  clearButton?.addEventListener("click", () => {
    searchInput.value = "";
    clearButton.hidden = true;
    resultsTitle.textContent = "Discover";
    resultsCount.textContent = "Search results will appear here";
    results.innerHTML = `<div class="spotify-results-empty"><i class="fa-solid fa-music"></i><strong>Search the Spotify catalog</strong><span>Your results will show up here.</span></div>`;
    setStatus("Try searching for a song or artist.");
    searchInput.focus();
  });

  document.querySelectorAll(".spotify-preset").forEach(button => {
    button.addEventListener("click", () => {
      const parsed = parseSpotify(button.dataset.spotify);
      if (parsed) playSpotify(parsed.type, parsed.id, button.dataset.label || "Spotify playlist");
    });
  });

  open?.addEventListener("click", () => window.open("https://open.spotify.com/", "_blank", "noopener,noreferrer"));
})();
