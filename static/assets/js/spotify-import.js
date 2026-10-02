(() => {
  const library = document.getElementById("spotify-playlists");
  if (!library) return;

  const parsePlaylistUrl = raw => {
    try {
      const url = new URL(String(raw || "").trim());
      if (!/^(open\.)?spotify\.com$/i.test(url.hostname)) return null;
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] !== "playlist" || !parts[1]) return null;
      return { id: parts[1], url: `https://open.spotify.com/playlist/${parts[1]}` };
    } catch { return null; }
  };

  const status = text => window.dispatchEvent(new CustomEvent("lunar:toast", { detail: text }));

  function openImportedPlaylist(playlist) {
    if (!playlist?.spotifyId) return;
    const label = playlist.name || "Spotify playlist";
    const embed = `https://open.spotify.com/embed/playlist/${encodeURIComponent(playlist.spotifyId)}?utm_source=lunar&theme=0`;

    const pagePlayer = document.getElementById("spotify-floating-player");
    const pageFrame = document.getElementById("spotify-floating-frame");
    if (pagePlayer && pageFrame) {
      pageFrame.src = embed;
      const pageLabel = document.getElementById("spotify-floating-label");
      if (pageLabel) pageLabel.textContent = label;
      pagePlayer.hidden = false;
      try { localStorage.setItem("lunarSpotifyLast", JSON.stringify({ type: "playlist", id: playlist.spotifyId, label })); } catch {}
      return;
    }

    const globalPlayer = document.getElementById("lunar-global-spotify-player");
    if (globalPlayer?.__load) globalPlayer.__load("playlist", playlist.spotifyId, label);
  }

  let currentPlaylists = [];

  function decorateImportedCards() {
    const imported = new Map();
    currentPlaylists.forEach(item => { if (item?.source === "spotify" && item.spotifyId) imported.set(String(item.id), item); });
    library.querySelectorAll("[data-playlist]").forEach(button => {
      const playlist = imported.get(String(button.dataset.playlist));
      if (!playlist) return;
      const card = button.closest(".spotify-playlist-card");
      if (!card) return;
      const small = button.querySelector("small");
      if (small) small.textContent = "Spotify playlist · imported";
      card.classList.add("spotify-imported-playlist");
      button.setAttribute("title", "Open imported Spotify playlist");
    });
  }

  async function refreshImportedState() {
    try {
      const response = await fetch("/api/spotify/playlists", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        currentPlaylists = Array.isArray(data.playlists) ? data.playlists : [];
        decorateImportedCards();
      }
    } catch {}
  }

  function interceptImportedClicks(event) {
    const button = event.target.closest?.("[data-playlist]");
    if (!button || !library.contains(button)) return;
    const playlist = currentPlaylists.find(item => String(item.id) === String(button.dataset.playlist));
    if (!playlist?.spotifyId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openImportedPlaylist(playlist);
  }

  function createModal() {
    if (document.getElementById("spotify-import-modal")) return document.getElementById("spotify-import-modal");
    const modal = document.createElement("div");
    modal.id = "spotify-import-modal";
    modal.className = "spotify-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="spotify-modal-backdrop" data-close-spotify-import></div>
      <div class="spotify-modal-card" role="dialog" aria-modal="true" aria-labelledby="spotify-import-title">
        <button class="spotify-modal-close" type="button" data-close-spotify-import aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
        <span class="spotify-kicker"><i class="fa-brands fa-spotify"></i> SPOTIFY IMPORT</span>
        <h2 id="spotify-import-title">Import a Spotify playlist</h2>
        <p>Paste a Spotify playlist link. Lunar will save the link to your account and open it with Spotify's official embedded player.</p>
        <label>Playlist name<input id="spotify-import-name" maxlength="80" placeholder="My Spotify playlist"></label>
        <label>Spotify playlist link<input id="spotify-import-url" type="url" inputmode="url" placeholder="https://open.spotify.com/playlist/..."></label>
        <div id="spotify-import-error" class="spotify-import-error" hidden></div>
        <div class="spotify-modal-actions"><button class="spotify-secondary" type="button" data-close-spotify-import>Cancel</button><button id="spotify-import-submit" class="spotify-primary" type="button"><i class="fa-solid fa-download"></i> Import playlist</button></div>
      </div>`;
    document.body.appendChild(modal);

    modal.querySelectorAll("[data-close-spotify-import]").forEach(element => element.addEventListener("click", () => { modal.hidden = true; }));
    modal.querySelector("#spotify-import-url").addEventListener("input", event => {
      const parsed = parsePlaylistUrl(event.target.value);
      const error = modal.querySelector("#spotify-import-error");
      error.hidden = true;
      if (parsed && !modal.querySelector("#spotify-import-name").value.trim()) modal.querySelector("#spotify-import-name").value = "Imported Spotify playlist";
    });
    modal.querySelector("#spotify-import-submit").addEventListener("click", async () => {
      const url = modal.querySelector("#spotify-import-url").value.trim();
      const parsed = parsePlaylistUrl(url);
      const nameInput = modal.querySelector("#spotify-import-name");
      const errorBox = modal.querySelector("#spotify-import-error");
      const submit = modal.querySelector("#spotify-import-submit");
      if (!parsed) { errorBox.textContent = "Enter a valid Spotify playlist link."; errorBox.hidden = false; return; }
      const name = nameInput.value.trim() || "Imported Spotify playlist";
      submit.disabled = true;
      try {
        const response = await fetch("/api/spotify/playlists", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description: "Imported from Spotify", spotifyUrl: parsed.url }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not import playlist.");
        modal.hidden = true;
        status(`Imported “${name}”.`);
        document.getElementById("spotify-refresh-playlists")?.click();
        await refreshImportedState();
        requestAnimationFrame(() => {
          const button = Array.from(library.querySelectorAll("[data-playlist]")).find(item => String(item.dataset.playlist) === String(data.playlist.id));
          button?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      } catch (error) {
        errorBox.textContent = error.message || "Could not import playlist.";
        errorBox.hidden = false;
      } finally { submit.disabled = false; }
    });
    return modal;
  }

  function addImportButton() {
    const heading = document.querySelector(".spotify-library-card .spotify-section-title");
    if (!heading || document.getElementById("spotify-import-playlist")) return;
    const actions = document.createElement("div");
    actions.className = "spotify-heading-actions";
    actions.innerHTML = `<button id="spotify-import-playlist" class="spotify-secondary" type="button"><i class="fa-brands fa-spotify"></i> Import from Spotify</button>`;
    heading.appendChild(actions);
    actions.querySelector("button").addEventListener("click", () => {
      const modal = createModal();
      modal.hidden = false;
      const url = modal.querySelector("#spotify-import-url");
      const name = modal.querySelector("#spotify-import-name");
      url.value = ""; name.value = ""; modal.querySelector("#spotify-import-error").hidden = true;
      setTimeout(() => url.focus(), 0);
    });
  }

  addImportButton();
  library.addEventListener("click", interceptImportedClicks, true);
  new MutationObserver(decorateImportedCards).observe(library, { childList: true, subtree: true });
  refreshImportedState();
})();
