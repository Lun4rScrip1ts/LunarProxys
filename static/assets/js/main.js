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

  // Re-apply the background after account settings finish loading. This matters when
  // the saved custom background exists on the account but not in localStorage yet.
  const applyLunarBackground = () => {
    const image = store.get("backgroundImage");
    document.body.style.backgroundImage = "";
    document.getElementById("lunar-background-image")?.remove();

    if (!image || image === "none") return;

    const imageLayer = document.createElement("div");
    imageLayer.id = "lunar-background-image";
    imageLayer.style.backgroundImage = `url("${String(image).replace(/"/g, "\\\"")}")`;
    imageLayer.style.opacity = String(Number(store.get("backgroundImageOpacity") || 100) / 100);
    imageLayer.style.filter = `blur(${Number(store.get("backgroundImageBlur") || 0)}px)`;
    document.body.insertBefore(imageLayer, document.body.firstChild);
  };

  // Restore account-backed settings if this browser/origin does not have them yet.
  // Existing local settings always take priority.
  if (typeof store.loadAccountSettings === "function") {
    store.loadAccountSettings().then(() => {
      applyLunarBackground();
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

  // Background Image Logic — isolated in its own layer so opacity/blur affect
  // only the uploaded image and never the UI or background effects.
  const savedBackgroundImage = store.get("backgroundImage");
  document.body.style.backgroundImage = "";
  document.getElementById("lunar-background-image")?.remove();
  if (savedBackgroundImage && savedBackgroundImage !== "none") {
    const imageLayer = document.createElement("div");
    imageLayer.id = "lunar-background-image";
    imageLayer.style.backgroundImage = `url("${String(savedBackgroundImage).replace(/"/g, "\\\"")}")`;
    imageLayer.style.opacity = String(Number(store.get("backgroundImageOpacity") || 100) / 100);
    imageLayer.style.filter = `blur(${Number(store.get("backgroundImageBlur") || 0)}px)`;
    document.body.insertBefore(imageLayer, document.body.firstChild);
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
  const STATIC_CURSORS = ["normal-lunar","normal-graphite","normal-minimal","normal-outline","normal-cross"];
  const applyStaticCursor = () => {
    document.body.classList.remove("lunar-static-cursor", "lunar-default-cursor");
    STATIC_CURSORS.forEach(name => document.body.classList.remove("lunar-" + name));
    const selected = store.get("pointer") || "default";
    if (STATIC_CURSORS.includes(selected)) {
      document.body.classList.add("lunar-static-cursor", "lunar-" + selected);
    } else if (selected === "default") {
      document.body.classList.add("lunar-default-cursor");
    }
  };
  applyStaticCursor();
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


/* Lunar custom context menu */
(() => {
  const boot = () => {
    if (document.getElementById("lunar-context-menu")) return;
    const menu=document.createElement("div");
    menu.id="lunar-context-menu";
    menu.className="lunar-context-menu";
    menu.innerHTML='<div class="lunar-context-head"><strong>Lunar Menu</strong><span id="lunar-context-target">Page actions</span></div><div id="lunar-context-actions"></div>';
    document.body.appendChild(menu);
    let context={x:0,y:0,link:null,image:null,selection:"",input:null};
    const actions=menu.querySelector("#lunar-context-actions");
    const close=()=>{menu.classList.remove("is-open");context={...context,x:context.x,y:context.y}};
    const item=(icon,label,key,extra="")=>'<button type="button" class="lunar-context-item '+extra+'" data-context-action="'+key+'"><i class="'+icon+'"></i><span>'+label+'</span></button>';
    function render(){
      const target=document.querySelector("#lunar-context-target");
      const parts=[];
      if(context.link) parts.push(item("fa-solid fa-arrow-up-right-from-square","Open link in new tab","open-link"));
      if(context.image) parts.push(item("fa-regular fa-image","Open image","open-image"),item("fa-regular fa-copy","Copy image address","copy-image"));
      parts.push(item("fa-solid fa-arrow-left","Back","back"),item("fa-solid fa-arrow-right","Forward","forward"),item("fa-solid fa-rotate","Reload","reload"));
      if(context.selection) parts.push('<div class="lunar-context-sep"></div>',item("fa-regular fa-copy","Copy selection","copy"),item("fa-solid fa-magnifying-glass","Search selection","search"));
      if(context.input) parts.push('<div class="lunar-context-sep"></div>',item("fa-regular fa-clipboard","Paste","paste"),item("fa-solid fa-i-cursor","Select all","select-all"));
      if(context.link) parts.push('<div class="lunar-context-sep"></div>',item("fa-regular fa-copy","Copy link","copy-link"));
      actions.innerHTML=parts.join("");
      target.textContent=context.link?"Link actions":context.image?"Image actions":context.input?"Text field":"Page actions";
    }
    document.addEventListener("contextmenu",e=>{
      e.preventDefault();
      const t=e.target;
      const link=t.closest?.("a[href]");
      const img=t.closest?.("img[src]");
      const input=t.closest?.("input,textarea,[contenteditable='true']");
      const sel=window.getSelection?.()?.toString().trim()||"";
      context={x:e.clientX,y:e.clientY,link:link?.href||null,image:img?.src||null,selection:sel,input:input||null};
      render();
      menu.style.left="0px";menu.style.top="0px";menu.classList.add("is-open");
      const rect=menu.getBoundingClientRect();
      const left=Math.min(e.clientX,innerWidth-rect.width-8);
      const top=Math.min(e.clientY,innerHeight-rect.height-8);
      menu.style.left=Math.max(8,left)+"px";menu.style.top=Math.max(8,top)+"px";
    });
    document.addEventListener("click",e=>{if(!menu.contains(e.target))close()});
    document.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
    actions.addEventListener("click",async e=>{
      const b=e.target.closest("[data-context-action]");if(!b)return;
      const a=b.dataset.contextAction;
      try{
        if(a==="back") history.back();
        else if(a==="forward") history.forward();
        else if(a==="reload") location.reload();
        else if(a==="open-link"&&context.link) window.open(context.link,"_blank","noopener,noreferrer");
        else if(a==="copy-link"&&context.link){await navigator.clipboard.writeText(context.link);window.dispatchEvent(new CustomEvent("lunar:toast",{detail:"Link copied"}))}
        else if(a==="open-image"&&context.image) window.open(context.image,"_blank","noopener,noreferrer");
        else if(a==="copy-image"&&context.image){await navigator.clipboard.writeText(context.image);window.dispatchEvent(new CustomEvent("lunar:toast",{detail:"Image address copied"}))}
        else if(a==="copy"&&context.selection){await navigator.clipboard.writeText(context.selection);window.dispatchEvent(new CustomEvent("lunar:toast",{detail:"Copied"}))}
        else if(a==="paste"&&context.input){const text=await navigator.clipboard.readText();if("value" in context.input){const start=context.input.selectionStart??context.input.value.length;const end=context.input.selectionEnd??start;context.input.setRangeText(text,start,end,"end");context.input.dispatchEvent(new Event("input",{bubbles:true}))}else{document.execCommand("insertText",false,text)}}
        else if(a==="select-all"&&context.input){context.input.focus();if("select" in context.input)context.input.select();else{const r=document.createRange();r.selectNodeContents(context.input);const s=getSelection();s.removeAllRanges();s.addRange(r)}}
        else if(a==="search"&&context.selection){const q=encodeURIComponent(context.selection);window.open("https://www.google.com/search?q="+q,"_blank","noopener,noreferrer")}
      }catch(err){window.dispatchEvent(new CustomEvent("lunar:toast",{detail:"Action unavailable"}))}
      close();
    });
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();


/* Cursor compositor guard: keep custom/animated cursors above every page surface,
   including the embedded browser iframe and saved background. */
(function initLunarCursorCompositor(){
  const effectPointers = new Set([
    "rainbow-stars","white-orbs","rainbow-trail","blue-orbs","red-circle",
    "the-sims","curly-cursor","comet-cursor","spark-cursor","crosshair-cursor",
    "soft-glow-cursor","pixel-cursor","ring-cursor"
  ]);
  const staticPointers = new Set([
    "normal-lunar","normal-graphite","normal-minimal","normal-outline","normal-cross"
  ]);

  function sync(){
    if (!document.body || typeof store === "undefined") return;
    const pointer = store.get("pointer") || "default";
    const custom = pointer === "default" || staticPointers.has(pointer) || effectPointers.has(pointer);
    document.documentElement.classList.toggle("lunar-pointer-active", custom);
    document.body.classList.toggle("lunar-custom-cursor-active", effectPointers.has(pointer));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", sync, {once:true});
  } else {
    sync();
  }

  /* Settings can change the pointer without a full page reload. */
  let last = null;
  setInterval(() => {
    if (typeof store === "undefined") return;
    const current = store.get("pointer") || "default";
    if (current !== last) {
      last = current;
      sync();
    }
  }, 300);
})();
