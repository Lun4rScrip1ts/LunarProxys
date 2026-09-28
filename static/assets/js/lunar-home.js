(() => {
  const applyLunarHome = () => {
    const title = document.querySelector(".title");
    const splash = document.getElementById("splash");
    const logo = document.querySelector(".lunar-nav-logo");
    const brand = document.querySelector(".lunar-brand");
    if (brand) brand.remove();
    if (logo) { logo.setAttribute("aria-label", "Lunar Studios"); }
    document.body.classList.add("ls-ready");
    if (title) {
      title.textContent = "Lunar Proxy";
      title.setAttribute("aria-label", "Lunar Proxy");
      title.innerHTML = [...title.textContent].map((ch, i) => `<span class="lunar-title-letter" style="--i:${i}">${ch === " " ? "&nbsp;" : ch}</span>`).join("");
      if (!title.dataset.flowBound) {
        title.dataset.flowBound = "1";
        const letters = [...title.querySelectorAll(".lunar-title-letter")];
        const reset = () => letters.forEach((el) => { el.style.removeProperty("--mx"); el.style.removeProperty("--my"); });
        title.addEventListener("pointermove", (event) => {
          const r = title.getBoundingClientRect();
          const x = event.clientX - r.left;
          const y = event.clientY - r.top;
          letters.forEach((el) => {
            const er = el.getBoundingClientRect();
            const cx = er.left - r.left + er.width / 2;
            const cy = er.top - r.top + er.height / 2;
            const d = Math.hypot(x - cx, y - cy);
            const influence = Math.max(0, 1 - d / 145);
            el.style.setProperty("--mx", `${(x - cx) * influence * 0.12}px`);
            el.style.setProperty("--my", `${(y - cy) * influence * 0.18}px`);
          });
        });
        title.addEventListener("pointerleave", reset);
      }
    }
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

  const loadChangelog = async () => {
    const list = document.getElementById("lunar-changelog-list");
    if (!list) return;
    try {
      const response = await fetch("/assets/data/changelog.json?v=lunar1", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load updates.");
      const data = await response.json();
      const entries = Array.isArray(data.entries) ? data.entries : [];
      list.innerHTML = entries.map((entry, index) => {
        const date = new Date(entry.timestamp);
        const formatted = Number.isNaN(date.getTime()) ? entry.timestamp : date.toLocaleString([], {
          month:"short", day:"numeric", year:"numeric", hour:"numeric", minute:"2-digit"
        });
        return '<article class="lunar-changelog-entry '+(index===0?"latest":"")+'">' +
          '<div class="lunar-changelog-entry-head"><div class="lunar-changelog-entry-title"><i class="fa-solid fa-satellite-dish"></i><span>'+String(entry.title||"Lunar Update")+'</span></div><span class="lunar-changelog-tag">'+String(entry.tag||"Update")+'</span></div>' +
          '<div class="lunar-changelog-time">'+formatted+'</div>' +
          '<ul class="lunar-changelog-items">'+(entry.items||[]).map(item=>'<li>'+String(item)+'</li>').join("")+'</ul>' +
          '</article>';
      }).join("") || '<div class="lunar-changelog-loading">No updates have been posted yet.</div>';
    } catch {
      list.innerHTML = '<div class="lunar-changelog-loading"><i class="fa-solid fa-cloud"></i><span>Update log is temporarily unavailable.</span></div>';
    }
  };
  loadChangelog();

})();