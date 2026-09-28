(() => {
  const applyLunarHome = () => {
    const title = document.querySelector(".title");
    const splash = document.getElementById("splash");
    const logo = document.querySelector(".lunar-nav-logo");
    const brand = document.querySelector(".lunar-brand");
    if (brand) brand.remove();
    if (logo) { logo.setAttribute("aria-label", "Lunar Studios"); }
    document.body.classList.add("ls-ready");
    if (title) title.textContent = "Lunar Proxy";
    if (splash) splash.textContent = "A cleaner way to explore the web.";
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", applyLunarHome);
  else applyLunarHome();
  window.setTimeout(applyLunarHome, 150);

  const updateMemberStatus = async () => {
    const online = document.getElementById("lunar-online-count");
    const members = document.getElementById("lunar-member-count");
    if (!online || !members) return;
    try {
      const response = await fetch("/api/members/online", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      online.textContent = Number.isFinite(data.online) ? data.online : 0;
      members.textContent = Number.isFinite(data.members) ? data.members : 0;
    } catch {}
  };

  updateMemberStatus();
  window.setInterval(updateMemberStatus, 30000);
})();
