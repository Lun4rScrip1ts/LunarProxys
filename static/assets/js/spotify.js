(() => {
  const searchInput = document.getElementById("spotify-search");
  const searchButton = document.getElementById("spotify-search-button");
  const clearButton = document.getElementById("spotify-clear");
  const status = document.getElementById("spotify-status");
  const results = document.getElementById("spotify-results");
  const resultsTitle = document.getElementById("spotify-results-title");
  const resultsCount = document.getElementById("spotify-results-count");
  const open = document.getElementById("open-spotify");
  const floating = document.getElementById("spotify-floating-player");
  const floatingFrame = document.getElementById("spotify-floating-frame");
  const floatingLabel = document.getElementById("spotify-floating-label");
  const playlistsEl = document.getElementById("spotify-playlists");
  if (!results) return;

  let selectedType = "track";
  let searchTimer = null;
  let controller = null;
  let currentTrack = null;
  let playlists = [];

  const escapeHtml = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
  const imageUrl = item => item?.images?.[0]?.url || item?.album?.images?.[0]?.url || "";
  const artistNames = item => (item?.artists || []).map(artist => artist.name).join(", ");
  const formatDuration = ms => { const total = Math.max(0, Math.floor(Number(ms || 0) / 1000)); return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`; };
  const setStatus = text => { if (status) status.textContent = text; };
  const resultImage = url => url ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="spotify-result-placeholder"><i class="fa-brands fa-spotify"></i></span>`;

  const parseSpotify = raw => {
    try {
      const url = new URL(String(raw).trim());
      if (!/^(open\.)?spotify\.com$/i.test(url.hostname)) return null;
      const parts = url.pathname.split("/").filter(Boolean);
      if (!["track", "album", "playlist", "artist", "show", "episode"].includes(parts[0]) || !parts[1]) return null;
      return { type: parts[0], id: parts[1] };
    } catch { return null; }
  };

  const embedUrl = (type, id) => `https://open.spotify.com/embed/${encodeURIComponent(type)}/${encodeURIComponent(id)}?utm_source=lunar&theme=0`;

  const showPlayer = (type, id, label, track = null) => {
    if (!id || !floating || !floatingFrame) return;
    currentTrack = track;
    floatingFrame.src = embedUrl(type, id);
    floatingLabel.textContent = label || "Spotify";
    floating.hidden = false;
    localStorage.setItem("lunarSpotifyLast", JSON.stringify({ type, id, label: label || "Spotify", track }));
    setStatus("Player opened. You can drag it anywhere on the page; Spotify's controls include volume.");
  };

  const renderTrack = track => `
    <div class="spotify-result-card spotify-track-result" data-track-id="${escapeHtml(track.id)}">
      <button class="spotify-result-open" type="button" data-play-type="track" data-play-id="${escapeHtml(track.id)}" data-play-label="${escapeHtml(track.name)} — ${escapeHtml(artistNames(track))}">
        <span class="spotify-result-art">${resultImage(imageUrl(track))}</span>
        <span class="spotify-result-main"><strong>${escapeHtml(track.name)}</strong><small>${escapeHtml(artistNames(track))} · ${escapeHtml(track.album?.name || "")}</small></span>
        <span class="spotify-result-duration">${formatDuration(track.duration_ms)}</span>
      </button>
      <div class="spotify-result-actions">
        <button class="spotify-icon-button" type="button" title="Add to playlist" data-add-track="${escapeHtml(track.id)}"><i class="fa-solid fa-plus"></i></button>
        <button class="spotify-result-play" type="button" title="Play" data-play-type="track" data-play-id="${escapeHtml(track.id)}" data-play-label="${escapeHtml(track.name)} — ${escapeHtml(artistNames(track))}"><i class="fa-solid fa-play"></i></button>
      </div>
    </div>`;

  const renderSimple = (item, type, sub) => `<button class="spotify-result-card spotify-simple-result" type="button" data-play-type="${escapeHtml(type)}" data-play-id="${escapeHtml(item.id)}" data-play-label="${escapeHtml(item.name)}"><span class="spotify-result-art">${resultImage(imageUrl(item))}</span><span class="spotify-result-main"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(sub)}</small></span><span class="spotify-result-play"><i class="fa-solid fa-play"></i></span></button>`;

  const renderResults = data => {
    let groups = [];
    if (selectedType === "track") groups = (data.tracks || []).map(renderTrack);
    if (selectedType === "album") groups = (data.albums || []).map(item => renderSimple(item, "album", `${artistNames(item)} · Album`));
    if (selectedType === "artist") groups = (data.artists || []).map(item => renderSimple(item, "artist", "Artist"));
    if (selectedType === "playlist") groups = (data.playlists || []).map(item => renderSimple(item, "playlist", `${item.owner?.display_name || "Spotify"} · Playlist`));
    results.innerHTML = groups.length ? groups.join("") : `<div class="spotify-results-empty"><i class="fa-solid fa-magnifying-glass"></i><strong>No results found</strong><span>Try a different search.</span></div>`;
    results.querySelectorAll("[data-play-type]").forEach(button => button.addEventListener("click", () => showPlayer(button.dataset.playType, button.dataset.playId, button.dataset.playLabel, selectedType === "track" ? (data.tracks || []).find(item => item.id === button.dataset.playId) : null)));
    results.querySelectorAll("[data-add-track]").forEach(button => button.addEventListener("click", () => choosePlaylistForTrack((data.tracks || []).find(item => item.id === button.dataset.addTrack))));
    if (resultsCount) resultsCount.textContent = `${groups.length} result${groups.length === 1 ? "" : "s"}`;
  };

  const search = async () => {
    const q = String(searchInput?.value || "").trim();
    if (!q) { setStatus("Enter a song, artist, album, or playlist to search."); searchInput?.focus(); return; }
    controller?.abort(); controller = new AbortController(); searchButton?.classList.add("is-loading");
    resultsTitle.textContent = `Results for “${q}”`; resultsCount.textContent = "Searching…";
    results.innerHTML = `<div class="spotify-results-empty"><i class="fa-solid fa-spinner fa-spin"></i><strong>Searching Spotify…</strong><span>Finding matching music.</span></div>`;
    try {
      const response = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}&type=${encodeURIComponent(selectedType)}&limit=10`, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Spotify search failed.");
      renderResults(data); setStatus("Select a song to open the floating player, or use + to save it to a playlist.");
    } catch (error) {
      if (error.name === "AbortError") return;
      results.innerHTML = `<div class="spotify-results-empty spotify-results-error"><i class="fa-solid fa-circle-exclamation"></i><strong>Search unavailable</strong><span>${escapeHtml(error.message)}</span></div>`;
      resultsCount.textContent = "Search failed"; setStatus(error.message);
    } finally { searchButton?.classList.remove("is-loading"); }
  };

  async function loadPlaylists() {
    if (!playlistsEl) return;
    try {
      const response = await fetch("/api/spotify/playlists", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Log in to use Lunar playlists.");
      playlists = data.playlists || [];
      renderPlaylists();
    } catch (error) {
      playlistsEl.innerHTML = `<div class="spotify-results-empty"><i class="fa-solid fa-lock"></i><strong>Sign in to save playlists</strong><span>${escapeHtml(error.message)}</span></div>`;
    }
  }

  function renderPlaylists() {
    if (!playlistsEl) return;
    if (!playlists.length) { playlistsEl.innerHTML = `<div class="spotify-results-empty spotify-playlists-empty"><i class="fa-solid fa-list"></i><strong>No playlists yet</strong><span>Create one, then use + on any song to add it.</span></div>`; return; }
    playlistsEl.innerHTML = playlists.map(playlist => `<article class="spotify-playlist-card"><button class="spotify-playlist-main" type="button" data-playlist="${escapeHtml(playlist.id)}"><span class="spotify-playlist-art"><i class="fa-solid fa-music"></i></span><span><strong>${escapeHtml(playlist.name)}</strong><small>${playlist.tracks?.length || 0} song${playlist.tracks?.length === 1 ? "" : "s"}</small></span></button><button class="spotify-icon-button" type="button" title="Delete playlist" data-delete-playlist="${escapeHtml(playlist.id)}"><i class="fa-solid fa-trash"></i></button></article>`).join("");
    playlistsEl.querySelectorAll("[data-playlist]").forEach(button => button.addEventListener("click", () => playPlaylist(button.dataset.playlist)));
    playlistsEl.querySelectorAll("[data-delete-playlist]").forEach(button => button.addEventListener("click", () => deletePlaylist(button.dataset.deletePlaylist)));
  }

  async function createPlaylist() {
    const modal = document.getElementById("spotify-playlist-modal"); const name = document.getElementById("spotify-playlist-name");
    if (!modal || !name) return; modal.hidden = false; name.value = ""; document.getElementById("spotify-playlist-description").value = ""; name.focus();
  }
  async function saveNewPlaylist() {
    const name = document.getElementById("spotify-playlist-name").value.trim(); const description = document.getElementById("spotify-playlist-description").value.trim();
    if (!name) return;
    const response = await fetch("/api/spotify/playlists", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setStatus(data.error || "Could not create playlist."); return; }
    document.getElementById("spotify-playlist-modal").hidden = true; await loadPlaylists(); setStatus(`Created “${name}”.`);
  }
  async function choosePlaylistForTrack(track) {
    if (!track) return;
    await loadPlaylists();
    if (!playlists.length) { await createPlaylist(); window.__lunarPendingTrack = track; return; }
    const choices = playlists.map((item, index) => `${index + 1}. ${item.name}`).join("\n");
    const raw = window.prompt(`Add “${track.name}” to which playlist?\n\n${choices}\n\nEnter a number:`);
    const index = Number(raw) - 1; if (!Number.isInteger(index) || !playlists[index]) return; await addTrack(playlists[index], track);
  }
  async function addTrack(playlist, track) {
    const payload = { id: track.id, uri: track.uri, name: track.name, artists: artistNames(track), album: track.album?.name || "", image: imageUrl(track), duration_ms: track.duration_ms };
    const response = await fetch(`/api/spotify/playlists/${encodeURIComponent(playlist.id)}/tracks`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ track: payload }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setStatus(data.error || "Could not save song."); return; }
    await loadPlaylists(); setStatus(`Added “${track.name}” to “${playlist.name}”.`);
  }
  async function deletePlaylist(id) {
    if (!confirm("Delete this Lunar playlist?")) return;
    await fetch(`/api/spotify/playlists/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "same-origin" }); await loadPlaylists();
  }
  function playPlaylist(id) { const playlist = playlists.find(item => item.id === id); const first = playlist?.tracks?.[0]; if (!first) { setStatus("That playlist is empty."); return; } showPlayer("track", first.id, `${first.name} — ${first.artists}`, first); }

  document.querySelectorAll(".spotify-filter").forEach(button => button.addEventListener("click", () => { document.querySelectorAll(".spotify-filter").forEach(item => item.classList.remove("active")); button.classList.add("active"); selectedType = button.dataset.type || "track"; if (searchInput?.value.trim()) search(); }));
  searchButton?.addEventListener("click", search);
  searchInput?.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); search(); } });
  searchInput?.addEventListener("input", () => { clearButton.hidden = !searchInput.value; clearTimeout(searchTimer); if (searchInput.value.trim().length >= 2) searchTimer = setTimeout(search, 450); });
  clearButton?.addEventListener("click", () => { searchInput.value = ""; clearButton.hidden = true; resultsTitle.textContent = "Discover"; resultsCount.textContent = "Search results will appear here"; results.innerHTML = `<div class="spotify-results-empty"><i class="fa-solid fa-music"></i><strong>Search the Spotify catalog</strong><span>Your results will show up here.</span></div>`; setStatus("Try searching for a song or artist."); searchInput.focus(); });
  open?.addEventListener("click", () => window.open("https://open.spotify.com/", "_blank", "noopener,noreferrer"));
  document.getElementById("spotify-create-playlist")?.addEventListener("click", createPlaylist);
  document.getElementById("spotify-save-playlist")?.addEventListener("click", async () => { await saveNewPlaylist(); const pending = window.__lunarPendingTrack; if (pending) { window.__lunarPendingTrack = null; await loadPlaylists(); if (playlists[playlists.length - 1]) await addTrack(playlists[playlists.length - 1], pending); } });
  document.querySelectorAll("[data-close-spotify-modal]").forEach(item => item.addEventListener("click", () => { document.getElementById("spotify-playlist-modal").hidden = true; window.__lunarPendingTrack = null; }));
  document.getElementById("spotify-refresh-playlists")?.addEventListener("click", loadPlaylists);
  document.querySelectorAll(".spotify-preset").forEach(button => button.addEventListener("click", () => { const parsed = parseSpotify(button.dataset.spotify); if (parsed) showPlayer(parsed.type, parsed.id, button.dataset.label || "Spotify playlist"); }));

  document.getElementById("spotify-close-player")?.addEventListener("click", () => { floating.hidden = true; floatingFrame.src = "about:blank"; });
  document.getElementById("spotify-minimize")?.addEventListener("click", () => floating?.classList.toggle("is-minimized"));
  document.getElementById("spotify-popout")?.addEventListener("click", () => { if (floatingFrame?.src) window.open(floatingFrame.src, "lunarSpotifyPlayer", "popup,width=420,height=620,resizable=yes"); });

  const handle = document.getElementById("spotify-drag-handle");
  let drag = null;
  handle?.addEventListener("pointerdown", event => { if (event.target.closest("button")) return; const rect = floating.getBoundingClientRect(); drag = { dx: event.clientX - rect.left, dy: event.clientY - rect.top }; handle.setPointerCapture(event.pointerId); });
  handle?.addEventListener("pointermove", event => { if (!drag) return; const width = floating.offsetWidth; const height = floating.offsetHeight; const x = Math.min(Math.max(8, event.clientX - drag.dx), window.innerWidth - width - 8); const y = Math.min(Math.max(8, event.clientY - drag.dy), window.innerHeight - height - 8); floating.style.left = `${x}px`; floating.style.top = `${y}px`; floating.style.right = "auto"; floating.style.bottom = "auto"; });
  handle?.addEventListener("pointerup", () => { if (!drag) return; drag = null; localStorage.setItem("lunarSpotifyPosition", JSON.stringify({ left: floating.style.left, top: floating.style.top })); });
  try { const pos = JSON.parse(localStorage.getItem("lunarSpotifyPosition") || "null"); if (pos?.left && pos?.top) { floating.style.left = pos.left; floating.style.top = pos.top; floating.style.right = "auto"; floating.style.bottom = "auto"; } } catch {}

  loadPlaylists();
})();
