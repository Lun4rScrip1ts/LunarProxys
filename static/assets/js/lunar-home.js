(() => {
  const applyLunarHome = () => {
    const title = document.querySelector(".title");
    const splash = document.getElementById("splash");
    const logo = document.querySelector(".lunar-nav-logo");
    if (logo) { logo.textContent = "LS"; logo.setAttribute("aria-label", "LS"); }
    document.body.classList.add("ls-ready");
    if (title) title.textContent = "Lunars Proxys";
    if (splash) splash.textContent = "A cleaner way to explore the web.";
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", applyLunarHome);
  else applyLunarHome();
  window.setTimeout(applyLunarHome, 150);
})();
