(() => {
  "use strict";
  const STORE_KEY = "lunar.social.notifications.v2";
  const CHANNEL_NAME = "lunar-social";
  let notifications = [];
  let channel = null;
  let center = null;
  let list = null;
  let badge = null;
  let initialized = false;
  const esc = value => { const d = document.createElement("div"); d.textContent = value ?? ""; return d.innerHTML; };
  const read = () => { try { const v = JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); return Array.isArray(v) ? v.slice(0, 80) : []; } catch { return []; } };
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(notifications.slice(0, 80))); } catch {} };
  const unreadCount = () => notifications.filter(n => !n.read).length;
  const iconFor = type => ({message:"fa-comments",mention:"fa-at",friend:"fa-user-plus",reaction:"fa-face-smile",system:"fa-satellite-dish"}[type] || "fa-bell");
  const relativeTime = value => {
    const delta = Math.max(0, Date.now() - new Date(value).getTime());
    const min = Math.floor(delta / 60000);
    if (min < 1) return "just now";
    if (min < 60) return min + "m ago";
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr + "h ago";
    const day = Math.floor(hr / 24);
    return day < 7 ? day + "d ago" : new Date(value).toLocaleDateString();
  };
  function push(type, title, body, href = "") {
    const id = type + ":" + title + ":" + body + ":" + Math.floor(Date.now() / 5000);
    if (notifications.some(n => n.id === id)) return;
    notifications.unshift({id,type,title,body,href,time:new Date().toISOString(),read:false});
    notifications = notifications.slice(0,80); save(); render();
    try { channel?.postMessage({kind:"notification",notification:notifications[0]}); } catch {}
  }
  window.LunarSocial = { notify: push, markAllRead: () => { notifications.forEach(n => n.read = true); save(); render(); }, clear: () => { notifications=[]; save(); render(); } };

  function render() {
    if (!list || !badge) return;
    const count = unreadCount();
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.hidden = !count;
    list.innerHTML = notifications.length ? notifications.map(n => `<button class="lunar-notification-item ${n.read ? "" : "unread"}" data-notification-id="${esc(n.id)}" data-notification-href="${esc(n.href || "")}"><span class="lunar-notification-icon"><i class="fa-solid ${iconFor(n.type)}"></i></span><span class="lunar-notification-copy"><strong>${esc(n.title)}</strong><p>${esc(n.body)}</p><time>${esc(relativeTime(n.time))}</time></span></button>`).join("") : '<div class="lunar-notification-empty"><i class="fa-regular fa-bell-slash"></i><br><br>No notifications yet.</div>';
  }
  function createCenter() {
    if (center) return;
    const nav = document.querySelector(".nav-bar");
    if (!nav) return;
    const right = nav.querySelector(".nav-bar-right") || nav;
    const wrap = document.createElement("div");
    wrap.className = "lunar-notification-trigger-wrap";
    wrap.innerHTML = '<button type="button" class="lunar-social-bell" id="lunar-notification-bell" aria-label="Notifications" aria-expanded="false"><i class="fa-regular fa-bell"></i><b class="lunar-social-badge" hidden>0</b></button>';
    right.appendChild(wrap);
    const bell = wrap.firstElementChild; badge = bell.querySelector(".lunar-social-badge");
    center = document.createElement("aside"); center.className = "lunar-notification-center"; center.setAttribute("aria-hidden","true");
    center.innerHTML = '<div class="lunar-notification-head"><div><strong>Notifications</strong><span>Chat, friends, reactions and Lunar activity</span></div><div class="lunar-notification-actions"><button type="button" id="lunar-notification-read">Read all</button><button type="button" id="lunar-notification-clear">Clear</button></div></div><div class="lunar-notification-list"></div>';
    document.body.appendChild(center); list = center.querySelector(".lunar-notification-list");
    bell.addEventListener("click", e => { e.stopPropagation(); const open = center.classList.toggle("open"); center.setAttribute("aria-hidden", String(!open)); bell.setAttribute("aria-expanded", String(open)); if (open) { render(); } });
    center.addEventListener("click", e => {
      const item = e.target.closest("[data-notification-id]"); if (!item) return;
      const n = notifications.find(x => x.id === item.dataset.notificationId); if (!n) return;
      n.read = true; save(); render();
      const href = item.dataset.notificationHref;
      if (href && href.startsWith("/")) location.href = href;
    });
    center.querySelector("#lunar-notification-read").onclick = () => window.LunarSocial.markAllRead();
    center.querySelector("#lunar-notification-clear").onclick = () => window.LunarSocial.clear();
    document.addEventListener("click", e => { if (center.classList.contains("open") && !center.contains(e.target) && !wrap.contains(e.target)) { center.classList.remove("open"); center.setAttribute("aria-hidden","true"); bell.setAttribute("aria-expanded","false"); } });
  }

  function enhanceProfiles() {
    const body = document.getElementById("friends-profile-modal")?.querySelector(".friends-profile-body");
    if (!body || body.querySelector(".lunar-profile-extras")) return;
    const username = (document.getElementById("friends-profile-username")?.textContent || "").replace(/^@/,"").trim();
    const memberText = document.getElementById("friends-profile-member")?.textContent || "";
    const status = document.getElementById("friends-profile-status")?.textContent || "Not set";
    const owner = document.getElementById("friends-profile-owner")?.hidden === false;
    const extras = document.createElement("div"); extras.className = "lunar-profile-extras";
    extras.innerHTML = `<article class="lunar-profile-card"><div class="lunar-profile-card-head"><i class="fa-solid fa-calendar-days"></i> Joined</div><div class="lunar-profile-card-value">${esc(memberText || "Member date unavailable")}</div></article><article class="lunar-profile-card"><div class="lunar-profile-card-head"><i class="fa-solid fa-circle"></i> Status</div><div class="lunar-profile-card-value">${esc(status || "Not set")}</div></article><article class="lunar-profile-card"><div class="lunar-profile-card-head"><i class="fa-solid fa-gamepad"></i> Recently played</div><div class="lunar-profile-card-value">Not shared yet</div></article><article class="lunar-profile-card"><div class="lunar-profile-card-head"><i class="fa-solid fa-user-group"></i> Mutual friends</div><div class="lunar-profile-card-value">Available from Friends</div></article><article class="lunar-profile-card"><div class="lunar-profile-card-head"><i class="fa-solid fa-palette"></i> Favorite theme</div><div class="lunar-profile-card-value">Not shared yet</div></article><article class="lunar-profile-card"><div class="lunar-profile-card-head"><i class="fa-solid fa-arrow-pointer"></i> Favorite cursor</div><div class="lunar-profile-card-value">Not shared yet</div></article><article class="lunar-profile-card wide"><div class="lunar-profile-card-head"><i class="fa-solid fa-award"></i> Badges</div><div class="lunar-profile-badges"><span class="lunar-profile-badge">${owner ? "Owner" : "Lunar Member"}</span><span class="lunar-profile-badge">Community</span></div><p class="lunar-profile-note">${username ? "@" + esc(username) + "'s profile" : "Lunar profile"} · Custom banners, avatars, bios, statuses, themes and cursors are designed to work as one identity system.</p></article>`;
    body.appendChild(extras);
  }
  function observeProfile() {
    const modal = document.getElementById("friends-profile-modal"); if (!modal) return;
    new MutationObserver(() => { if (!modal.hidden) setTimeout(enhanceProfiles, 50); }).observe(modal, {subtree:true, childList:true, attributes:true, attributeFilter:["hidden"]});
    document.addEventListener("click", e => { if (e.target.closest("[data-profile-user]")) setTimeout(enhanceProfiles, 120); });
  }

  function setupChatPolish() {
    const messages = document.getElementById("chat-messages");
    if (!messages) return;
    const toolbar = document.querySelector(".chat-toolbar");
    if (toolbar && !toolbar.querySelector(".lunar-social-toolbar")) {
      const status = document.getElementById("chat-status");
      const tools = document.createElement("div"); tools.className = "lunar-social-toolbar";
      const search = document.createElement("input"); search.className="lunar-social-search"; search.placeholder="Search messages…"; search.setAttribute("aria-label","Search chat history");
      tools.appendChild(search); if(status) tools.appendChild(status); toolbar.appendChild(tools);
      const results = document.createElement("div"); results.className="lunar-search-results"; results.hidden=true; toolbar.style.position="relative"; toolbar.appendChild(results);
      search.addEventListener("input", () => {
        const q=search.value.trim().toLowerCase(); if(!q){results.hidden=true;return;}
        const found=[...messages.querySelectorAll(".chat-message")].filter(m=>(m.textContent||"").toLowerCase().includes(q)).slice(-12).reverse();
        results.innerHTML=found.map(m=>`<button class="lunar-search-result" data-jump-message="${esc(m.dataset.messageId||"")}">${esc((m.querySelector(".chat-name")?.textContent||"User"))}: <mark>${esc((m.querySelector(".chat-text")?.textContent||"attachment").slice(0,90))}</mark></button>`).join("") || '<div class="lunar-search-result">No matching messages.</div>'; results.hidden=false;
      });
      results.addEventListener("click", e => { const b=e.target.closest("[data-jump-message]"); if(!b)return; const m=document.querySelector(`[data-message-id="${CSS.escape(b.dataset.jumpMessage)}"]`); if(m){m.scrollIntoView({behavior:"smooth",block:"center"});m.classList.add("lunar-interactive-card");setTimeout(()=>m.classList.remove("lunar-interactive-card"),900)} results.hidden=true;search.value=""; });
    }
    let lastAtBottom=true; let initial=true; const seen=new Set();
    const process = () => {
      const rows=[...messages.querySelectorAll(".chat-message")];
      rows.forEach((row,i)=>{ const key=row.dataset.messageId; const prev=rows[i-1]; if(prev && prev.dataset.userId && prev.dataset.userId===row.dataset.userId) row.classList.add("lunar-message-grouped"); if(!row.dataset.userId){ const name=row.querySelector(".chat-username")?.textContent||row.querySelector(".chat-name")?.textContent||""; row.dataset.userId=name; } if(key)seen.add(key); row.querySelectorAll(".chat-text").forEach(text=>{ if(!text.dataset.mentions){ text.dataset.mentions="1"; text.innerHTML=esc(text.textContent).replace(/(^|\s)@([A-Za-z0-9_]{4,20})/g,'$1<span class="lunar-mention">@$2</span>'); }}); });
      if(initial){initial=false;lastAtBottom=messages.scrollHeight-messages.scrollTop-messages.clientHeight<80;return;}
      const atBottom=messages.scrollHeight-messages.scrollTop-messages.clientHeight<80;
      if(!atBottom && rows.length && rows.some(r=>!seen.has(r.dataset.messageId||""))) showJump(messages);
      lastAtBottom=atBottom;
    };
    const showJump = box => { let b=document.querySelector(".lunar-jump-button"); if(!b){b=document.createElement("button");b.className="lunar-jump-button";b.innerHTML='<i class="fa-solid fa-arrow-down"></i> New messages';document.body.appendChild(b);b.onclick=()=>{box.scrollTo({top:box.scrollHeight,behavior:"smooth"});b.classList.remove("show")};} b.classList.add("show"); };
    messages.addEventListener("scroll",()=>{if(messages.scrollHeight-messages.scrollTop-messages.clientHeight<80)document.querySelector(".lunar-jump-button")?.classList.remove("show")},{passive:true});
    new MutationObserver(process).observe(messages,{childList:true,subtree:true}); process();
    // Typing UX: local composer state is broadcast to another open Lunar tab.
    const input=document.getElementById("chat-input"); if(input){let timer;input.addEventListener("input",()=>{clearTimeout(timer);try{channel?.postMessage({kind:"typing",page:"chat",active:Boolean(input.value.trim())})}catch{};timer=setTimeout(()=>{try{channel?.postMessage({kind:"typing",page:"chat",active:false})}catch{}},900)});}
  }
  function setupFriendPolish(){
    const messages=document.getElementById("dm-messages"); if(!messages)return;
    let typing=document.createElement("div"); typing.className="lunar-typing"; typing.hidden=true; typing.innerHTML='<span class="lunar-typing-dots"><i></i><i></i><i></i></span><span>Typing…</span>'; messages.parentElement?.insertBefore(typing,messages);
    const input=document.getElementById("dm-input"); if(input){let timer;input.addEventListener("input",()=>{clearTimeout(timer);try{channel?.postMessage({kind:"typing",page:"friends",active:Boolean(input.value.trim())})}catch{};timer=setTimeout(()=>{try{channel?.postMessage({kind:"typing",page:"friends",active:false})}catch{}},900)});}
    new MutationObserver(()=>{[...messages.children].forEach((row,i)=>{const prev=messages.children[i-1];if(prev&&row.dataset.sender===prev.dataset.sender)row.classList.add("lunar-message-grouped")})}).observe(messages,{childList:true,subtree:true});
  }
  function setupInteractiveCards(){ document.querySelectorAll(".friend-item,.chat-message,.profile-actions button,.sticker-card,.game-card,.movie-card,.app-card,.settings-card").forEach(el=>el.classList.add("lunar-interactive-card")); }
  function setupChannel(){ try{channel=new BroadcastChannel(CHANNEL_NAME);channel.onmessage=e=>{const d=e.data||{};if(d.kind==="notification"&&d.notification){notifications.unshift(d.notification);notifications=notifications.slice(0,80);save();render();} if(d.kind==="typing"){document.querySelectorAll(".lunar-typing").forEach(el=>el.hidden=!d.active);}}}catch{channel=null} }
  function init(){if(initialized)return;initialized=true;notifications=read();createCenter();observeProfile();setupChatPolish();setupFriendPolish();setupInteractiveCards();render();setupChannel();
    // Keep both pages in sync without coupling their message implementations.
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)render()});
    setInterval(()=>{ if(document.visibilityState==="visible") setupInteractiveCards(); },2500);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();