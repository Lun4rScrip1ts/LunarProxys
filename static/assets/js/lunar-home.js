(() => {
  const applyLunarHome = () => {
    const title = document.querySelector(".title");
    const splash = document.getElementById("splash");
    const logo = document.querySelector(".lunar-nav-logo");
    const brand = document.querySelector(".lunar-brand");
    if (brand) brand.remove();
    if (logo) logo.setAttribute("aria-label", "Lunar Studios");
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
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", applyLunarHome); else applyLunarHome();
  window.setTimeout(applyLunarHome, 150);

  let memberRequestInFlight = false, memberTimer = null;
  const counterIds = { online: "lunar-online-count", offline: "lunar-offline-count", members: "lunar-member-count" };
  const setCounterText = (data) => {
    for (const [key, id] of Object.entries(counterIds)) {
      const el = document.getElementById(id); if (!el) continue;
      el.textContent = Number(data[key] || 0).toLocaleString();
      el.removeAttribute("contenteditable"); el.removeAttribute("role"); el.removeAttribute("aria-label"); el.removeAttribute("title");
    }
    const reset = document.getElementById("lunar-counter-reset"); if (reset) reset.hidden = true;
    document.getElementById("lunar-member-status")?.classList.remove("counter-editor");
  };
  const updateMemberStatus = async () => {
    const status = document.getElementById("lunar-member-status"); if (!status || memberRequestInFlight) return;
    memberRequestInFlight = true;
    try {
      const response = await fetch("/api/member-display", { cache: "no-store", credentials: "same-origin", headers: { "Cache-Control": "no-cache" } });
      if (!response.ok) return; setCounterText(await response.json());
    } catch {} finally { memberRequestInFlight = false; }
  };
  const startMemberUpdates = () => { if (memberTimer) clearInterval(memberTimer); updateMemberStatus(); memberTimer = setInterval(updateMemberStatus, 5000); };
  startMemberUpdates();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) updateMemberStatus(); });
  window.addEventListener("focus", updateMemberStatus);

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]);
  const loadChangelog = async () => {
    const list = document.getElementById("lunar-changelog-list"); if (!list) return;
    try {
      const [baseResult, recentResult] = await Promise.allSettled([
        fetch("/assets/data/changelog.json?v=lunar2", { cache: "no-store" }).then(r => r.ok ? r.json() : {entries:[]}),
        fetch("/assets/data/changelog-recent.json?v=lunar1", { cache: "no-store" }).then(r => r.ok ? r.json() : {entries:[]})
      ]);
      const base = baseResult.status === "fulfilled" && Array.isArray(baseResult.value.entries) ? baseResult.value.entries : [];
      const recent = recentResult.status === "fulfilled" && Array.isArray(recentResult.value.entries) ? recentResult.value.entries : [];
      const entries = [...recent, ...base].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      list.innerHTML = entries.map((entry, index) => {
        const date = new Date(entry.timestamp);
        const formatted = Number.isNaN(date.getTime()) ? escapeHtml(entry.timestamp) : date.toLocaleString([], { month:"short", day:"numeric", year:"numeric", hour:"numeric", minute:"2-digit" });
        const items = Array.isArray(entry.items) ? entry.items : [];
        return '<article class="lunar-changelog-entry ' + (index === 0 ? "latest" : "") + '"><div class="lunar-changelog-entry-head"><div class="lunar-changelog-entry-title"><i class="fa-solid fa-satellite-dish"></i><span>' + escapeHtml(entry.title || "Lunar Update") + '</span></div><span class="lunar-changelog-tag">' + escapeHtml(entry.tag || "Update") + '</span></div><div class="lunar-changelog-time">' + formatted + '</div><ul class="lunar-changelog-items">' + items.map(item => '<li>' + escapeHtml(item) + '</li>').join("") + '</ul></article>';
      }).join("") || '<div class="lunar-changelog-loading">No updates have been posted yet.</div>';
    } catch {
      list.innerHTML = '<div class="lunar-changelog-loading"><i class="fa-solid fa-cloud"></i><span>Update log is temporarily unavailable.</span></div>';
    }
  };
  loadChangelog();
})();
