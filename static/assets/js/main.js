// Theme is applied immediately, to prevent flashing on page load
(() => {
  const themeid = store.get("theme");
  const themes = {
    catppuccinMocha: "/assets/css/themes/catppuccin/mocha.css",
    catppuccinMacchiato: "/assets/css/themes/catppuccin/macchiato.css",
    catppuccinFrappe: "/assets/css/themes/catppuccin/frappe.css",
    catppuccinLatte: "/assets/css/themes/catppuccin/latte.css",
    Inverted: "/assets/css/themes/colors/light.css",
    sky: "/assets/css/themes/colors/sky.css",
    tokyoNight: "/assets/css/themes/colors/tokyo-night.css",
    nord: "/assets/css/themes/colors/nord.css",
    rosePine: "/assets/css/themes/colors/rose-pine.css",
    oled: "/assets/css/themes/colors/oled.css",
    light: "/assets/css/themes/colors/light.css",
    gruvbox: "/assets/css/themes/colors/gruvbox.css",
    gruvboxLight: "/assets/css/themes/colors/gruvbox-light.css",
    everforest: "/assets/css/themes/colors/everforest.css",
    monokai: "/assets/css/themes/colors/monokai.css",
    oneDark: "/assets/css/themes/colors/one-dark.css",
    synthwave: "/assets/css/themes/colors/synthwave.css",
    solarized: "/assets/css/themes/colors/solarized.css",
    solarizedLight: "/assets/css/themes/colors/solarized-light.css",
  };

  if (themes[themeid]) {
    const themeLink = document.createElement("link");
    themeLink.rel = "stylesheet";
    themeLink.href = themes[themeid];
    document.head.appendChild(themeLink);
  } else {
    const customThemeCss = store.getRaw(`t${themeid}`);
    if (customThemeCss) {
      const customThemeStyle = document.createElement("style");
      customThemeStyle.textContent = customThemeCss;
      document.head.appendChild(customThemeStyle);
    }
  }

  const PROXY_KEY = "proxy";
  const ALLOWED = ["uv", "sj"];
  const DEFAULT = "sj";

  function initProxy() {
    const current = store.get(PROXY_KEY);
    if (current === null) {
      store.set(PROXY_KEY, DEFAULT);
      return DEFAULT;
    }
    if (ALLOWED.includes(current)) {
      return current;
    }
    store.set(PROXY_KEY, DEFAULT);
    return DEFAULT;
  }

  window.resolveProxyChoice = initProxy;
  window.resolveProxyChoice();
})();

let isInTabMode;

try {
  isInTabMode = window.top.location.pathname === "/tabs";
} catch {
  try {
    isInTabMode = window.parent.location.pathname === "/tabs";
  } catch {
    isInTabMode = false;
  }
}

