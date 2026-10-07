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
    // Fail-safe: visual effects always remain enabled so a stale/broken
    // saved preference can never hide the entire interface.
    const effects = "full";
    if (store.get("interfaceEffects") !== "full") store.set("interfaceEffects", "full");
    const effectOpacity = 1;

    body.classList.toggle("interface-glass", glass);
    body.classList.toggle("reduce-interface-motion", motion !== "on");
    body.classList.remove("disable-interface-effects", "reduce-interface-effects");

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

  function syncSettingsPage() {
    if (!window.store) return;
    const setSelect = (id, value) => {
      const select = document.getElementById(id);
      if (!select || value == null) return;
      select.value = value;
      const wrapper = document.querySelector(`.lunar-select[data-for="${id}"]`);
      if (!wrapper) return;
      const option = select.options[select.selectedIndex];
      const label = wrapper.querySelector(".lunar-select-label");
      if (label && option) label.textContent = option.textContent.trim();
      wrapper.querySelectorAll(".lunar-select-option").forEach(button => {
        const active = button.dataset.value === select.value;
        button.classList.toggle("is-selected", active);
        button.setAttribute("aria-selected", String(active));
      });
    };

    setSelect("theme-dropdown", store.get("theme") || "d");
    setSelect("background-dropdown", store.get("backgroundMode") || "default");
    setSelect("particles-dropdown", store.get("particles") || "off");
    setSelect("pointer-dropdown", store.get("pointer") || "default");
    setSelect("glass-effect-dropdown", store.get("interfaceGlass") || "off");
    setSelect("animations-dropdown", store.get("interfaceAnimations") || "on");
    setSelect("visual-effects-dropdown", store.get("interfaceEffects") || "full");

    const glassStrength = document.getElementById("glass-strength-range");
    const glassStrengthValue = document.getElementById("glass-strength-value");
    if (glassStrength) glassStrength.value = String(clamp(store.get("interfaceGlassStrength"), 0, 100, 65));
    if (glassStrengthValue && glassStrength) glassStrengthValue.textContent = glassStrength.value + "%";

    const bgOpacity = document.getElementById("background-opacity-range");
    const bgOpacityValue = document.getElementById("background-opacity-value");
    if (bgOpacity) bgOpacity.value = String(clamp(store.get("backgroundImageOpacity"), 10, 100, 100));
    if (bgOpacityValue && bgOpacity) bgOpacityValue.textContent = bgOpacity.value + "%";

    const bgBlur = document.getElementById("background-blur-range");
    const bgBlurValue = document.getElementById("background-blur-value");
    if (bgBlur) bgBlur.value = String(clamp(store.get("backgroundImageBlur"), 0, 30, 0));
    if (bgBlurValue && bgBlur) bgBlurValue.textContent = bgBlur.value + "px";

    const customRow = document.getElementById("background-custom-row");
    const controls = document.getElementById("background-image-controls");
    const isCustom = (store.get("backgroundMode") || "default") === "custom" && Boolean(store.get("backgroundImage"));
    if (customRow) customRow.style.display = (store.get("backgroundMode") || "default") === "custom" ? "" : "none";
    if (controls) controls.style.display = isCustom ? "" : "none";
  }

  function installLiveBackgroundControls() {
    const opacity = document.getElementById("background-opacity-range");
    const blur = document.getElementById("background-blur-range");
    if (opacity && !opacity.dataset.lunarLive) {
      opacity.dataset.lunarLive = "true";
      opacity.addEventListener("input", () => {
        const layer = document.getElementById("lunar-background-image");
        if (layer) layer.style.opacity = String(Number(opacity.value) / 100);
      });
    }
    if (blur && !blur.dataset.lunarLive) {
      blur.dataset.lunarLive = "true";
      blur.addEventListener("input", () => {
        const layer = document.getElementById("lunar-background-image");
        if (layer) {
          const px = Number(blur.value) || 0;
          layer.style.inset = `${-px}px`;
          layer.style.filter = px ? `blur(${px}px)` : "none";
          layer.style.transform = px ? "scale(1.02)" : "none";
        }
      });
    }
  }

  function applyLunarSettings() {
    applyInterface();
    applyBackground();
    applyBackgroundEffect();
    syncSettingsPage();
    installLiveBackgroundControls();
    window.dispatchEvent(new CustomEvent("lunarsettingsapplied"));
  }

  function closeSelects(except) {
    document.querySelectorAll(".lunar-select.is-open").forEach(select => {
      if (select !== except) {
        select.classList.remove("is-open");
        select.querySelector(".lunar-select-trigger")?.setAttribute("aria-expanded", "false");
        const menu = select.querySelector(".lunar-select-menu");
        if (menu && menu.dataset.lunarPortal === "true") {
          menu.dataset.lunarPortal = "false";
          menu.style.position = "";
          menu.style.left = "";
          menu.style.top = "";
          menu.style.width = "";
          menu.style.zIndex = "";
          menu.style.opacity = "";
          menu.style.visibility = "";
          menu.style.transform = "";
          menu.style.pointerEvents = "";
          select.appendChild(menu);
        }
      }
    });
  }

  function buildCustomSelect(select) {
    if (!select || select.dataset.lunarEnhanced === "true") return;
    const parent = select.parentNode;
    if (!parent) return;

    const wrapper = document.createElement("div");
    wrapper.className = "lunar-select";
    wrapper.dataset.for = select.id || "select";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "lunar-select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.style.margin = "0";
    trigger.style.width = "100%";
    trigger.style.maxWidth = "none";
    trigger.style.height = "54px";

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

    const addOption = option => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "lunar-select-option";
      button.dataset.value = option.value;
      button.textContent = option.textContent.trim();
      button.setAttribute("role", "option");
      // Reset the global settings button rules so dropdown options never
      // inherit the normal button width, margin, or fixed height.
      button.style.margin = "0";
      button.style.width = "100%";
      button.style.maxWidth = "none";
      button.style.height = "auto";
      button.style.minHeight = "0";
      button.style.boxSizing = "border-box";
      button.style.display = "block";
      button.style.padding = "11px 13px";
      button.style.textAlign = "left";
      button.style.background = "transparent";
      button.addEventListener("click", event => {
        event.stopPropagation();
        if (select.value !== option.value) {
          select.value = option.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
        syncLabel();
        closeSelects(null);
      });
      menu.appendChild(button);
    };

    Array.from(select.children).forEach(child => {
      if (child.tagName === "OPTGROUP") {
        const group = document.createElement("div");
        group.className = "lunar-select-group";
        group.textContent = child.label;
        menu.appendChild(group);
        Array.from(child.options).forEach(addOption);
      } else if (child.tagName === "OPTION") {
        addOption(child);
      }
    });

    const positionPortal = () => {
      if (menu.dataset.lunarPortal !== "true") return;
      const rect = trigger.getBoundingClientRect();
      const gap = 8;
      const menuHeight = Math.min(310, Math.max(120, menu.scrollHeight || 310));
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const spaceAbove = rect.top - gap;
      const openAbove = spaceBelow < Math.min(260, menuHeight) && spaceAbove > spaceBelow;
      const height = Math.min(menuHeight, Math.max(120, openAbove ? spaceAbove : spaceBelow));
      const top = openAbove ? Math.max(8, rect.top - height - gap) : Math.min(window.innerHeight - height - 8, rect.bottom + gap);

      menu.style.position = "fixed";
      menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8))}px`;
      menu.style.top = `${Math.max(8, top)}px`;
      menu.style.width = `${rect.width}px`;
      menu.style.maxHeight = `${Math.max(120, height)}px`;
      menu.style.zIndex = "2147483647";
      menu.style.opacity = "1";
      menu.style.visibility = "visible";
      menu.style.transform = "translateY(0) scale(1)";
      menu.style.pointerEvents = "auto";
    };

    const open = () => {
      closeSelects(wrapper);
      wrapper.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
      menu.dataset.lunarPortal = "true";
      document.body.appendChild(menu);
      positionPortal();
      window.addEventListener("resize", positionPortal, { passive: true });
      window.addEventListener("scroll", positionPortal, true);
    };

    const close = () => {
      wrapper.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
      window.removeEventListener("resize", positionPortal);
      window.removeEventListener("scroll", positionPortal, true);
      if (menu.dataset.lunarPortal === "true") {
        menu.dataset.lunarPortal = "false";
        menu.style.position = "";
        menu.style.left = "";
        menu.style.top = "";
        menu.style.width = "";
        menu.style.maxHeight = "";
        menu.style.zIndex = "";
        menu.style.opacity = "";
        menu.style.visibility = "";
        menu.style.transform = "";
        menu.style.pointerEvents = "";
        wrapper.appendChild(menu);
      }
    };

    trigger.addEventListener("click", event => {
      event.stopPropagation();
      wrapper.classList.contains("is-open") ? close() : open();
    });

    select.addEventListener("change", syncLabel);
    parent.insertBefore(wrapper, select);
    wrapper.append(trigger, select);
    wrapper.appendChild(menu);
    select.dataset.lunarEnhanced = "true";
    select.classList.add("lunar-native-enhanced");
    select.style.display = "none";
    syncLabel();

    trigger.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
        menu.querySelector(".lunar-select-option")?.focus();
      }
    });
  }

  function initLunarGlassDropdowns() {
    document.querySelectorAll(".settings-card select").forEach(buildCustomSelect);
    syncSettingsPage();
    installLiveBackgroundControls();
  }

  window.applyLunarSettings = applyLunarSettings;
  window.applyLunarBackground = applyBackground;
  window.applyLunarBackgroundEffect = applyBackgroundEffect;
  window.initLunarGlassDropdowns = initLunarGlassDropdowns;

  document.addEventListener("click", () => closeSelects(null));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeSelects(null);
  });

  function init() {
    if (initialized) return;
    initialized = true;
    applyLunarSettings();
    initLunarGlassDropdowns();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
