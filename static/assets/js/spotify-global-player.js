(() => {
  if (window.__lunarGlobalSpotifyPlayerBooted) return;
  window.__lunarGlobalSpotifyPlayerBooted = true;

  const STATE_KEY = "lunarSpotifyLast";
  const POSITION_KEY = "lunarSpotifyGlobalPlayerPosition";
  const CLOSED_KEY = "lunarSpotifyGlobalPlayerClosed";

  const safeParse = value => {
    try { return JSON.parse(value); } catch { return null; }
  };
  const escapeHtml = value => String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
  const validType = type => ["track", "album", "playlist", "artist", "show", "episode"].includes(type);
  const embedUrl = (type, id) => `https://open.spotify.com/embed/${encodeURIComponent(type)}/${encodeURIComponent(id)}?utm_source=lunar&theme=0`;

  function readPosition() {
    const saved = safeParse(localStorage.getItem(POSITION_KEY) || "null");
    if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.y)) return null;
    return saved;
  }

  function savePosition(element) {
    const rect = element.getBoundingClientRect();
    try { localStorage.setItem(POSITION_KEY, JSON.stringify({ x: rect.left, y: rect.top })); } catch {}
  }

  function clampPosition(element, x, y) {
    const margin = 8;
    const width = element.offsetWidth || 420;
    const height = element.offsetHeight || 210;
    return {
      x: Math.max(margin, Math.min(x, Math.max(margin, window.innerWidth - width - margin))),
      y: Math.max(margin, Math.min(y, Math.max(margin, window.innerHeight - height - margin)))
    };
  }

  function applyPosition(element, position) {
    const rect = clampPosition(element, position.x, position.y);
    element.style.left = `${rect.x}px`;
    element.style.top = `${rect.y}px`;
    element.style.right = "auto";
    element.style.bottom = "auto";
  }

  function create() {
    if (document.getElementById("lunar-global-spotify-player")) return document.getElementById("lunar-global-spotify-player");

    const player = document.createElement("section");
    player.id = "lunar-global-spotify-player";
    player.setAttribute("aria-label", "Lunar Spotify player");
    player.innerHTML = `
      <div class="lunar-global-spotify-head" id="lunar-global-spotify-drag">
        <div class="lunar-global-spotify-title"><i class="fa-brands fa-spotify"></i><span id="lunar-global-spotify-label">Spotify</span></div>
        <div class="lunar-global-spotify-actions">
          <button type="button" id="lunar-global-spotify-popout" title="Open player window" aria-label="Open player window"><i class="fa-solid fa-up-right-from-square"></i></button>
          <button type="button" id="lunar-global-spotify-hide" title="Hide player" aria-label="Hide player"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>
      <div class="lunar-global-spotify-body"><iframe id="lunar-global-spotify-frame" title="Spotify player" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe></div>
      <div class="lunar-global-spotify-foot"><span><i class="fa-solid fa-grip-lines"></i> Drag anywhere</span><small>Spotify controls include volume.</small></div>
    `;
    document.body.appendChild(player);

    const savedPosition = readPosition();
    if (savedPosition) applyPosition(player, savedPosition);

    const frame = player.querySelector("#lunar-global-spotify-frame");
    const label = player.querySelector("#lunar-global-spotify-label");
    const drag = player.querySelector("#lunar-global-spotify-drag");
    const hide = player.querySelector("#lunar-global-spotify-hide");
    const popout = player.querySelector("#lunar-global-spotify-popout");

    hide.addEventListener("click", event => {
      event.stopPropagation();
      player.hidden = true;
      try { localStorage.setItem(CLOSED_KEY, "1"); } catch {}
    });

    popout.addEventListener("click", event => {
      event.stopPropagation();
      if (!frame.src) return;
      window.open(frame.src, "lunarSpotifyPlayer", "popup,width=430,height=650,resizable=yes");
    });

    let dragState = null;
    let raf = 0;
    let pending = null;
    const move = event => {
      if (!dragState) return;
      pending = event;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!dragState || !pending) return;
        const x = pending.clientX - dragState.dx;
        const y = pending.clientY - dragState.dy;
        applyPosition(player, { x, y });
      });
    };
    const end = () => {
      if (!dragState) return;
      dragState = null;
      drag.classList.remove("is-dragging");
      savePosition(player);
    };

    drag.addEventListener("pointerdown", event => {
      if (event.target.closest("button")) return;
      const rect = player.getBoundingClientRect();
      dragState = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
      drag.classList.add("is-dragging");
      drag.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });
    drag.addEventListener("pointermove", move, { passive: true });
    drag.addEventListener("pointerup", end);
    drag.addEventListener("pointercancel", end);
    window.addEventListener("resize", () => {
      const rect = player.getBoundingClientRect();
      applyPosition(player, { x: rect.left, y: rect.top });
      savePosition(player);
    }, { passive: true });

    player.__load = (type, id, text) => {
      if (!validType(type) || !id) return;
      frame.src = embedUrl(type, id);
      label.textContent = text || "Spotify";
      player.hidden = false;
      try { localStorage.removeItem(CLOSED_KEY); } catch {}
    };
    return player;
  }

  function restore() {
    if (!document.body) return;
    const state = safeParse(localStorage.getItem(STATE_KEY) || "null");
    if (!state || !validType(state.type) || !state.id) return;
    if (localStorage.getItem(CLOSED_KEY) === "1") return;
    const player = create();
    player.__load(state.type, state.id, state.label || "Spotify");
  }

  function boot() {
    // The Spotify page has its own richer player. The global player is used on every other Lunar page.
    if (document.body.classList.contains("lunar-spotify-page")) return;
    restore();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
