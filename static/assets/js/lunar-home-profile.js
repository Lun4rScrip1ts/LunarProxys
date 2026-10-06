(() => {
  let currentUser = null;
  let toastTimer = null;
  const escape = value => { const div = document.createElement("div"); div.textContent = value ?? ""; return div.innerHTML; };
  const escapeAttr = value => escape(value).replace(/"/g, "&quot;");
  const initials = name => (name || "?").trim().slice(0, 2).toUpperCase();
  const api = async (url, options) => { const response = await fetch(url, { credentials: "same-origin", ...options }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Something went wrong."); return data; };
  const showToast = message => { let toast = document.getElementById("home-profile-toast"); if (!toast) { toast = document.createElement("div"); toast.id = "home-profile-toast"; toast.className = "friends-toast"; document.body.appendChild(toast); } clearTimeout(toastTimer); toast.textContent = message; toast.classList.add("show"); toastTimer = setTimeout(() => toast.classList.remove("show"), 2200); };
  const canManageProfileRoles = () => ["lunar", "lunarstudios"].includes(String(currentUser?.username || "").toLowerCase());

  async function renderProfileRoleManager(container, user) {
    if (!container || !canManageProfileRoles()) return;
    container.innerHTML = '<div class="profile-role-manager"><div class="profile-role-manager-head"><div><strong>Profile Roles</strong><span>Only @lunar and @lunarstudios can edit these tags.</span></div></div><div class="profile-role-manager-list">' + (user.roles || []).map(role => '<span class="profile-role-edit-tag">' + escape(role) + '<button type="button" data-remove-profile-role="' + escapeAttr(role) + '" aria-label="Remove ' + escapeAttr(role) + '"><i class="fa-solid fa-xmark"></i></button></span>').join("") + '</div><div class="profile-role-manager-add"><input type="text" maxlength="32" placeholder="Add a role..."><button type="button" data-add-profile-role><i class="fa-solid fa-plus"></i> Add</button></div></div>';
    const save = async roles => { try { const data = await api("/api/users/" + encodeURIComponent(user.username) + "/roles", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roles }) }); user.roles = data.user?.roles || roles; fillProfile(user); showToast("Profile roles updated."); } catch (e) { showToast(e.message); } };
    container.querySelector("[data-add-profile-role]")?.addEventListener("click", () => { const input = container.querySelector("input"), role = input?.value.trim(); if (role) save([...(user.roles || []), role]); });
    container.querySelectorAll("[data-remove-profile-role]").forEach(button => button.addEventListener("click", () => save((user.roles || []).filter(role => role !== button.dataset.removeProfileRole))));
  }

  function ensureModal() {
    let wrapper = document.getElementById("lunar-home-chat-profile-root");
    if (!wrapper) { wrapper = document.createElement("div"); wrapper.id = "lunar-home-chat-profile-root"; wrapper.className = "lunar-community-page"; document.body.appendChild(wrapper); }
    let modal = document.getElementById("friends-profile-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "friends-profile-modal";
      modal.className = "friends-profile-modal";
      modal.hidden = true;
      modal.innerHTML = '<div class="friends-profile-card"><button id="friends-profile-close" class="friends-profile-close" type="button" aria-label="Close profile"><i class="fa-solid fa-xmark"></i></button><div id="friends-profile-banner" class="friends-profile-banner"></div><div class="friends-profile-body"><div id="friends-profile-avatar" class="friends-profile-avatar"></div><div class="friends-profile-name"><h2 id="friends-profile-display"></h2><span id="friends-profile-owner" class="friends-profile-owner" hidden>Owner</span></div><div id="friends-profile-username" class="friends-profile-username"></div><div id="friends-profile-status" class="friends-profile-status"></div><div id="friends-profile-member" class="friends-profile-member"></div><p id="friends-profile-bio" class="friends-profile-bio"></p><div id="friends-profile-actions" class="profile-actions"><button id="friends-profile-message" type="button" class="message-action">Message</button><button id="friends-profile-friend" type="button" class="friend-action">Friend</button><button id="friends-profile-block" type="button" class="block-action">Block</button><button id="friends-profile-report" type="button" class="report-action">Report</button></div><div id="friends-profile-roles" class="friends-profile-roles"></div><div id="friends-profile-stickers" class="friends-profile-stickers"></div></div></div>';
      wrapper.appendChild(modal);
      modal.addEventListener("click", e => { if (e.target === modal) closeProfile(); });
      document.getElementById("friends-profile-close").onclick = closeProfile;
    }
    return modal;
  }

  function closeProfile() { const modal = document.getElementById("friends-profile-modal"); if (modal) modal.hidden = true; }

  function setProfileImageBackground(element, url, fallback = "none") {
    if (!element) return;
    if (!url) {
      element.style.removeProperty("background-image");
      element.style.backgroundImage = fallback;
      return;
    }
    const safeUrl = String(url).replace(/\\/g, "\\\\").replace(/"/g, '\\\"');
    element.style.setProperty("background-image", 'url("' + safeUrl + '")', "important");
  }

  async function openProfile(username) {
    try {
      const data = await api("/api/users/" + encodeURIComponent(username), { cache: "no-store" });
      const u = data.user;
      if (!u) return;
      const modal = ensureModal();
      const avatar = document.getElementById("friends-profile-avatar");
      avatar.innerHTML = u.avatarUrl ? '<img src="' + escapeAttr(u.avatarUrl) + '" alt="" onerror="this.outerHTML=\'<span>\' + escape(initials(' + JSON.stringify(u.displayName || u.username) + ')) + \'</span>\'">' : escape(initials(u.displayName || u.username));
      document.getElementById("friends-profile-display").textContent = u.displayName || u.username;
      document.getElementById("friends-profile-username").textContent = "@" + u.username;
      document.getElementById("friends-profile-status").textContent = u.isOnline ? "Online" : (u.status || "Offline");
      document.getElementById("friends-profile-status").classList.toggle("is-online", Boolean(u.isOnline));
      document.getElementById("friends-profile-member").textContent = u.createdAt ? "Member since " + new Date(u.createdAt).toLocaleDateString([], {month:"short",year:"numeric"}) : "";
      document.getElementById("friends-profile-bio").textContent = u.bio || "No bio yet.";
      document.getElementById("friends-profile-owner").hidden = !u.isOwner;
      document.getElementById("friends-profile-roles").innerHTML = (u.roles || []).map(r => "<span>" + escape(r) + "</span>").join("");
      let roleManager = document.getElementById("friends-profile-role-manager");
      if (!roleManager) { roleManager = document.createElement("div"); roleManager.id = "friends-profile-role-manager"; document.getElementById("friends-profile-roles").after(roleManager); }
      roleManager.innerHTML = "";
      renderProfileRoleManager(roleManager, u);
      document.getElementById("friends-profile-stickers").innerHTML = (u.stickers || []).slice(0, 12).map(sticker => '<img src="' + escapeAttr(sticker.url) + '" alt="' + escapeAttr(sticker.name || "Sticker") + '" loading="lazy">').join("");

      // Use the exact profile images saved in Account Settings.
      const banner = document.getElementById("friends-profile-banner");
      setProfileImageBackground(banner, u.bannerUrl);
      banner.style.backgroundSize = "cover";
      banner.style.backgroundPosition = "center";
      banner.style.backgroundRepeat = "no-repeat";
      const card = modal.querySelector(".friends-profile-card");
      if (u.backgroundUrl) {
        const safeBackground = String(u.backgroundUrl).replace(/\\/g, "\\\\").replace(/"/g, '\\\"');
        card.style.setProperty("background-image", 'linear-gradient(180deg,rgba(10,12,17,.18),rgba(10,12,17,.94) 62%),url("' + safeBackground + '")', "important");
        card.style.backgroundSize = "cover";
        card.style.backgroundPosition = "center";
        card.style.backgroundRepeat = "no-repeat";
      } else {
        card.style.setProperty("background-image", "linear-gradient(180deg,#20242d,#17191e)", "important");
      }

      const actions = document.getElementById("friends-profile-actions");
      const mutuals = Array.isArray(u.mutualFriends) ? u.mutualFriends : [];
      let mutualBox = document.getElementById("friends-profile-mutuals");
      if (!mutualBox) { mutualBox = document.createElement("div"); mutualBox.id = "friends-profile-mutuals"; mutualBox.className = "friends-profile-mutuals"; actions.before(mutualBox); }
      mutualBox.innerHTML = mutuals.length ? '<strong>' + mutuals.length + ' Mutual Friend' + (mutuals.length === 1 ? "" : "s") + '</strong><div>' + mutuals.slice(0, 6).map(m => m.avatarUrl ? '<img src="' + escapeAttr(m.avatarUrl) + '" alt="@' + escapeAttr(m.username) + '" title="@' + escapeAttr(m.username) + '">' : '<span title="@' + escapeAttr(m.username) + '">' + escape(initials(m.displayName || m.username)) + '</span>').join("") + '</div>' : "<strong>No Mutual Friends</strong>";
      actions.hidden = !!u.isSelf;
      const message = document.getElementById("friends-profile-message"), friend = document.getElementById("friends-profile-friend"), block = document.getElementById("friends-profile-block"), report = document.getElementById("friends-profile-report");
      message.onclick = () => { location.href = "/friends?user=" + encodeURIComponent(u.username); };
      friend.textContent = u.isFriend ? "Added" : (u.friendRequestPending ? "Pending" : "Friend");
      friend.disabled = !!u.isFriend || !!u.friendRequestPending;
      friend.onclick = async () => { try { await api("/api/friends/requests", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:u.username})}); friend.textContent = "Pending"; friend.disabled = true; showToast("Friend request sent."); } catch(e) { showToast(e.message); } };
      block.textContent = u.isBlocked ? "Blocked" : "Block";
      block.disabled = !!u.isBlocked;
      block.onclick = async () => { if (!confirm("Block @" + u.username + "?")) return; try { await api("/api/friends/block/" + encodeURIComponent(u.id), {method:"POST"}); block.textContent = "Blocked"; block.disabled = true; showToast("User blocked."); closeProfile(); } catch(e) { showToast(e.message); } };
      report.onclick = async () => { try { await api("/api/friends/report/" + encodeURIComponent(u.id), {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reason:"Reported from Global Chat profile"})}); showToast("Report submitted."); } catch(e) { showToast(e.message); } };
      modal.hidden = false;
    } catch(e) { showToast(e.message); }
  }

  document.addEventListener("click", e => { const target = e.target.closest("[data-member-username]"); if (!target) return; e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); openProfile(target.dataset.memberUsername); }, true);
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeProfile(); });
  api("/api/friends/bootstrap", {cache:"no-store"}).then(data => { currentUser = data.user || null; }).catch(() => { currentUser = null; });
})();
