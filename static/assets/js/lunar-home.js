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

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", applyLunarHome);
  else applyLunarHome();
  window.setTimeout(applyLunarHome, 150);

  let memberRequestInFlight = false;
  let memberTimer = null;
  let canEditCounters = false;
  let editingCounter = null;
  const counterIds = { online: "lunar-online-count", offline: "lunar-offline-count", members: "lunar-member-count" };

  const setCounterText = (data) => {
    for (const [key, id] of Object.entries(counterIds)) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (editingCounter === key && document.activeElement === el) continue;
      el.textContent = Number(data[key] || 0).toLocaleString();
    }
  };

  const updateMemberStatus = async () => {
    const status = document.getElementById("lunar-member-status");
    if (!status || memberRequestInFlight || editingCounter) return;
    memberRequestInFlight = true;
    try {
      const response = await fetch("/api/member-display", { cache: "no-store", credentials: "same-origin", headers: { "Cache-Control": "no-cache" } });
      if (!response.ok) return;
      const data = await response.json();
      if (editingCounter) return;
      setCounterText(data);
      canEditCounters = data.canEdit === true;
      const reset = document.getElementById("lunar-counter-reset");
      status.classList.toggle("counter-editor", canEditCounters);
      if (reset) reset.hidden = !canEditCounters;
      Object.entries(counterIds).forEach(([key, id]) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (canEditCounters) {
          el.contentEditable = "true";
          el.setAttribute("role", "textbox");
          el.setAttribute("aria-label", `Edit ${key} counter`);
          el.title = `Edit ${key} counter`;
        } else {
          el.removeAttribute("contenteditable");
          el.removeAttribute("role");
          el.removeAttribute("aria-label");
          el.removeAttribute("title");
        }
      });
    } catch {
      // Keep the last known values during temporary network failures.
    } finally {
      memberRequestInFlight = false;
    }
  };

  const saveCounter = async (key, element) => {
    if (!canEditCounters || editingCounter !== key) return;
    const digits = String(element.textContent || "").replace(/[^0-9]/g, "");
    const value = Math.min(999999999, Math.max(0, Number(digits || 0)));
    element.textContent = value.toLocaleString();
    try {
      const response = await fetch("/api/member-display", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [key]: value }) });
      if (!response.ok) throw new Error("save failed");
      const data = await response.json();
      editingCounter = null;
      setCounterText(data);
    } catch {
      editingCounter = null;
      updateMemberStatus();
    }
  };

  const installCounterEditor = () => {
    Object.entries(counterIds).forEach(([key, id]) => {
      const el = document.getElementById(id);
      if (!el || el.dataset.counterBound) return;
      el.dataset.counterBound = "1";
      el.addEventListener("focus", () => {
        if (!canEditCounters) return;
        editingCounter = key;
        el.textContent = String(el.textContent).replace(/,/g, "");
      });
      el.addEventListener("keydown", (event) => {
        if (!canEditCounters || editingCounter !== key) return;
        if (event.key === "Enter") {
          event.preventDefault();
          saveCounter(key, el);
          el.blur();
        } else if (event.key === "Escape") {
          event.preventDefault();
          editingCounter = null;
          updateMemberStatus();
          el.blur();
        }
      });
      el.addEventListener("input", () => {
        if (!canEditCounters || editingCounter !== key) return;
        const clean = String(el.textContent || "").replace(/[^0-9]/g, "").slice(0, 9);
        if (el.textContent !== clean) el.textContent = clean;
      });
      // Do not save on blur. Clicking away must not overwrite the value;
      // only Enter explicitly commits the edit.
      el.addEventListener("blur", () => {
        if (editingCounter === key) return;
      });
    });
    document.getElementById("lunar-counter-reset")?.addEventListener("click", async () => {
      if (!canEditCounters || editingCounter) return;
      const button = document.getElementById("lunar-counter-reset");
      if (button) button.disabled = true;
      try {
        const response = await fetch("/api/member-display/reset", { method: "POST", credentials: "same-origin" });
        if (response.ok) setCounterText(await response.json());
      } finally {
        if (button) button.disabled = false;
      }
    });
  };

  const startMemberUpdates = () => {
    if (memberTimer) window.clearInterval(memberTimer);
    installCounterEditor();
    updateMemberStatus();
    memberTimer = window.setInterval(updateMemberStatus, 5000);
  };

  startMemberUpdates();
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !editingCounter) updateMemberStatus(); });
  window.addEventListener("focus", () => { if (!editingCounter) updateMemberStatus(); });

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]);
  const loadChangelog = async () => {
    const list = document.getElementById("lunar-changelog-list");
    if (!list) return;
    try {
      const response = await fetch("/assets/data/changelog.json?v=lunar2", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load updates.");
      const data = await response.json();
      const entries = Array.isArray(data.entries) ? data.entries : [];
      list.innerHTML = entries.map((entry, index) => {
        const date = new Date(entry.timestamp);
        const formatted = Number.isNaN(date.getTime()) ? escapeHtml(entry.timestamp) : date.toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
        const items = Array.isArray(entry.items) ? entry.items : [];
        return '<article class="lunar-changelog-entry ' + (index === 0 ? "latest" : "") + '"><div class="lunar-changelog-entry-head"><div class="lunar-changelog-entry-title"><i class="fa-solid fa-satellite-dish"></i><span>' + escapeHtml(entry.title || "Lunar Update") + '</span></div><span class="lunar-changelog-tag">' + escapeHtml(entry.tag || "Update") + '</span></div><div class="lunar-changelog-time">' + formatted + '</div><ul class="lunar-changelog-items">' + items.map(item => '<li>' + escapeHtml(item) + '</li>').join("") + '</ul></article>';
      }).join("") || '<div class="lunar-changelog-loading">No updates have been posted yet.</div>';
    } catch {
      list.innerHTML = '<div class="lunar-changelog-loading"><i class="fa-solid fa-cloud"></i><span>Update log is temporarily unavailable.</span></div>';
    }
  };
  loadChangelog();
})();
