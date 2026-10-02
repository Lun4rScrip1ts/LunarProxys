/* Repair DM message avatars when an older message payload does not include avatarUrl. */
(() => {
  const root = document.getElementById("dm-messages");
  if (!root) return;

  const cache = new Map();
  const pending = new Set();

  const escapeAttr = value => String(value ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const initials = value => String(value || "?").slice(0, 2).toUpperCase();

  function findExistingAvatar(username) {
    const candidates = document.querySelectorAll(".friends-list .friend-avatar img, #dm-mini-avatar img, #dm-large-avatar img");
    for (const image of candidates) {
      const parent = image.closest("[data-profile-user]");
      if (parent?.dataset.profileUser === username && image.src) return image.src;
    }
    return "";
  }

  async function resolveAvatar(username, button) {
    if (!username || !button || button.querySelector("img")) return;
    if (cache.has(username)) {
      apply(button, cache.get(username));
      return;
    }
    const local = findExistingAvatar(username);
    if (local) {
      cache.set(username, local);
      apply(button, local);
      return;
    }
    if (pending.has(username)) return;
    pending.add(username);
    try {
      const response = await fetch("/api/users/" + encodeURIComponent(username), {
        credentials: "same-origin",
        cache: "no-store"
      });
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      const url = data?.user?.avatarUrl || "";
      cache.set(username, url);
      if (url) apply(button, url);
    } catch {}
    finally { pending.delete(username); }
  }

  function apply(button, url) {
    if (!button || button.querySelector("img")) return;
    if (!url) return;
    const image = document.createElement("img");
    image.src = url;
    image.alt = "";
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => {
      image.remove();
      button.style.fontSize = "10px";
    }, { once: true });
    button.appendChild(image);
    button.style.fontSize = "0";
  }

  function scan() {
    root.querySelectorAll(".dm-message .dm-avatar").forEach(button => {
      if (button.querySelector("img")) return;
      const profile = button.dataset.profileUser || button.closest(".dm-message")?.querySelector(".dm-message-meta [data-profile-user]")?.dataset.profileUser;
      if (profile) resolveAvatar(profile, button);
    });
  }

  const observer = new MutationObserver(scan);
  observer.observe(root, { childList: true, subtree: true });
  scan();
})();
