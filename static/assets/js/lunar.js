(() => {
  const applyInterface = () => {
    if (!window.store) return;
    const root = document.documentElement;
    const body = document.body;
    const glass = store.get("interfaceGlass") === "on";
    const strength = Math.min(100, Math.max(0, Number(store.get("interfaceGlassStrength") || 65)));
    const scale = Math.min(110, Math.max(90, Number(store.get("interfaceScale") || 100)));
    const motion = store.get("interfaceAnimations") || "on";
    const effects = store.get("interfaceEffects") || "full";
    const effectOpacity = effects === "off" ? 0 : effects === "reduced" ? 0.42 : 1;

    body.classList.toggle("interface-glass", glass);
    body.classList.toggle("reduce-interface-motion", motion !== "on");
    body.classList.toggle("disable-interface-effects", effects === "off");
    body.classList.toggle("reduce-interface-effects", effects === "reduced");

    root.style.setProperty("--interface-glass-alpha", (0.18 + strength / 180).toFixed(2));
    root.style.setProperty("--interface-glass-blur", Math.round(6 + strength / 5) + "px");
    root.style.setProperty("--interface-ui-scale", String(scale / 100));
    root.style.setProperty("--interface-motion-scale", motion === "off" ? "0" : motion === "reduced" ? "0.45" : "1");
    root.style.setProperty("--interface-effects-opacity", String(effectOpacity));
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", applyInterface);
  else applyInterface();
})();
