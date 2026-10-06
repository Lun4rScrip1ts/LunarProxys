(() => {
  const esc = value => { const d = document.createElement("div"); d.textContent = value ?? ""; return d.innerHTML; };
  const attr = value => esc(value).replace(/"/g, "&quot;");
  const initials = value => String(value || "?").slice(0, 2).toUpperCase();
  const api = async (url, options = {}) => { const r = await fetch(url, { credentials: "same-origin", ...options }); const d = await r.json().catch(() => ({})); if (!r.ok) throw Error(d.error || "Something went wrong."); return d; };
  let currentUser = null, activeUser = null, scope = null, modal = null;
  const toast = message => { let e = document.getElementById("lunar-home-profile-toast"); if (!e) { e = document.createElement("div"); e.id = "lunar-home-profile-toast"; e.className = "friends-toast"; document.body.appendChild(e); } e.textContent = message; e.classList.add("show"); clearTimeout(e._timer); e._timer = setTimeout(() => e.classList.remove("show"), 2200); };
  async function loadCurrentUser() { try { const d = await api("/api/friends/bootstrap", { cache: "no-store" }); currentUser = d.user || null; } catch (_) { currentUser = null; } }
  const avatarHtml = u => u?.avatarUrl ? '<img src="' + attr(u.avatarUrl) + '" alt="" onerror="this.remove()">' : esc(initials(u?.displayName || u?.username));
  const canManageRoles = () => ["lunar", "lunarstudios"].includes(String(currentUser?.username || "").toLowerCase());

  function ensureModal() {
    if (modal) return modal;
    scope = document.createElement("div");
    scope.className = "lunar-community-page lunar-home-profile-scope";
    scope.style.position = "static";
    scope.style.minHeight = "0";
    document.body.appendChild(scope);
    modal = document.createElement("div");
    modal.id = "friends-profile-modal";
    modal.className = "friends-profile-modal";
    modal.hidden = true;
    modal.innerHTML = '<div class="friends-profile-card"><button id="friends-profile-close" class="friends-profile-close" type="button" aria-label="Close profile"><i class="fa-solid fa-xmark"></i></button><div id="friends-profile-banner" class="friends-profile-banner"></div><div class="friends-profile-body"><div id="friends-profile-avatar" class="friends-profile-avatar"></div><div class="friends-profile-name"><h2 id="friends-profile-display"></h2><span id="friends-profile-owner" class="friends-profile-owner" hidden>Owner</span></div><div id="friends-profile-username" class="friends-profile-username"></div><div id="friends-profile-status" class="friends-profile-status"></div><div id="friends-profile-member" class="friends-profile-member"></div><p id="friends-profile-bio" class="friends-profile-bio"></p><div id="friends-profile-actions" class="profile-actions friends-profile-actions"><button id="friends-profile-message" type="button" class="message-action">Message</button><button id="friends-profile-friend" type="button" class="friend-action">Friend</button><button id="friends-profile-block" type="button" class="block-action">Block</button><button id="friends-profile-report" type="button" class="report-action">Report</button></div><div id="friends-profile-roles" class="friends-profile-roles"></div><div id="friends-profile-stickers" class="friends-profile-stickers"></div></div></div>';
    scope.appendChild(modal);
    modal.addEventListener("click", e => { if (e.target === modal) closeProfile(); });
    document.getElementById("friends-profile-close").onclick = closeProfile;
    return modal;
  }

  async function renderRoleManager(container, user) {
    if (!container || !canManageRoles()) return;
    container.innerHTML = '<div class="profile-role-manager"><div class="profile-role-manager-head"><div><strong>Profile Roles</strong><span>Only @lunar and @lunarstudios can edit these tags.</span></div></div><div class="profile-role-manager-list">' + (user.roles || []).map(r => '<span class="profile-role-edit-tag">' + esc(r) + '<button type="button" data-remove-home-role="' + attr(r) + '"><i class="fa-solid fa-xmark"></i></button></span>').join("") + '</div><div class="profile-role-manager-add"><input type="text" maxlength="32" placeholder="Add a role..."><button type="button" data-add-home-role><i class="fa-solid fa-plus"></i> Add</button></div></div>';
    const save = async roles => { try { const d = await api("/api/users/" + encodeURIComponent(user.username) + "/roles", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roles }) }); user.roles = d.user?.roles || []; fillProfile(user); toast("Profile roles updated."); } catch (e) { toast(e.message); } };
    container.querySelector("[data-add-home-role]")?.addEventListener("click", () => { const input = container.querySelector("input"), role = (input?.value || "").trim(); if (!role) return; if ((user.roles || []).some(r => r.toLowerCase() === role.toLowerCase())) return toast("That role is already on the profile."); save([...(user.roles || []), role]); });
    container.querySelector("input")?.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); container.querySelector("[data-add-home-role]")?.click(); } });
    container.querySelectorAll("[data-remove-home-role]").forEach(b => b.addEventListener("click", () => save((user.roles || []).filter(r => r !== b.dataset.removeHomeRole))));
  }

  function fillProfile(u) {
    ensureModal(); activeUser = u;
    const $ = id => document.getElementById(id);
    $("friends-profile-avatar").innerHTML = avatarHtml(u);
    $("friends-profile-display").textContent = u.displayName || u.username;
    $("friends-profile-username").textContent = "@" + u.username;
    $("friends-profile-status").textContent = u.isOnline ? "Online" : (u.status || "Offline");
    $("friends-profile-status").classList.toggle("is-online", Boolean(u.isOnline));
    $("friends-profile-member").textContent = u.createdAt ? "Member since " + new Date(u.createdAt).toLocaleDateString([], { month: "short", year: "numeric" }) : "";
    $("friends-profile-bio").textContent = u.bio || "No bio yet.";
    $("friends-profile-owner").hidden = !u.isOwner;
    const banner = $("friends-profile-banner");
    banner.style.backgroundImage = u.bannerUrl ? 'url("' + String(u.bannerUrl).replace(/"/g, '\\\"') + '")' : "none";
    const card = modal.querySelector(".friends-profile-card"), bg = u.backgroundUrl || "";
    card.style.backgroundImage = bg ? 'linear-gradient(180deg,rgba(10,12,17,.18),rgba(10,12,17,.94) 62%),url("' + String(bg).replace(/"/g, '\\\"') + '")' : "linear-gradient(180deg,#20242d,#17191e)";
    card.style.backgroundSize = bg ? "cover" : "auto"; card.style.backgroundPosition = "center";
    $("friends-profile-roles").innerHTML = (u.roles || []).map(r => "<span>" + esc(r) + "</span>").join("");
    let manager = document.getElementById("friends-profile-role-manager"); if (!manager) { manager = document.createElement("div"); manager.id = "friends-profile-role-manager"; $("friends-profile-roles").after(manager); } manager.innerHTML = ""; renderRoleManager(manager, u);
    $("friends-profile-stickers").innerHTML = (u.stickers || []).slice(0, 12).map(s => '<img src="' + attr(s.url) + '" alt="' + attr(s.name || "Sticker") + '" loading="lazy">').join("");
    const actions = $("friends-profile-actions"), mutuals = Array.isArray(u.mutualFriends) ? u.mutualFriends : [];
    let mutualBox = document.getElementById("friends-profile-mutuals"); if (!mutualBox) { mutualBox = document.createElement("div"); mutualBox.id = "friends-profile-mutuals"; mutualBox.className = "friends-profile-mutuals"; actions.before(mutualBox); }
    mutualBox.innerHTML = mutuals.length ? '<strong>' + mutuals.length + ' Mutual Friend' + (mutuals.length === 1 ? "" : "s") + '</strong><div>' + mutuals.slice(0, 6).map(m => m.avatarUrl ? '<img src="' + attr(m.avatarUrl) + '" alt="@' + attr(m.username) + '">' : '<span>' + esc(initials(m.displayName || m.username)) + '</span>').join("") + '</div>' : "<strong>No Mutual Friends</strong>";
    actions.hidden = !!u.isSelf;
    const message = $("friends-profile-message"), friend = $("friends-profile-friend"), block = $("friends-profile-block"), report = $("friends-profile-report");
    message.onclick = () => { location.href = "/friends?user=" + encodeURIComponent(u.username); };
    friend.textContent = u.isFriend ? "Added" : (u.friendRequestPending ? "Pending" : "Friend"); friend.disabled = !!u.isFriend || !!u.friendRequestPending;
    friend.onclick = async () => { try { await api("/api/friends/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u.username }) }); friend.textContent = "Pending"; friend.disabled = true; toast("Friend request sent."); } catch (e) { toast(e.message); } };
    block.textContent = u.isBlocked ? "Blocked" : "Block"; block.disabled = !!u.isBlocked;
    block.onclick = async () => { if (!confirm("Block @" + u.username + "?")) return; try { await api("/api/friends/block/" + encodeURIComponent(u.id), { method: "POST" }); toast("User blocked."); closeProfile(); } catch (e) { toast(e.message); } };
    report.onclick = async () => { try { await api("/api/friends/report/" + encodeURIComponent(u.id), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "Reported from homepage profile" }) }); toast("Report submitted."); } catch (e) { toast(e.message); } };
    modal.hidden = false;
  }

  function closeProfile() { if (modal) modal.hidden = true; activeUser = null; }
  async function openProfile(username) { if (!username) return; ensureModal(); try { const d = await api("/api/users/" + encodeURIComponent(username), { cache: "no-store" }); if (d.user) fillProfile(d.user); } catch (e) { toast(e.message); } }
  document.addEventListener("click", e => { const target = e.target.closest("[data-member-username]"); if (!target) return; e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); openProfile(target.dataset.memberUsername); }, true);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && modal && !modal.hidden) closeProfile(); });
  loadCurrentUser();
})();
