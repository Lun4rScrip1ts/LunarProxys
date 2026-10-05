(() => {
  const escape = value => {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
  };
  const escapeAttr = value => escape(value).replace(/"/g, "&quot;");
  const initials = name => (name || "?").trim().slice(0, 2).toUpperCase();
  let currentUser = null;
  let activeUser = null;

  async function api(url, options) {
    const response = await fetch(url, { credentials: "same-origin", ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  }

  function toast(message) {
    let el = document.getElementById("home-profile-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "home-profile-toast";
      el.className = "friends-toast show";
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  function canManageProfileRoles() {
    return ["lunar", "lunarstudios"].includes(String(currentUser?.username || "").toLowerCase());
  }

  async function renderProfileRoleManager(container, user) {
    if (!container || !canManageProfileRoles()) return;
    container.innerHTML = '<div class="profile-role-manager"><div class="profile-role-manager-head"><div><strong>Profile Roles</strong><span>Only @lunar and @lunarstudios can edit these tags.</span></div></div><div class="profile-role-manager-list">' +
      (user.roles || []).map(role => '<span class="profile-role-edit-tag">' + escape(role) + '<button type="button" data-remove-profile-role="' + escapeAttr(role) + '" aria-label="Remove ' + escapeAttr(role) + '"><i class="fa-solid fa-xmark"></i></button></span>').join("") +
      '</div><div class="profile-role-manager-add"><input type="text" maxlength="32" placeholder="Add a role..."><button type="button" data-add-profile-role><i class="fa-solid fa-plus"></i> Add</button></div></div>';

    const save = async roles => {
      try {
        const data = await api("/api/users/" + encodeURIComponent(user.username) + "/roles", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roles })
        });
        user.roles = data.user.roles || [];
        const roleDisplay = document.getElementById("friends-profile-roles");
        if (roleDisplay) roleDisplay.innerHTML = user.roles.map(r => "<span>" + escape(r) + "</span>").join("");
        await renderProfileRoleManager(container, user);
        toast("Profile roles updated.");
      } catch (error) { toast(error.message); }
    };

    container.querySelector("[data-add-profile-role]")?.addEventListener("click", async () => {
      const input = container.querySelector("input");
      const role = (input?.value || "").trim();
      if (!role) return;
      if ((user.roles || []).some(r => r.toLowerCase() === role.toLowerCase())) {
        toast("That role is already on the profile.");
        return;
      }
      await save([...(user.roles || []), role]);
    });
    container.querySelector("input")?.addEventListener("keydown", event => {
      if (event.key === "Enter") { event.preventDefault(); container.querySelector("[data-add-profile-role]")?.click(); }
    });
    container.querySelectorAll("[data-remove-profile-role]").forEach(button => {
      button.addEventListener("click", () => save((user.roles || []).filter(role => role !== button.dataset.removeProfileRole)));
    });
  }

  async function openChatProfile(username) {
    try {
      const data = await api("/api/users/" + encodeURIComponent(username), { cache: "no-store" });
      const u = data.user;
      if (!u) return;
      activeUser = u;

      let modal = document.getElementById("friends-profile-modal");
      if (!modal) {
        modal = document.createElement("div");
        modal.id = "friends-profile-modal";
        modal.className = "friends-profile-modal lunar-friends-page";
        modal.hidden = true;
        modal.innerHTML = '<div class="friends-profile-card"><button id="friends-profile-close" class="friends-profile-close" type="button" aria-label="Close profile"><i class="fa-solid fa-xmark"></i></button><div id="friends-profile-banner" class="friends-profile-banner"></div><div class="friends-profile-body"><div id="friends-profile-avatar" class="friends-profile-avatar"></div><div class="friends-profile-name"><h2 id="friends-profile-display"></h2><span id="friends-profile-owner" class="friends-profile-owner" hidden>Owner</span></div><div id="friends-profile-username" class="friends-profile-username"></div><div id="friends-profile-status" class="friends-profile-status"></div><div id="friends-profile-member" class="friends-profile-member"></div><p id="friends-profile-bio" class="friends-profile-bio"></p><div id="friends-profile-actions" class="profile-actions"><button id="friends-profile-message" type="button" class="message-action">Message</button><button id="friends-profile-friend" type="button" class="friend-action">Friend</button><button id="friends-profile-block" type="button" class="block-action">Block</button><button id="friends-profile-report" type="button" class="report-action">Report</button></div><div id="friends-profile-roles" class="friends-profile-roles"></div><div id="friends-profile-stickers" class="friends-profile-stickers"></div></div></div>';
        document.body.appendChild(modal);
        modal.addEventListener("click", event => { if (event.target === modal) closeChatProfile(); });
        document.getElementById("friends-profile-close").onclick = closeChatProfile;
      }

      const avatarHtml = user => user && user.avatarUrl
        ? '<img src="' + escapeAttr(user.avatarUrl) + '" alt="" onerror="this.remove()">'
        : escape(initials(user && (user.displayName || user.username)));

      document.getElementById("friends-profile-avatar").innerHTML = avatarHtml(u);
      document.getElementById("friends-profile-display").textContent = u.displayName || u.username;
      document.getElementById("friends-profile-username").textContent = "@" + u.username;
      document.getElementById("friends-profile-status").textContent = u.isOnline ? "Online" : (u.status || "Offline");
      document.getElementById("friends-profile-status").classList.toggle("is-online", Boolean(u.isOnline));
      document.getElementById("friends-profile-member").textContent = u.createdAt
        ? "Member since " + new Date(u.createdAt).toLocaleDateString([], { month: "short", year: "numeric" }) : "";
      document.getElementById("friends-profile-bio").textContent = u.bio || "No bio yet.";
      document.getElementById("friends-profile-owner").hidden = !u.isOwner;
      document.getElementById("friends-profile-roles").innerHTML = (u.roles || []).map(r => "<span>" + escape(r) + "</span>").join("");

      let roleManager = document.getElementById("friends-profile-role-manager");
      if (!roleManager) {
        roleManager = document.createElement("div");
        roleManager.id = "friends-profile-role-manager";
        document.getElementById("friends-profile-roles").after(roleManager);
      }
      roleManager.innerHTML = "";
      renderProfileRoleManager(roleManager, u);

      document.getElementById("friends-profile-stickers").innerHTML = (u.stickers || []).slice(0, 12).map(sticker =>
        '<img src="' + escapeAttr(sticker.url) + '" alt="' + escapeAttr(sticker.name || "Sticker") + '" loading="lazy">'
      ).join("");

      const banner = document.getElementById("friends-profile-banner");
      banner.style.backgroundImage = u.bannerUrl
        ? 'url("' + String(u.bannerUrl).replace(/"/g, '\\\"') + '")' : "none";

      const card = modal.querySelector(".friends-profile-card");
      const bg = u.backgroundUrl || "";
      card.style.backgroundImage = bg
        ? 'linear-gradient(180deg,rgba(10,12,17,.18),rgba(10,12,17,.94) 62%),url("' + String(bg).replace(/"/g, '\\\"') + '")'
        : "linear-gradient(180deg,#20242d,#17191e)";
      card.style.backgroundSize = bg ? "cover" : "auto";
      card.style.backgroundPosition = "center";

      const actions = document.getElementById("friends-profile-actions");
      const mutuals = Array.isArray(u.mutualFriends) ? u.mutualFriends : [];
      let mutualBox = document.getElementById("friends-profile-mutuals");
      if (!mutualBox) {
        mutualBox = document.createElement("div");
        mutualBox.id = "friends-profile-mutuals";
        mutualBox.className = "friends-profile-mutuals";
        actions.before(mutualBox);
      }
      mutualBox.innerHTML = mutuals.length
        ? '<strong>' + mutuals.length + ' Mutual Friend' + (mutuals.length === 1 ? "" : "s") + '</strong><div>' +
          mutuals.slice(0, 6).map(m => m.avatarUrl
            ? '<img src="' + escapeAttr(m.avatarUrl) + '" alt="@' + escapeAttr(m.username) + '" title="@' + escapeAttr(m.username) + '">'
            : '<span title="@' + escapeAttr(m.username) + '">' + escape(initials(m.displayName || m.username)) + '</span>').join("") + '</div>'
        : "<strong>No Mutual Friends</strong>";

      actions.hidden = !!u.isSelf;
      const message = document.getElementById("friends-profile-message");
      const friend = document.getElementById("friends-profile-friend");
      const block = document.getElementById("friends-profile-block");
      const report = document.getElementById("friends-profile-report");

      message.onclick = () => { location.href = "/friends?user=" + encodeURIComponent(u.username); };
      friend.textContent = u.isFriend ? "Added" : (u.friendRequestPending ? "Pending" : "Friend");
      friend.disabled = !!u.isFriend || !!u.friendRequestPending;
      friend.onclick = async () => {
        try {
          await api("/api/friends/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u.username }) });
          friend.textContent = "Pending";
          friend.disabled = true;
          toast("Friend request sent.");
        } catch (error) { toast(error.message); }
      };
      block.textContent = u.isBlocked ? "Blocked" : "Block";
      block.disabled = !!u.isBlocked;
      block.onclick = async () => {
        if (!confirm("Block @" + u.username + "?")) return;
        try {
          await api("/api/friends/block/" + encodeURIComponent(u.id), { method: "POST" });
          block.textContent = "Blocked";
          block.disabled = true;
          toast("User blocked.");
          closeChatProfile();
        } catch (error) { toast(error.message); }
      };
      report.onclick = async () => {
        try {
          await api("/api/friends/report/" + encodeURIComponent(u.id), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "Reported from Global Chat profile" }) });
          toast("Report submitted.");
        } catch (error) { toast(error.message); }
      };

      modal.hidden = false;
    } catch (error) { toast(error.message); }
  }

  function closeChatProfile() {
    const modal = document.getElementById("friends-profile-modal");
    if (modal) modal.hidden = true;
    activeUser = null;
  }

  async function loadCurrentUser() {
    try {
      const data = await api("/api/auth/me", { cache: "no-store" });
      currentUser = data.user || null;
    } catch (_) { currentUser = null; }
  }

  document.addEventListener("click", event => {
    const target = event.target.closest("[data-member-username]");
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openChatProfile(target.dataset.memberUsername);
  }, true);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      const modal = document.getElementById("friends-profile-modal");
      if (modal && !modal.hidden) closeChatProfile();
    }
  });

  loadCurrentUser();
})();
