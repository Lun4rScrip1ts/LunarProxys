(() => {
  const player = document.getElementById("spotify-floating-player");
  const body = player?.querySelector(".spotify-floating-body");
  const popout = document.getElementById("spotify-popout");
  const close = document.getElementById("spotify-close-player");
  const label = document.getElementById("spotify-floating-label");
  if (!player || !body) return;

  let host = document.getElementById("spotify-floating-frame");
  if (!host) return;

  // Convert the old iframe element into the host element expected by Spotify's iFrame API.
  if (host.tagName === "IFRAME") {
    const replacement = document.createElement("div");
    replacement.id = host.id;
    replacement.className = "spotify-floating-frame-host";
    host.replaceWith(replacement);
    host = replacement;
  }

  let controller = null;
  let controllerPromise = null;
  let queue = [];
  let queueIndex = -1;
  let lastAdvanceUri = "";
  let poppedOut = false;
  let savedPosition = null;

  const uriFor = track => track?.uri || (track?.id ? `spotify:track:${track.id}` : "");
  const titleFor = track => `${track?.name || "Spotify"}${track?.artists ? ` — ${track.artists}` : ""}`;
  const setLabel = track => { if (label) label.textContent = titleFor(track); };

  const getApi = () => {
    if (window.__lunarSpotifyIframeApiPromise) return window.__lunarSpotifyIframeApiPromise;
    window.__lunarSpotifyIframeApiPromise = new Promise(resolve => {
      const previous = window.onSpotifyIframeApiReady;
      window.onSpotifyIframeApiReady = api => {
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
      controllerPromise = getApi().then(api => new Promise(resolve => {
        const uri = uriFor(track);
        if (!api || !uri) return resolve(null);
        try {
          api.createController(host, { width: "100%", height: "152", uri }, created => {
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
    lastAdvanceUri = "";
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
    playIndex(queueIndex, true);
  };

  // Search-result play buttons. Capture this before spotify.js's old direct-iframe handler.
  document.addEventListener("click", event => {
    const button = event.target.closest?.("[data-play-type]");
    if (!button || button.closest("#spotify-floating-player")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (button.dataset.playType !== "track") return;
    const raw = button.dataset.playLabel || "Spotify";
    const separator = raw.indexOf(" — ");
    const track = {
      id: button.dataset.playId,
      uri: `spotify:track:${button.dataset.playId}`,
      name: separator >= 0 ? raw.slice(0, separator) : raw,
      artists: separator >= 0 ? raw.slice(separator + 3) : ""
    };
    window.lunarSpotifyPlayTrack(track, [track], 0);
  }, true);

  // Playlist-detail play buttons use the complete playlist as the queue.
  document.addEventListener("click", event => {
    const button = event.target.closest?.("[data-detail-play]");
    if (!button) return;
    const tracks = window.__lunarSpotifyPlaylistTracks || [];
    const index = tracks.findIndex(track => String(track.id) === String(button.dataset.detailPlay));
    const track = tracks[index];
    if (!track) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.lunarSpotifyPlayTrack(track, tracks, index);
  }, true);

  // Quick picks can still use the Spotify Embed, but they don't get a Lunar playlist queue.
  document.addEventListener("click", event => {
    const button = event.target.closest?.(".spotify-preset[data-spotify]");
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const match = String(button.dataset.spotify || "").match(/spotify\.com\/(playlist|album|artist|track)\/([^/?#]+)/i);
    if (!match) return;
    const type = match[1].toLowerCase();
    const id = match[2];
    const track = { id, uri: `spotify:${type}:${id}`, name: button.dataset.label || "Spotify", artists: "" };
    player.hidden = false;
    setLabel(track);
    createController(track).then(embed => {
      if (!embed) return;
      try { embed.loadEntity(track.uri); embed.play(); } catch {}
    });
  }, true);

  const setPopout = enabled => {
    poppedOut = Boolean(enabled);
    player.classList.toggle("spotify-frameless-popout", poppedOut);
    if (poppedOut) {
      savedPosition = {
        left: player.style.left,
        top: player.style.top,
        right: player.style.right,
        bottom: player.style.bottom
      };
      player.style.left = "50%";
      player.style.top = "50%";
      player.style.right = "auto";
      player.style.bottom = "auto";
      player.style.transform = "translate(-50%, -50%)";
    } else {
      player.style.transform = "";
      if (savedPosition) {
        player.style.left = savedPosition.left;
        player.style.top = savedPosition.top;
        player.style.right = savedPosition.right || "22px";
        player.style.bottom = savedPosition.bottom || "22px";
      }
    }
    popout?.setAttribute("aria-pressed", String(poppedOut));
    popout?.setAttribute("title", poppedOut ? "Restore floating player" : "Pop out player");
    const icon = popout?.querySelector("i");
    if (icon) icon.className = poppedOut ? "fa-solid fa-down-left-and-up-right-to-center" : "fa-solid fa-up-right-from-square";
  };

  popout?.addEventListener("click", event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    setPopout(!poppedOut);
  }, true);

  close?.addEventListener("click", event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    player.hidden = true;
    setPopout(false);
    try { controller?.pause(); } catch {}
  }, true);

  window.addEventListener("keydown", event => {
    if (event.key === "Escape" && poppedOut && !player.hidden) setPopout(false);
  });

  window.addEventListener("resize", () => {
    if (!poppedOut) return;
    player.style.left = "50%";
    player.style.top = "50%";
    player.style.right = "auto";
    player.style.bottom = "auto";
  });
})();
