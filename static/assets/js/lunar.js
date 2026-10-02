(() => {
  const DEFAULT_BLISS = "https://cdn.discordapp.com/attachments/1552677976980590602/1554634440548950047/1536061.jpg?backend=b2&ex=6abd99a6&is=6abc4826&hm=9d440db406ac0f9344d92d072419f6b7a&";
  let initialized = false;
  let reactiveCleanup = null;

  const clamp = (value, min, max, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };

  function applyInterface() {
    if (!window.store || !document.body) return;
    const root = document.documentElement;
    const body = document.body;
    const glass = store.get("interfaceGlass") === "on";
    const strength = clamp(store.get("interfaceGlassStrength"), 0, 100, 65);
    const motion = store.get("interfaceAnimations") || "on";
    const effects = store.get("interfaceEffects") || "full";
    const effectOpacity = effects === "off" ? 0 : effects === "reduced" ? 0.42 : 1;

    body.classList.toggle("interface-glass", glass);
    body.classList.toggle("reduce-interface-motion", motion !== "on");
    body.classList.toggle("disable-interface-effects", effects === "off");
    body.classList.toggle("reduce-interface-effects", effects === "reduced");

    root.style.setProperty("--interface-glass-alpha", (0.18 + strength / 180).toFixed(2));
    root.style.setProperty("--interface-glass-blur", Math.round(6 + strength / 5) + "px");
    root.style.setProperty("--interface-motion-scale", motion === "off" ? "0" : motion === "reduced" ? "0.45" : "1");
    root.style.setProperty("--interface-effects-opacity", String(effectOpacity));
  }

  function removeLayer(id) {
    document.getElementById(id)?.remove();
  }

  function applyBackground() {
    if (!window.store || !document.body) return;
    const mode = store.get("backgroundMode") || "default";
    const saved = store.get("backgroundImage");
    const opacity = clamp(store.get("backgroundImageOpacity"), 0.1, 1, 1);
    const blur = clamp(store.get("backgroundImageBlur"), 0, 30, 0);
    const body = document.body;

    removeLayer("lunar-background-image");
    body.style.removeProperty("--background-image");

    if (mode === "none") {
      body.style.setProperty("background-image", "none", "important");
      return;
    }

    let image = "";
    if (mode === "default") image = DEFAULT_BLISS;
    else if (mode === "original") image = "/assets/media/background/full-main.png";
    else if (mode === "custom") image = saved;

    if (!image || image === "none") {
      body.style.setProperty("background-image", "none", "important");
      return;
    }

    const layer = document.createElement("div");
    layer.id = "lunar-background-image";
    layer.setAttribute("aria-hidden", "true");
    Object.assign(layer.style, {
      position: "fixed",
      inset: `${-blur}px`,
      zIndex: "0",
      pointerEvents: "none",
      backgroundImage: `url(${JSON.stringify(String(image))})`,
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      backgroundSize: "cover",
      backgroundAttachment: "fixed",
      opacity: String(opacity),
      filter: blur > 0 ? `blur(${blur}px)` : "none",
      transform: blur > 0 ? "scale(1.02)" : "none",
      transformOrigin: "center",
    });
    body.insertBefore(layer, body.firstChild);
    body.style.setProperty("background-image", "none", "important");
    document.documentElement.style.setProperty("--lunar-background-opacity", String(opacity));
    document.documentElement.style.setProperty("--lunar-background-blur", `${blur}px`);
  }

  function applyBackgroundEffect() {
    if (!window.store || !document.body) return;
    const selected = store.get("particles") || "off";
    const effect = selected === "true" ? "stars" : selected;
    removeLayer("lunar-background-effect");
    if (reactiveCleanup) {
      reactiveCleanup();
      reactiveCleanup = null;
    }
    if (!effect || effect === "off") return;

    const layer = document.createElement("div");
    layer.id = "lunar-background-effect";
    layer.className = `lunar-bg-effect lunar-bg-${effect}`;
    layer.setAttribute("aria-hidden", "true");
    document.body.insertBefore(layer, document.body.firstChild);

    if (effect === "stars") {
      ["stars", "stars2", "stars3"].forEach(id => {
        const starLayer = document.createElement("div");
        starLayer.id = id;
        layer.appendChild(starLayer);
      });
    }

    if (effect === "reactive") {
      let frame = 0;
      const update = event => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          const x = Math.max(0, Math.min(100, event.clientX / Math.max(1, window.innerWidth) * 100));
          const y = Math.max(0, Math.min(100, event.clientY / Math.max(1, window.innerHeight) * 100));
          layer.style.setProperty("--lunar-mx", `${x}%`);
          layer.style.setProperty("--lunar-my", `${y}%`);
        });
      };
      window.addEventListener("pointermove", update, { passive: true });
      layer.style.setProperty("--lunar-mx", "50%");
      layer.style.setProperty("--lunar-my", "50%");
      reactiveCleanup = () => {
        window.removeEventListener("pointermove", update);
        if (frame) cancelAnimationFrame(frame);
      };
    }
  }

  function applyLunarSettings() {
    applyInterface();
    applyBackground();
    applyBackgroundEffect();
  }

  function closeSelects(except) {
    document.querySelectorAll(".lunar-select.is-open").forEach(select => {
      if (select !== except) select.classList.remove("is-open");
    });
  }

  function buildCustomSelect(select) {
    if (!select || select.dataset.lunarEnhanced === "true") return;
    const wrapper = document.createElement("div");
    wrapper.className = "lunar-select";
    wrapper.dataset.for = select.id || "select";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "lunar-select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");

    const label = document.createElement("span");
    label.className = "lunar-select-label";
    const arrow = document.createElement("span");
    arrow.className = "lunar-select-arrow";
    arrow.innerHTML = '<i class="fa-solid fa-chevron-down" aria-hidden="true"></i>';
    trigger.append(label, arrow);

    const menu = document.createElement("div");
    menu.className = "lunar-select-menu";
    menu.setAttribute("role", "listbox");

    const syncLabel = () => {
      const option = select.options[select.selectedIndex];
      label.textContent = option ? option.textContent.trim() : "Select…";
      menu.querySelectorAll(".lunar-select-option").forEach(button => {
        const active = button.dataset.value === select.value;
        button.classList.toggle("is-selected", active);
        button.setAttribute("aria-selected", String(active));
      });
    };

    Array.from(select.children).forEach(child => {
      if (child.tagName === "OPTGROUP") {
        const group = document.createElement("div");
        group.className = "lunar-select-group";
        group.textContent = child.label;
        menu.appendChild(group);
        Array.from(child.options).forEach(option => addOption(option));
      } else if (child.tagName === "OPTION") {
        addOption(child);
      }
    });

    function addOption(option) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "lunar-select-option";
      button.dataset.value = option.value;
      button.textContent = option.textContent.trim();
      button.setAttribute("role", "option");
      button.addEventListener("click", () => {
        if (select.value !== option.value) {
          select.value = option.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
        syncLabel();
        wrapper.classList.remove("is-open");
        trigger.setAttribute("aria-expanded", "false");
      });
      menu.appendChild(button);
    }

    trigger.addEventListener("click", event => {
      event.stopPropagation();
      const open = !wrapper.classList.contains("is-open");
      closeSelects(wrapper);
      wrapper.classList.toggle("is-open", open);
      trigger.setAttribute("aria-expanded", String(open));
    });

    select.addEventListener("change", syncLabel);
    wrapper.append(trigger, menu);
    select.dataset.lunarEnhanced = "true";
    select.style.display = "none";
    select.parentNode.insertBefore(wrapper, select);
    syncLabel();
  }

  function initLunarGlassDropdowns() {
    document.querySelectorAll(".settings-card select").forEach(buildCustomSelect);
  }

  window.applyLunarSettings = applyLunarSettings;
  window.applyLunarBackground = applyBackground;
  window.applyLunarBackgroundEffect = applyBackgroundEffect;
  window.initLunarGlassDropdowns = initLunarGlassDropdowns;

  document.addEventListener("click", () => closeSelects(null));

  function init() {
    if (initialized) return;
    initialized = true;
    applyLunarSettings();
    initLunarGlassDropdowns();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
