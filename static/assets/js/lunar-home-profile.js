(() => {
  const esc = value => { const d = document.createElement("div"); d.textContent = value ?? ""; return d.innerHTML; };
  const attr = value => esc(value).replace(/"/g, "&quot;");
  const initials = value => String(value || "?").slice(0, 2).toUpperCase();
  const api = async (url, options = {}) => {
    const response = await fetch(url, { credentials: "same-origin", ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  };

  let currentUser = null;
  let activeUser = null;
  let modal = null;

  const toast = message => {
    let el = document.getElementById("lunar-home-profile-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "lunar-home-profile-toast";
      el.className = "friends-toast lunar-home-profile-toast";
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove("show"), 2200);
  };

  async function loadCurrentUser() {
    try {
      const data = await api("/api/friends/bootstrap", { cache: "no-store" });
      currentUser = data.user || null;
    } catch (_) { currentUser = null; }
  }

  function avatarHtml(user) {
    return user?.avatarUrl
      ? '<img src="' + attr(user.avatarUrl) + '" alt="" onerror="this.remove()">'
      : esc(initials(user?.displayName || user?.username));
  }

  function canManageRoles() {
    return ["lunar", "lunarstudios"].includes(String(currentUser?.username || "").toLowerCase());
  }

  async function renderRoleManager(container, user) {
    if (!container || !canManageRoles()) return;
    container.innerHTML = '<div class="profile-role-manager"><div class="profile-role-manager-head"><div><strong>Profile Roles</strong><span>Only @lunar and @lunarstudios can edit these tags.</span></div></div><div class="profile-role-manager-list">' +
      (user.roles || []).map(role => '<span class="profile-role-edit-tag">' + esc(role) + '<button type="button" data-remove-home-role="' + attr(role) + '" aria-label="Remove ' + attr(role) + '"><i class="fa-solid fa-xmark"></i></button></span>').join("") +
      '</div><div class="profile-role-manager-add"><input type="text" maxlength="32" placeholder="Add a role..."><button type="button" data-add-home-role><i class="fa-solid fa-plus"></i> Add</button></div></div>';

    const save = async roles => {
      try {
        const data = await api("/api/users/" + encodeURIComponent(user.username) + "/roles", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roles }) });
        user.roles = data.user?.roles || [];
        fillProfile(user);
        toast("Profile roles updated.");
      } catch (error) { toast(error.message); }
    };
    container.querySelector("[data-add-home-role]")?.addEventListener("click", () => {
      const input = container.querySelector("input");
      const role = (input?.value || "").trim();
      if (!role) return;
      if ((user.roles || []).some(r => r.toLowerCase() === role.toLowerCase())) return toast("That role is already on the profile.");
      save([...(user.roles || []), role]);
    });
    container.querySelector("input")?.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); container.querySelector("[data-add-home-role]")?.click(); } });
    container.querySelectorAll("[data-remove-home-role]").forEach(button => button.addEventListener("click", () => save((user.roles || []).filter(role => role !== button.dataset.removeHomeRole))));
  }

  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "friends-profile-modal";
    modal.className = "friends-profile-modal";
    modal.hidden = true;
    modal.innerHTML = '<div class="friends-profile-card">' +
      '<button id="friends-profile-close" class="friends-profile-close" type="button" aria-label="Close profile"><i class="fa-solid fa-xmark"></i></button>' +
      '<div id="friends-profile-banner" class="friends-profile-banner"></div>' +
      '<div class="friends-profile-body">' +
        '<div id="friends-profile-avatar" class="friends-profile-avatar"></div>' +
        '<div class="friends-profile-name"><h2 id="friends-profile-display"></h2><span id="friends-profile-owner" class="friends-profile-owner" hidden>Owner</span></div>' +
        '<div id="friends-profile-username" class="friends-profile-username"></div>' +
        '<div id="friends-profile-status" class="friends-profile-status"></div>' +
        '<div id="friends-profile-member" class="friends-profile-member"></div>' +
        '<p id="friends-profile-bio" class="friends-profile-bio"></p>' +
        '<div id="friends-profile-actions" class="profile-actions friends-profile-actions"><button id="friends-profile-message" type="button" class="message-action">Message</button><button id="friends-profile-friend" type="button" class="friend-action">Friend</button><button id="friends-profile-block" type="button" class="block-action">Block</button><button id="friends-profile-report" type="button" class="report-action">Report</button></div>' +
        '<div id="friends-profile-roles" class="friends-profile-roles"></div>' +
        '<div id="friends-profile-stickers" class="friends-profile-stickers"></div>' +
      '</div>' +
    '</div>';
    document.body.appendChild(modal);
    modal.addEventListener("click", e => { if (e.target === modal) closeProfile(); });
    document.getElementById("friends-profile-close").onclick = closeProfile;
    return modal;
  }

  function closeProfile() { if (modal) modal.hidden = true; activeUser = null; }

  function fillProfile(u) {
    ensureModal();
    activeUser = u;
    const avatar = document.getElementById("friends-profile-avatar");
    const display = document.getElementById("friends-profile-display");
    const owner = document.getElementById("friends-profile-owner");
    const username = document.getElementById("friends-profile-username");
    const status = document.getElementById("friends-profile-status");
    const member = document.getElementById("friends-profile-member");
    const bio = document.getElementById("friends-profile-bio");
    const roles = document.getElementById("friends-profile-roles");
    const stickers = document.getElementById("friends-profile-stickers");
    const actions = document.getElementById("friends-profile-actions");
    const friend = document.getElementById("friends-profile-friend");
    const block = document.getElementById("friends-profile-block");
    const banner = document.getElementById("friends-profile-banner");
    const card = modal.querySelector(".friends-profile-card");

    avatar.innerHTML = avatarHtml(u);
    display.textContent = u.displayName || u.username;
    username.textContent = "@" + u.username;
    status.textContent = u.isOnline ? "Online" : (u.status || "Offline");
    status.classList.toggle("is-online", Boolean(u.isOnline));
    member.textContent = u.createdAt ? "Member since " + new Date(u.createdAt).toLocaleDateString([], { month: "short", year: "numeric" }) : "";
    bio.textContent = u.bio || "No bio yet.";
    owner.hidden = !u.isOwner;

    banner.style.backgroundImage = u.bannerUrl ? 'url("' + String(u.bannerUrl).replace(/"/g, '\\\"') + '")' : "none";
    const bg = u.backgroundUrl || "";
    card.style.backgroundImage = bg ? 'linear-gradient(180deg,rgba(10,12,17,.18),rgba(10,12,17,.94) 62%),url("' + String(bg).replace(/"/g, '\\\"') + '")' : "linear-gradient(180deg,#20242d,#17191e)";
    card.style.backgroundSize = bg ? "cover" : "auto";
    card.style.backgroundPosition = "center";

    roles.innerHTML = (u.roles || []).map(role => "<span>" + esc(role) + "</span>").join("");
    let manager = document.getElementById("friends-profile-role-manager");
    if (!manager) { manager = document.createElement("div"); manager.id = "friends-profile-role-manager"; roles.after(manager); }
    manager.innerHTML = "";
    renderRoleManager(manager, u);

    stickers.innerHTML = (u.stickers || []).slice(0, 12).map(sticker => '<img src="' + attr(sticker.url) + '" alt="' + attr(sticker.name || "Sticker") + '" loading="lazy">').join("");

    let mutualBox = document.getElementById("friends-profile-mutuals");
    if (!mutualBox) { mutualBox = document.createElement("div"); mutualBox.id = "friends-profile-mutuals"; mutualBox.className = "friends-profile-mutuals"; actions.before(mutualBox); }
    const mutuals = Array.isArray(u.mutualFriends) ? u.mutualFriends : [];
    mutualBox.innerHTML = mutuals.length
      ? '<strong>' + mutuals.length + ' Mutual Friend' + (mutuals.length === 1 ? "" : "s") + '</strong><div>' + mutuals.slice(0, 6).map(m => m.avatarUrl ? '<img src="' + attr(m.avatarUrl) + '" alt="@' + attr(m.username) + '" title="@' + attr(m.username) + '">' : '<span title="@' + attr(m.username) + '">' + esc(initials(m.displayName || m.username)) + '</span>').join("") + '</div>'
      : "<strong>No Mutual Friends</strong>";

    actions.hidden = !!u.isSelf;
    const message = document.getElementById("friends-profile-message");
    const report = document.getElementById("friends-profile-report");
    message.onclick = () => { location.href = "/friends?user=" + encodeURIComponent(u.username); };
    friend.textContent = u.isFriend ? "Added" : (u.friendRequestPending ? "Pending" : "Friend");
    friend.disabled = !!u.isFriend || !!u.friendRequestPending;
    friend.onclick = async () => {
      try { await api("/api/friends/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u.username }) }); friend.textContent = "Pending"; friend.disabled = true; toast("Friend request sent."); }
      catch (e) { toast(e.message); }
    };
    block.textContent = u.isBlocked ? "Blocked" : "Block";
    block.disabled = !!u.isBlocked;
    block.onclick = async () => {
      if (!confirm("Block @" + u.username + "?")) return;
      try { await api("/api/friends/block/" + encodeURIComponent(u.id), { method: "POST" }); toast("User blocked."); closeProfile(); }
      catch (e) { toast(e.message); }
    };
    report.onclick = async () => {
      try { await api("/api/friends/report/" + encodeURIComponent(u.id), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "Reported from homepage profile" }) }); toast("Report submitted."); }
      catch (e) { toast(e.message); }
    };
    modal.hidden = false;
  }

  async function openProfile(username) {
    if (!username) return;
    ensureModal();
    try {
      const data = await api("/api/users/" + encodeURIComponent(username), { cache: "no-store" });
      if (!data.user) return;
      fillProfile(data.user);
    } catch (error) { toast(error.message); }
  }

  document.addEventListener("click", event => {
    const target = event.target.closest("[data-member-username]");
    if (!target) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    openProfile(target.dataset.memberUsername);
  }, true);
  document.addEventListener("keydown", event => { if (event.key === "Escape" && modal && !modal.hidden) closeProfile(); });
  loadCurrentUser();
})();
