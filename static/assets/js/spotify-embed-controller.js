(() => {
  const player = document.getElementById("spotify-floating-player");
  const body = player?.querySelector(".spotify-floating-body");
  const label = document.getElementById("spotify-floating-label");
  const popout = document.getElementById("spotify-popout");
  const close = document.getElementById("spotify-close-player");
  if (!player || !body) return;

  let host = document.getElementById("spotify-floating-frame");
  if (!host) return;

  // The iFrame API replaces a DOM element with Spotify's official embed iframe.
  if (host.tagName === "IFRAME") {
    const replacement = document.createElement("div");
    replacement.id = host.id;
    replacement.className = "spotify-floating-frame-host";
    host.replaceWith(replacement);
    host = replacement;
  }

  let iframeApi = null;
  let controller = null;
  let controllerPromise = null;
  let queue = [];
  let queueIndex = -1;
  let lastAdvanceUri = "";
  let isPopout = false;
  let savedPosition = null;

  const uriFor = track => track?.uri || (track?.id ? `spotify:track:${track.id}` : "");
  const titleFor = track => `${track?.name || "Spotify"}${track?.artists ? ` — ${track.artists}` : ""}`;
  const setLabel = track => { if (label) label.textContent = titleFor(track); };

  const loadApi = () => {
    if (window.__lunarSpotifyIframeApiPromise) return window.__lunarSpotifyIframeApiPromise;
    window.__lunarSpotifyIframeApiPromise = new Promise(resolve => {
      const previous = window.onSpotifyIframeApiReady;
      window.onSpotifyIframeApiReady = api => {
        iframeApi = api;
        try { previous?.(api); } catch {}
        resolve(api);
      };
      const script = document.createElement("script");
      script.src = "https://open.spotify.com/embed/iframe-api/v1";
      script.async = true;
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    });
    return window.__lunarSpotifyIframeApiPromise;
  };

  const createController = async track => {
    if (controller) return controller;
    if (!controllerPromise) {
      controllerPromise = loadApi().then(api => new Promise(resolve => {
        if (!api) return resolve(null);
        iframeApi = api;
        const uri = uriFor(track);
        if (!uri) return resolve(null);
        try {
          api.createController(host, {
            width: "100%",
            height: "152",
            uri
          }, created => {
            controller = created;
            created.addListener("playback_started", event => {
              const playingUri = event?.data?.playingURI || "";
              if (playingUri) {
                const index = queue.findIndex(item => uriFor(item) === playingUri);
                if (index >= 0) {
                  queueIndex = index;
                  setLabel(queue[index]);
                }
              }
              lastAdvanceUri = "";
            });
            created.addListener("playback_update", event => {
              const data = event?.data || {};
              const duration = Number(data.duration || 0);
              const position = Number(data.position || 0);
              const playingUri = data.playingURI || "";
              if (!playingUri || !duration || data.isPaused || data.isBuffering) return;
              if (position < duration - 1200) return;
              if (lastAdvanceUri === playingUri) return;
              lastAdvanceUri = playingUri;
              if (queueIndex >= 0 && queueIndex < queue.length - 1) {
                window.setTimeout(() => playIndex(queueIndex + 1, true), 250);
              }
            });
            resolve(created);
          });
        } catch {
          resolve(null);
        }
      }));
    }
    return controllerPromise;
  };

  const playIndex = async (index, autoplay = true) => {
    const track = queue[index];
    if (!track?.id) return;
    queueIndex = index;
    setLabel(track);
    player.hidden = false;
    localStorage.setItem("lunarSpotifyLast", JSON.stringify({ type: "track", id: track.id, label: titleFor(track), track }));
    const embed = await createController(track);
    if (!embed) return;
    try {
      embed.loadEntity(uriFor(track));
      if (autoplay) window.setTimeout(() => { try { embed.play(); } catch {} }, 150);
    } catch {}
  };

  window.lunarSpotifyPlayTrack = (track, tracks = [track], index = 0) => {
    queue = Array.isArray(tracks) && tracks.length ? tracks.slice() : [track];
    queueIndex = Math.max(0, Math.min(Number(index) || 0, queue.length - 1));
    lastAdvanceUri = "";
    playIndex(queueIndex, true);
  };

  const openSimpleTrack = button => {
    const id = button.dataset.playId;
    if (!id) return;
    const labelText = button.dataset.playLabel || "Spotify";
    const dash = labelText.indexOf(" — ");
    const track = {
      id,
      uri: `spotify:track:${id}`,
      name: dash >= 0 ? labelText.slice(0, dash) : labelText,
      artists: dash >= 0 ? labelText.slice(dash + 3) : ""
    };
    window.lunarSpotifyPlayTrack(track, [track], 0);
  };

  // Replace the old direct iframe handlers with the iFrame API controller.
  document.addEventListener("click", event => {
    const button = event.target.closest?.("[data-play-type]");
    if (!button) return;
    if (button.closest("#spotify-floating-player")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (button.dataset.playType === "track") openSimpleTrack(button);
  }, true);

  document.addEventListener("click", event => {
    const button = event.target.closest?.("[data-detail-play]");
    if (!button) return;
    const row = button.closest(".spotify-playlist-track");
    if (!row) return;
    // playlist-detail.js exposes the complete queue on the selected detail view.
    const tracks = window.__lunarSpotifyPlaylistTracks || [];
    const index = tracks.findIndex(track => String(track.id) === String(button.dataset.detailPlay));
    const track = tracks[index];
    if (!track) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.lunarSpotifyPlayTrack(track, tracks, index);
  }, true);

  document.addEventListener("click", event => {
    const button = event.target.closest?.(".spotify-preset[data-spotify]");
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const raw = button.dataset.spotify || "";
    const match = raw.match(/spotify\.com\/(playlist|album|artist|track)\/([^/?#]+)/i);
    if (!match) return;
    const type = match[1].toLowerCase();
    const id = match[2];
    const uri = `spotify:${type}:${id}`;
    const track = { id, uri, name: button.dataset.label || "Spotify", artists: "" };
    if (type === "track") window.lunarSpotifyPlayTrack(track, [track], 0);
    else {
      player.hidden = false;
      setLabel(track);
      createController(track).then(embed => {
        if (!embed) return;
        try { embed.loadEntity(uri); embed.play(); } catch {}
      });
    }
  }, true);

  const togglePopout = () => {
    isPopout = !isPopout;
    if (isPopout) {
      savedPosition = { left: player.style.left, top: player.style.top, right: player.style.right, bottom: player.style.bottom };
      player.classList.add("is-popout");
      player.style.left = "50%";
      player.style.top = "50%";
      player.style.right = "auto";
      player.style.bottom = "auto";
      player.style.transform = "translate(-50%, -50%)";
      popout?.setAttribute("aria-label", "Restore player");
      popout?.setAttribute("title", "Restore player");
    } else {
      player.classList.remove("is-popout");
      player.style.transform = "";
      if (savedPosition) {
        player.style.left = savedPosition.left;
        player.style.top = savedPosition.top;
        player.style.right = savedPosition.right || "22px";
        player.style.bottom = savedPosition.bottom || "22px";
      }
      popout?.setAttribute("aria-label", "Pop out player");
      popout?.setAttribute("title", "Pop out player");
    }
  };

  popout?.addEventListener("click", event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    togglePopout();
  }, true);

  close?.addEventListener("click", event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    player.hidden = true;
    player.classList.remove("is-popout");
    isPopout = false;
    try { controller?.pause(); } catch {}
  }, true);

  // If another script has already created a player before this controller loaded,
  // keep the existing embed visible until the first controlled track is selected.
  host.setAttribute("aria-label", "Spotify player");
})();
