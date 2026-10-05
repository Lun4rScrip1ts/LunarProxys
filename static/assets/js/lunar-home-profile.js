(() => {
  const esc = value => {
    const d = document.createElement("div");
    d.textContent = value ?? "";
    return d.innerHTML;
  };
  const attr = value => esc(value).replace(/"/g, "&quot;");
  const initials = value => String(value || "?").trim().slice(0, 2).toUpperCase();
  const api = async (url, options = {}) => {
    const response = await fetch(url, { credentials: "same-origin", ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  };

  let me = null;
  let activeUser = null;
  let modal = null;

  async function loadMe() {
    try {
      const data = await api("/api/friends/bootstrap", { cache: "no-store" });
      me = data.user || null;
    } catch (_) {
      me = null;
    }
    return me;
  }

  function avatarHtml(user) {
    if (user?.avatarUrl) return '<img src="' + attr(user.avatarUrl) + '" alt="" onerror="this.remove()">';
    return esc(initials(user?.displayName || user?.username));
  }

  function ownerRole(username) {
    const name = String(username || "").toLowerCase();
    return name === "lunar" ? "Owner" : name === "lunarstudios" ? "Co-Owner" : "";
  }

  function roleBadges(roles) {
    return (Array.isArray(roles) ? roles : []).map(role => '<span>' + esc(role) + '</span>').join("");
  }

  function statCard(icon, label, value) {
    return '<div class="home-profile-stat"><div><i class="' + icon + '"></i><span>' + esc(label) + '</span></div><strong>' + esc(value || "Not shared yet") + '</strong></div>';
  }

  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "friends-profile-modal";
    modal.className = "friends-profile-modal lunar-friends-page";
    modal.hidden = true;
    modal.innerHTML = '<div class="friends-profile-card">' +
      '<button class="friends-profile-close" type="button" data-home-profile-close aria-label="Close profile"><i class="fa-solid fa-xmark"></i></button>' +
      '<div class="friends-profile-banner" data-home-profile-banner></div>' +
      '<div class="friends-profile-body">' +
        '<div class="friends-profile-avatar" data-home-profile-avatar></div>' +
        '<div class="friends-profile-name"><h2 data-home-profile-display></h2><span class="friends-profile-owner" data-home-profile-owner hidden>Owner</span></div>' +
        '<div class="friends-profile-username" data-home-profile-username></div>' +
        '<div class="friends-profile-status" data-home-profile-status></div>' +
        '<div class="friends-profile-member" data-home-profile-member></div>' +
        '<p class="friends-profile-bio" data-home-profile-bio></p>' +
        '<div class="friends-profile-actions profile-actions" data-home-profile-actions>' +
          '<button type="button" class="message-action" data-home-profile-message>Message</button>' +
          '<button type="button" class="friend-action" data-home-profile-friend>Friend</button>' +
          '<button type="button" class="block-action" data-home-profile-block>Block</button>' +
          '<button type="button" class="report-action" data-home-profile-report>Report</button>' +
        '</div>' +
        '<div class="friends-profile-roles" data-home-profile-roles></div>' +
        '<div class="friends-profile-stickers" data-home-profile-stickers></div>' +
        '<div class="home-profile-stats" data-home-profile-stats></div>' +
      '</div>' +
    '</div>';
    document.body.appendChild(modal);

    modal.addEventListener("click", event => {
      if (event.target === modal || event.target.closest("[data-home-profile-close]")) closeProfile();
    });
    modal.querySelector("[data-home-profile-message]").addEventListener("click", () => {
      if (!activeUser) return;
      window.location.href = "/friends?user=" + encodeURIComponent(activeUser.username);
    });
    modal.querySelector("[data-home-profile-friend]").addEventListener("click", async event => {
      if (!activeUser) return;
      const button = event.currentTarget;
      button.disabled = true;
      try {
        await api("/api/friends/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: activeUser.username })
        });
        button.textContent = "Pending";
        activeUser.friendRequestPending = true;
      } catch (error) {
        button.disabled = false;
        window.alert(error.message);
      }
    });
    modal.querySelector("[data-home-profile-block]").addEventListener("click", async event => {
      if (!activeUser || !confirm("Block @" + activeUser.username + "?")) return;
      const button = event.currentTarget;
      button.disabled = true;
      try {
        await api("/api/friends/block/" + encodeURIComponent(activeUser.id), { method: "POST" });
        button.textContent = "Blocked";
        closeProfile();
      } catch (error) {
        button.disabled = false;
        window.alert(error.message);
      }
    });
    modal.querySelector("[data-home-profile-report]").addEventListener("click", async () => {
      if (!activeUser) return;
      try {
        await api("/api/friends/report/" + encodeURIComponent(activeUser.id), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Reported from homepage profile" })
        });
        window.alert("Report submitted.");
      } catch (error) {
        window.alert(error.message);
      }
    });
    return modal;
  }

  function closeProfile() {
    if (!modal) return;
    modal.hidden = true;
    activeUser = null;
  }

  function renderRoleManager(container, user) {
    if (!container || !["lunar", "lunarstudios"].includes(String(me?.username || "").toLowerCase())) {
      container.innerHTML = "";
      return;
    }
    container.innerHTML = '<div class="profile-role-manager home-profile-role-manager">' +
      '<div class="profile-role-manager-head"><div><strong>Profile Roles</strong><span>Only @lunar and @lunarstudios can edit these tags.</span></div></div>' +
      '<div class="profile-role-manager-list">' + (Array.isArray(user.roles) ? user.roles : []).map(role =>
        '<span class="profile-role-edit-tag">' + esc(role) + '<button type="button" data-remove-home-role="' + attr(role) + '" aria-label="Remove ' + attr(role) + '"><i class="fa-solid fa-xmark"></i></button></span>'
      ).join("") + '</div>' +
      '<div class="profile-role-manager-add"><input type="text" maxlength="32" placeholder="Add a role..."><button type="button" data-add-home-role><i class="fa-solid fa-plus"></i> Add</button></div>' +
    '</div>';

    const save = async roles => {
      try {
        const data = await api("/api/users/" + encodeURIComponent(user.username) + "/roles", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roles })
        });
        user.roles = data.user?.roles || roles;
        renderRoleManager(container, user);
      } catch (error) {
        window.alert(error.message);
      }
    };
    container.querySelector("[data-add-home-role]")?.addEventListener("click", () => {
      const input = container.querySelector("input");
      const role = input.value.trim();
      if (!role) return;
      save([...(user.roles || []), role]);
    });
    container.querySelectorAll("[data-remove-home-role]").forEach(button => {
      button.addEventListener("click", () => save((user.roles || []).filter(role => role !== button.dataset.removeHomeRole)));
    });
  }

  function fillProfile(user) {
    const card = modal.querySelector(".friends-profile-card");
    const banner = modal.querySelector("[data-home-profile-banner]");
    const avatar = modal.querySelector("[data-home-profile-avatar]");
    const display = modal.querySelector("[data-home-profile-display]");
    const owner = modal.querySelector("[data-home-profile-owner]");
    const username = modal.querySelector("[data-home-profile-username]");
    const status = modal.querySelector("[data-home-profile-status]");
    const member = modal.querySelector("[data-home-profile-member]");
    const bio = modal.querySelector("[data-home-profile-bio]");
    const actions = modal.querySelector("[data-home-profile-actions]");
    const friend = modal.querySelector("[data-home-profile-friend]");
    const block = modal.querySelector("[data-home-profile-block]");
    const roles = modal.querySelector("[data-home-profile-roles]");
    const stickers = modal.querySelector("[data-home-profile-stickers]");
    const stats = modal.querySelector("[data-home-profile-stats]");

    avatar.innerHTML = avatarHtml(user);
    display.textContent = user.displayName || user.username;
    username.textContent = "@" + user.username;
    const ownerText = ownerRole(user.username);
    owner.hidden = !ownerText;
    owner.textContent = ownerText || "Owner";
    status.textContent = user.isOnline ? "Online" : (user.status || "Offline");
    status.classList.toggle("is-online", Boolean(user.isOnline));
    member.textContent = user.createdAt ? "Member since " + new Date(user.createdAt).toLocaleDateString([], { month: "short", year: "numeric" }) : "";
    bio.textContent = user.bio || "";
    bio.hidden = !user.bio;

    banner.style.backgroundImage = user.bannerUrl ? 'url("' + String(user.bannerUrl).replace(/"/g, "\\\"") + '")' : "none";
    const background = user.backgroundUrl || "";
    card.style.backgroundImage = background
      ? 'linear-gradient(180deg,rgba(10,12,17,.18),rgba(10,12,17,.94) 62%),url("' + String(background).replace(/"/g, "\\\"") + '")'
      : "linear-gradient(180deg,#20242d,#17191e)";
    card.style.backgroundSize = background ? "cover" : "auto";
    card.style.backgroundPosition = "center";

    actions.hidden = Boolean(user.isSelf);
    friend.textContent = user.isFriend ? "Added" : (user.friendRequestPending ? "Pending" : "Friend");
    friend.disabled = Boolean(user.isFriend || user.friendRequestPending);
    block.textContent = user.isBlocked ? "Blocked" : "Block";
    block.disabled = Boolean(user.isBlocked);

    roles.innerHTML = roleBadges(user.roles);
    renderRoleManager(roles, user);
    stickers.innerHTML = (Array.isArray(user.stickers) ? user.stickers : []).slice(0, 12).map(sticker =>
      '<img src="' + attr(sticker.url) + '" alt="' + attr(sticker.name || "Sticker") + '" loading="lazy">'
    ).join("");
    stickers.hidden = !user.stickers?.length;

    const mutuals = Array.isArray(user.mutualFriends) ? user.mutualFriends : [];
    let mutualBox = modal.querySelector("[data-home-mutuals]");
    if (!mutualBox) {
      mutualBox = document.createElement("div");
      mutualBox.className = "friends-profile-mutuals";
      mutualBox.dataset.homeMutuals = "1";
      actions.before(mutualBox);
    }
    mutualBox.innerHTML = mutuals.length
      ? '<strong>' + mutuals.length + ' Mutual Friend' + (mutuals.length === 1 ? "" : "s") + '</strong><div>' + mutuals.slice(0, 6).map(m =>
          m.avatarUrl ? '<img src="' + attr(m.avatarUrl) + '" alt="@' + attr(m.username) + '" title="@' + attr(m.username) + '">' : '<span title="@' + attr(m.username) + '">' + esc(initials(m.displayName || m.username)) + '</span>'
        ).join("") + '</div>'
      : "<strong>No Mutual Friends</strong>";

    const joined = user.createdAt ? new Date(user.createdAt).toLocaleDateString([], { month: "short", year: "numeric" }) : "Member date unavailable";
    const statusValue = user.status || (user.isOnline ? "Online" : "Not set");
    const recentlyPlayed = Array.isArray(user.recentlyPlayed) ? user.recentlyPlayed.slice(0, 2).map(x => x.name || x.title).filter(Boolean).join(", ") : (user.recentlyPlayed || "Not shared yet");
    const mutualValue = mutuals.length ? mutuals.length + " mutual friend" + (mutuals.length === 1 ? "" : "s") : "No mutual friends";
    stats.innerHTML =
      statCard("fa-solid fa-calendar-days", "JOINED", joined) +
      statCard("fa-solid fa-circle", "STATUS", statusValue) +
      statCard("fa-solid fa-gamepad", "RECENTLY PLAYED", recentlyPlayed) +
      statCard("fa-solid fa-user-group", "MUTUAL FRIENDS", mutualValue) +
      statCard("fa-solid fa-palette", "FAVORITE THEME", user.favoriteTheme || "Not shared yet") +
      statCard("fa-solid fa-arrow-pointer", "FAVORITE CURSOR", user.favoriteCursor || "Not shared yet");
  }

  async function openProfile(username) {
    if (!username) return;
    ensureModal();
    modal.hidden = false;
    try {
      const data = await api("/api/users/" + encodeURIComponent(username), { cache: "no-store" });
      const user = data.user;
      if (!user) return closeProfile();
      activeUser = user;
      fillProfile(user);
    } catch (error) {
      closeProfile();
      window.alert(error.message);
    }
  }

  document.addEventListener("click", event => {
    const target = event.target.closest("[data-member-username]");
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openProfile(target.dataset.memberUsername);
  }, true);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && modal && !modal.hidden) closeProfile();
  });

  loadMe();
})();