function reconstructSafeUrl(raw) {
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = new URL(raw);
    const allowed = ["https:", "http:", "data:"];
    if (!allowed.includes(parsed.protocol)) return null;
    return parsed.href;
  } catch {
    if (typeof raw === "string" && !raw.includes(":")) return raw;
    return null;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Only the original host needs its legacy ad loader.
  if (window.location.hostname === "gointerstellar.app" && !document.getElementById("frame-container")) {
    const ads = document.createElement("script");
    ads.async = true;
    ads.crossOrigin = "anonymous";
    ads.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6840529569014734";
    document.head.appendChild(ads);
  }

  const nav = document.querySelector(".nav-bar");

  if (nav) {
    const themeId = store.get("theme");
    const lightThemes = ["Inverted", "light", "gruvboxLight", "solarizedLight"];
    const html = `
      <div id="icon-container">
        <a class="icon lunar-nav-logo" href="/./" aria-label="Lunar Proxy">LUNAR PROXY</a>
      </div>
      <div class="nav-bar-right">
        
        <a class="navbar-link" href="/./friends"><i class="fa-solid fa-user-group navbar-icon"></i><span>Friends</span></a>
        <a class="navbar-link" href="/./chat"><i class="fa-solid fa-comments navbar-icon"></i><span>Chat</span></a>
        <a class="navbar-link donate-nav-link" href="/./donate"><i class="fa-solid fa-heart navbar-icon"></i><span>Donate</span></a>
        <a class="navbar-link" href="/./games"><i class="fa-solid fa-gamepad navbar-icon"></i><span>Games</span></a>
        <a class="navbar-link" href="/./apps"><i class="fa-solid fa-table-cells navbar-icon"></i><span>Apps</span></a>
        <a class="navbar-link" href="/./settings"><i class="fa-solid fa-gear navbar-icon settings-icon"></i><span>Settings</span></a>
        <a class="navbar-link lunar-account-nav" href="/./account"><i class="fa-solid fa-user navbar-icon"></i><span>Account</span></a>
      </div>`;
    nav.innerHTML = html;

    // Keep the current page highlighted instead of hard-coding Donate as active.
    const currentPath = window.location.pathname.replace(/\/$/, "") || "/";
    nav.querySelectorAll(".navbar-link").forEach(link => {
      try {
        const linkPath = new URL(link.href, window.location.origin).pathname.replace(/\/$/, "") || "/";
        const active = linkPath === currentPath || (currentPath === "/play.html" && linkPath === "/games");
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      } catch {}
    });

    fetch("/api/auth/me", { credentials: "same-origin" })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        const accountLink = document.querySelector(".lunar-account-nav span");
        if (accountLink && data?.user) accountLink.textContent = "Profile";
      })
      .catch(() => {});
  }

  // Restore account-backed settings if this browser/origin does not have them yet.
  // Existing local settings always take priority.
  if (typeof store.loadAccountSettings === "function") {
    store.loadAccountSettings().then(() => {
      if (typeof window.applyLunarSettings === "function") {
        window.applyLunarSettings();
      }
    }).catch(() => {});
  }

  // Favicon and Name Logic
  const icon = document.getElementById("tab-favicon");
  const title = document.getElementById("t");
  const cloakName = store.get("CustomName") || store.get("name");
  const cloakIcon = store.get("CustomIcon") || store.get("icon");
  if (cloakName) title.textContent = cloakName;
  if (cloakIcon) {
    const safeIcon = reconstructSafeUrl(cloakIcon);
    if (safeIcon) icon.setAttribute("href", safeIcon);
  }

  // Event Key Logic
  const eventKey = JSON.parse(store.get("eventKey")) || ["`"];
  const rawPLink = store.get("pLink") || "https://classroom.google.com/";
  const safePLink = reconstructSafeUrl(rawPLink) ?? "https://classroom.google.com/";

  const panicAnchor = document.createElement("a");
  panicAnchor.href = safePLink;
  panicAnchor.style.display = "none";
  document.body.appendChild(panicAnchor);

  let pressedKeys = [];
  document.addEventListener("keydown", event => {
    pressedKeys.push(event.key);
    const recentKeys = pressedKeys.slice(-eventKey.length);
    if (recentKeys.length === eventKey.length && eventKey.every((key, i) => key === recentKeys[i])) {
      panicAnchor.click();
      pressedKeys = [];
    }
  });

  // Background Image Logic
  const savedBackgroundImage = store.get("backgroundImage");
  if (savedBackgroundImage === "none") {
    document.body.style.backgroundImage = "none";
  } else if (savedBackgroundImage) {
    document.body.style.backgroundImage = `url('${savedBackgroundImage}')`;
  }

  // Background effects
  const backgroundEffect = store.get("particles") || "off";
  const effectLayer = document.getElementById("lunar-background-effect");
  if (effectLayer) effectLayer.remove();

  if (backgroundEffect !== "off") {
    const layer = document.createElement("div");
    layer.id = "lunar-background-effect";
    layer.className = `lunar-bg-effect lunar-bg-${backgroundEffect === "true" ? "stars" : backgroundEffect}`;
    document.body.insertBefore(layer, document.body.firstChild);

    if (backgroundEffect === "stars" || backgroundEffect === "true") {
      ["stars", "stars2", "stars3"].forEach(id => {
        if (!document.getElementById(id)) {
          const el = document.createElement("div");
          el.id = id;
          layer.appendChild(el);
        }
      });
    }

    // Make the background feel responsive without affecting clicks or scrolling.
    if (backgroundEffect === "reactive") {
      let rafPending = false;
      let lastX = 50;
      let lastY = 50;
      const updateGlow = () => {
        rafPending = false;
        layer.style.setProperty("--lunar-mx", lastX + "%");
        layer.style.setProperty("--lunar-my", lastY + "%");
      };
      const trackPointer = event => {
        lastX = Math.max(0, Math.min(100, (event.clientX / window.innerWidth) * 100));
        lastY = Math.max(0, Math.min(100, (event.clientY / window.innerHeight) * 100));
        if (!rafPending) {
          rafPending = true;
          requestAnimationFrame(updateGlow);
        }
      };
      window.addEventListener("pointermove", trackPointer, { passive: true });
      layer.style.setProperty("--lunar-mx", "50%");
      layer.style.setProperty("--lunar-my", "50%");
    }
  }

  // Subtle pointer spotlight on interactive surfaces.
  const interactiveSurfaceSelector = ".settings-card,.column,.support-card,.cash-card,.donate-action,.navbar-link";
  let surfaceRaf = false;
  let surfaceEvent = null;
  document.addEventListener("pointermove", event => {
    surfaceEvent = event;
    if (surfaceRaf) return;
    surfaceRaf = true;
    requestAnimationFrame(() => {
      surfaceRaf = false;
      const target = surfaceEvent && surfaceEvent.target;
      const surface = target && target.closest ? target.closest(interactiveSurfaceSelector) : null;
      if (!surface) return;
      const rect = surface.getBoundingClientRect();
      const x = ((surfaceEvent.clientX - rect.left) / rect.width) * 100;
      const y = ((surfaceEvent.clientY - rect.top) / rect.height) * 100;
      surface.style.setProperty("--lunar-card-x", Math.max(0, Math.min(100, x)) + "%");
      surface.style.setProperty("--lunar-card-y", Math.max(0, Math.min(100, y)) + "%");
    });
  }, { passive: true });

  // Pointer Effects — cursor.js is only loaded when visual effects are enabled.
  const CURSOR_EFFECTS = [
    "rainbow-stars", "white-orbs", "rainbow-trail", "blue-orbs", "red-circle",
    "the-sims", "curly-cursor", "comet-cursor", "spark-cursor", "crosshair-cursor",
    "soft-glow-cursor", "pixel-cursor", "ring-cursor"
  ];
  const activePointer = store.get("pointer");
  const effectsLevel = store.get("interfaceEffects") || "full";
  const motionLevel = store.get("interfaceAnimations") || "on";

  if (CURSOR_EFFECTS.includes(activePointer) && effectsLevel !== "off" && motionLevel !== "off") {
    const cursorScript = document.createElement("script");
    cursorScript.src = "/assets/js/cursor.js?v=lunar9";
    cursorScript.onload = () => initCursorEffect();
    document.head.appendChild(cursorScript);
  }
});
