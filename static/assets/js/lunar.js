(() => {
  const applyInterface = () => {
    if (!window.store) return;
    const root=document.documentElement, body=document.body;
    const glass=store.get("interfaceGlass")==="on";
    const strength=Number(store.get("interfaceGlassStrength")||65);
    const scale=Number(store.get("interfaceScale")||100);
    const motion=store.get("interfaceAnimations")||"on";
    body.classList.toggle("interface-glass",glass);
    body.classList.toggle("reduce-interface-motion",motion==="reduced");
    root.style.setProperty("--interface-glass-alpha",(0.35+strength/180).toFixed(2));
    root.style.setProperty("--interface-glass-blur",Math.round(6+strength/6)+"px");
    root.style.setProperty("--interface-ui-scale",String(scale/100));
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",applyInterface);else applyInterface();
})();