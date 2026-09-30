(() => {
const $=id=>document.getElementById(id);
const api=async(url,opt={})=>{const r=await fetch(url,{credentials:"same-origin",...opt});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"Something went wrong.");return d};
const esc=v=>{const d=document.createElement("div");d.textContent=v??"";return d.innerHTML};
const initials=n=>(n||"?").slice(0,2).toUpperCase();
let me=null,friends=[],incoming=[],outgoing=[],blocked=[],threads=[],threadByUser={},unread=[],active=null,messages=[],reply=null,editing=null,gifDraft=null,gifKey="",gifTab="trending",menuMessage=null,timer=null;
const toast=m=>{clearTimeout(timer);$("friends-toast").textContent=m;$("friends-toast").classList.add("show");timer=setTimeout(()=>$("friends-toast").classList.remove("show"),2200)};
const avatar=u=>{
  const online=Boolean(u?.isOnline);
  const name=u?.displayName||u?.username||"";
  return u&&u.avatarUrl
    ? '<div class="friend-avatar friend-profile-avatar-trigger" data-profile-user="'+esc(u.username||"")+'"><img src="'+esc(u.avatarUrl)+'" alt=""><i class="'+(online?"is-online":"")+'"></i></div>'
    : '<div class="friend-avatar friend-profile-avatar-trigger" data-profile-user="'+esc(u.username||"")+'">'+esc(initials(name))+'<i class="'+(online?"is-online":"")+'"></i></div>';
};
const friendOf=id=>Boolean(friends.some(x=>x.id===id&&x.isFriend));
function renderFriends(){
  const e=$("friends-list");
  const filter=($("friends-filter")?.value||"").trim().toLowerCase();
  const onlineOnly=document.querySelector(".friends-tab.active")?.dataset.tab==="online";
  const visible=friends
    .filter(f=>{
      const name=((f.displayName||"")+" "+(f.username||"")).toLowerCase();
      return (!filter||name.includes(filter))&&(!onlineOnly||Boolean(f.isOnline));
    })
    .sort((a,b)=>{
      const ua=(threadByUser[a.id]?.unreadCount||0), ub=(threadByUser[b.id]?.unreadCount||0);
      if(ua!==ub)return ub-ua;
      const ta=Date.parse(threadByUser[a.id]?.lastMessage?.createdAt||0)||0;
      const tb=Date.parse(threadByUser[b.id]?.lastMessage?.createdAt||0)||0;
      if(ta!==tb)return tb-ta;
      return String(a.displayName||a.username).localeCompare(String(b.displayName||b.username));
    });
  e.innerHTML=visible.map(f=>{
    const t=threadByUser[f.id];
    const preview=t?.lastMessage?.message||((t?.lastMessage?.attachment?.kind==="gif")?"GIF":(t?.lastMessage?.attachment?"Sticker":""));
    const unread=Number(t?.unreadCount||0);
    return '<div class="friend-item '+(active&&active.id===f.id?"active":"")+'" data-friend="'+esc(f.id)+'">'+avatar(f)+'<span class="friend-copy"><strong>'+esc(f.displayName||f.username)+'</strong><span>@'+esc(f.username)+'</span><small class="friend-preview">'+esc(preview)+'</small></span>'+(unread?'<b class="friend-unread">'+(unread>99?"99+":unread)+'</b>':"")+'<button type="button" class="friend-row-more" data-friend-menu="'+esc(f.id)+'" aria-label="More options"><i class="fa-solid fa-ellipsis"></i></button></div>';
  }).join("");
  $("friends-empty").hidden=Boolean(visible.length);
  if(!visible.length&&filter)$("friends-empty").innerHTML="No conversations match your search.";
  else if(!visible.length)$("friends-empty").innerHTML="No friends or conversations yet.<br>Use Add Friend to start a conversation.";
}
function renderBlocked(){
  const e=$("friends-list");
  const filter=($("friends-filter")?.value||"").trim().toLowerCase();
  const visible=blocked.filter(u=>((u.displayName||"")+" "+(u.username||"")).toLowerCase().includes(filter));
  e.innerHTML=visible.map(u=>'<div class="blocked-list-item">'+avatar(u)+'<span class="friend-copy"><strong>'+esc(u.displayName||u.username)+'</strong><span>@'+esc(u.username)+'</span></span><button type="button" class="blocked-unblock" data-unblock="'+esc(u.id)+'">Unblock</button></div>').join("");
  $("friends-empty").hidden=Boolean(visible.length);
  if(!visible.length)$("friends-empty").innerHTML=filter?"No blocked users match your search.":"No blocked users.";
}
function renderInbox(){
  const e=$("friends-list");
  const dmItems=unread.slice().reverse().map(x=>'<div class="search-user inbox-dm" data-inbox-user="'+esc(x.sender.username)+'">'+avatar(x.sender)+'<span class="search-user-info"><strong>'+esc(x.sender.displayName)+'</strong><span>'+esc(x.message)+'</span></span><time>'+new Date(x.createdAt).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})+'</time></div>').join("");
  const requestItems=incoming.map(x=>'<div class="search-user">'+avatar(x.from)+'<span class="search-user-info"><strong>'+esc(x.from.displayName)+'</strong><span>@'+esc(x.from.username)+' sent a friend request</span></span><button data-request="accept" data-id="'+x.id+'">Accept</button><button data-request="decline" data-id="'+x.id+'">Ignore</button></div>').join("");
  e.innerHTML=(dmItems+requestItems)||'<div class="friends-empty">Your inbox is clear.</div>';
}
async function bootstrap(){
  try{
    const d=await api("/api/friends/bootstrap");
    me=d.user;
    friends=d.friends||[];
    incoming=d.incoming||[];
    outgoing=d.outgoing||[];
    blocked=d.blocked||[];
    threads=d.threads||[];
    unread=d.unread||[];
    threadByUser=Object.fromEntries(threads.map(t=>[t.friend.id,t]));
    $("inbox-count").textContent=Number(d.unreadCount||0);
    $("inbox-count").hidden=!Number(d.unreadCount||0);
    const tab=document.querySelector(".friends-tab.active")?.dataset.tab;
    if(tab==="inbox")renderInbox();else if(tab==="blocked")renderBlocked();else renderFriends();
    if(active){
      const fresh=friends.find(f=>f.id===active.id);
      if(fresh)active={...active,...fresh};
    }
  }catch(e){toast(e.message);location.href="/account"}
}
function renderFriendStickers(stickers){
  const grid=$("friend-sticker-grid");
  if(!grid)return;
  grid.innerHTML=(stickers||[]).map(s=>'<button type="button" class="sticker-card" data-friend-send-sticker="'+esc(s.url)+'" data-sticker-name="'+esc(s.name||"Sticker")+'"><img src="'+esc(s.url)+'" alt="'+esc(s.name||"Sticker")+'"><span>'+esc((s.emoji?" "+s.emoji:"")+" "+(s.name||"Sticker"))+'</span></button>').join("");
  $("friend-sticker-empty").hidden=Boolean(stickers?.length);
  $("friend-sticker-count").textContent=(stickers?.length||0)+" saved sticker"+(stickers?.length===1?"":"s");
}
function openFriendStickerDrawer(){
  renderFriendStickers(me?.stickers||[]);
  const drawer=$("friend-sticker-drawer");
  drawer?.classList.add("open");
  drawer?.setAttribute("aria-hidden","false");
}
function closeFriendStickerDrawer(){
  const drawer=$("friend-sticker-drawer");
  drawer?.classList.remove("open");
  drawer?.setAttribute("aria-hidden","true");
}
const friendStickerCreateInline=$("friend-sticker-create-inline");
const friendStickerCreateFile=$("friend-sticker-create-file");
let friendStickerCreateData="";
const openFriendStickerCreator=()=>{
  if(!friendStickerCreateInline)return;
  friendStickerCreateInline.hidden=false;
  $("friend-sticker-create-form")?.reset();
  friendStickerCreateData="";
  $("friend-sticker-create-preview").innerHTML='<i class="fa-regular fa-image"></i>';
};
const closeFriendStickerCreator=()=>{
  if(!friendStickerCreateInline)return;
  friendStickerCreateInline.hidden=true;
  friendStickerCreateData="";
};
const readFriendStickerFile=file=>new Promise((resolve,reject)=>{
  if(!file)return reject(new Error("Choose an image first."));
  if(!["image/png","image/jpeg","image/webp","image/gif"].includes(file.type))return reject(new Error("Use PNG, JPG, WEBP, or GIF."));
  if(file.size>8*1024*1024)return reject(new Error("Sticker images must be smaller than 8 MB."));
  const reader=new FileReader();
  reader.onload=()=>resolve(reader.result);
  reader.onerror=()=>reject(new Error("Could not read that image."));
  reader.readAsDataURL(file);
});
friendStickerCreateFile?.addEventListener("change",async e=>{
  try{
    friendStickerCreateData=await readFriendStickerFile(e.target.files?.[0]);
    $("friend-sticker-create-preview").innerHTML='<img src="'+esc(friendStickerCreateData)+'" alt="Sticker preview">';
  }catch(error){friendStickerCreateData="";toast(error.message)}
});
$("friend-sticker-browse")?.addEventListener("click",()=>friendStickerCreateFile?.click());
$("friend-sticker-upload-zone")?.addEventListener("click",e=>{if(!e.target.closest("button"))friendStickerCreateFile?.click()});
$("dm-emoji-button")?.addEventListener("click",e=>openUnifiedPicker("emoji",e.currentTarget,{type:"compose"}));
$("dm-sticker-button")?.addEventListener("click",e=>openUnifiedPicker("stickers",e.currentTarget,{type:"browse"}));
$("friend-close-sticker-drawer")?.addEventListener("click",()=>closeReactionPopups());
document.addEventListener("keydown",e=>{if(e.key==="Escape"){if(friendStickerCreateInline&&!friendStickerCreateInline.hidden)closeFriendStickerCreator();else closeReactionPopups();}});
document.addEventListener("click",e=>{const t=e.target;if(dmComposeMenu&&!dmComposeMenu.hidden&&!dmComposeMenu.contains(t)&&!t.closest("#dm-plus"))closeDmComposeMenu();if($("reaction-picker")&&!$("reaction-picker").hidden&&!$("reaction-picker").contains(t)&&!t.closest("#dm-plus")&&!t.closest("[data-action=\"react\"]"))closeReactionPopups();if($("gif-panel")&&!$("gif-panel").hidden&&!$("gif-panel").contains(t)&&!t.closest("#dm-plus"))$("gif-panel").hidden=true;});
$("friend-open-sticker-create")?.addEventListener("click",async()=>{
  const context=(pickerContext.type==="reaction"||pickerContext.type==="browse")?pickerContext:{type:"browse",messageId:"",anchor:$("dm-sticker-button")};
  await openUnifiedPicker("stickers",context.anchor||$("dm-emoji-button"),context);
  openFriendStickerCreator();
});
$("friend-close-sticker-create")?.addEventListener("click",closeFriendStickerCreator);
$("friend-cancel-sticker-create")?.addEventListener("click",closeFriendStickerCreator);
$("friend-sticker-create-form")?.addEventListener("submit",async e=>{
  e.preventDefault();
  if(!friendStickerCreateData)return toast("Upload a sticker image first.");
  const button=$("friend-save-sticker-create");
  button.disabled=true;
  try{
    const data=await api("/api/stickers/create",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      data:friendStickerCreateData,
      name:$("friend-sticker-create-name").value.trim()||"My Sticker",
      emoji:$("friend-sticker-create-emoji").value.trim(),
      category:$("friend-sticker-create-category").value||"Custom"
    })});
    me.stickers=data.stickers||[];
    renderFriendStickers(me.stickers);
    closeFriendStickerCreator();
    const context = pickerContext.type === "reaction" ? pickerContext : {type:"reaction",messageId:"",anchor:$("dm-emoji-button")};
    await openUnifiedPicker("stickers",context.anchor||$("dm-emoji-button"),context);
    toast("Sticker created and added to your collection.");
  }catch(error){toast(error.message)}
  finally{button.disabled=false}
});


function openModal(id){$(id).hidden=false}
function closeModals(){["friend-modal","forward-modal"].forEach(id=>$(id).hidden=true);$("message-menu").hidden=true}
function openAdd(){openModal("friend-modal");$("friend-search-input").focus()}
$("add-friend-button").onclick=openAdd;$("empty-add-friend").onclick=openAdd;
$("friends-search-button")?.addEventListener("click",()=>{$("friends-filter")?.focus()});
$("friends-filter").oninput=()=>{
  const tab=document.querySelector(".friends-tab.active")?.dataset.tab;
  if(tab==="blocked")renderBlocked();else if(tab==="inbox")renderInbox();else renderFriends();
};
$("friends-filter-clear").onclick=()=>{$("friends-filter").value="";renderFriends();$("friends-filter").focus()};
$("friends-refresh-button").onclick=async()=>{const b=$("friends-refresh-button");b.classList.add("spinning");await bootstrap();setTimeout(()=>b.classList.remove("spinning"),400)};
$("dm-search-button")?.addEventListener("click",()=>{});
$("dm-call-button")?.addEventListener("click",()=>{});
$("dm-video-button")?.addEventListener("click",()=>{});
$("dm-more-button")?.addEventListener("click",()=>{if(active)openUserProfile(active.username,document.querySelector(".dm-top-name"))});
document.querySelectorAll(".friends-tab").forEach(b=>b.onclick=()=>{
  document.querySelectorAll(".friends-tab").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");
  const tab=b.dataset.tab;
  if(tab==="inbox")renderInbox();else if(tab==="blocked")renderBlocked();else renderFriends();
});
$("friend-search-input").oninput=async e=>{const q=e.target.value.trim();if(q.length<2){$("friend-search-results").innerHTML="";return}try{const d=await api("/api/friends/users?q="+encodeURIComponent(q));$("friend-search-results").innerHTML=(d.users||[]).map(u=>{const p=outgoing.some(x=>x.to.id===u.id)||incoming.some(x=>x.from.id===u.id);return'<div class="search-user">'+avatar(u)+'<span class="search-user-info"><strong>'+esc(u.displayName)+'</strong><span>@'+esc(u.username)+'</span></span><button data-add-user="'+esc(u.username)+'" '+(p||friendOf(u.id)?"disabled":"")+'>'+(friendOf(u.id)?"Friends":p?"Pending":"Add")+'</button></div>'}).join("")||'<div class="friends-empty">No users found.</div>'}catch(x){toast(x.message)}};
$("friend-search-results").onclick=async e=>{const b=e.target.closest("[data-add-user]");if(!b||b.disabled)return;try{await api("/api/friends/requests",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:b.dataset.addUser})});toast("Friend request sent.");closeModals();await bootstrap()}catch(x){toast(x.message)}};
$("friends-list").onclick=async e=>{
  const profile=e.target.closest("[data-profile-user]");
  if(profile){
    e.preventDefault();e.stopPropagation();
    openUserProfile(profile.dataset.profileUser,profile);
    return;
  }
  const unblock=e.target.closest("[data-unblock]");
  if(unblock){
    try{await api("/api/friends/blocked/"+encodeURIComponent(unblock.dataset.unblock),{method:"DELETE"});await bootstrap();toast("User unblocked.");}catch(x){toast(x.message)}
    return;
  }
  const inboxUser=e.target.closest("[data-inbox-user]");
  if(inboxUser){
    const user=friends.find(x=>x.username===inboxUser.dataset.inboxUser)||unread.find(x=>x.sender.username===inboxUser.dataset.inboxUser)?.sender;
    if(user)openDm(user);
    return;
  }
  const friendMenu=e.target.closest("[data-friend-menu]");
  if(friendMenu){
    e.preventDefault();e.stopPropagation();openFriendContextMenu(friendMenu.dataset.friend,e);
    return;
  }
  const b=e.target.closest("[data-request]");if(b){try{const old=incoming.find(x=>x.id===b.dataset.id);await api("/api/friends/requests/"+b.dataset.id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:b.dataset.request})});await bootstrap();if(b.dataset.request==="accept"&&old)openDm(old.from)}catch(x){toast(x.message)}return}const f=e.target.closest("[data-friend]");if(f){const u=friends.find(x=>x.id===f.dataset.friend);if(u)openDm(u)}
};
function profileAvatarHtml(u){return u&&u.avatarUrl?'<img src="'+esc(u.avatarUrl)+'" alt="" onerror="this.style.display=\'none\'">':esc(initials(u&&u.displayName||u&&u.username))}
async function openUserProfile(username,anchor=null){
try{
  const d=await api("/api/users/"+encodeURIComponent(username));
  const u=d.user;
  if(!u)return;
  const modal=$("friends-profile-modal");
  $("friends-profile-avatar").innerHTML=profileAvatarHtml(u);
  $("friends-profile-display").textContent=u.displayName||u.username;
  $("friends-profile-username").textContent="@"+u.username;
  $("friends-profile-status").textContent=u.isOnline?"Online":(u.status||"Offline");
  $("friends-profile-status").classList.toggle("is-online",Boolean(u.isOnline));
  $("friends-profile-member").textContent=u.createdAt?"Member since "+new Date(u.createdAt).toLocaleDateString([], {month:"short",year:"numeric"}):"";
  $("friends-profile-bio").textContent=u.bio||"No bio yet.";
  $("friends-profile-owner").hidden=!u.isOwner;
  $("friends-profile-roles").innerHTML=(u.roles||[]).map(r=>"<span>"+esc(r)+"</span>").join("");
  $("friends-profile-stickers").innerHTML=(u.stickers||[]).slice(0,12).map(s=>'<img src="'+esc(s.url)+'" alt="'+esc(s.name||"Sticker")+'" loading="lazy">').join("");
  $("friends-profile-banner").style.backgroundImage=u.bannerUrl?`url("${String(u.bannerUrl).replace(/"/g, '\\\\"')}")`:"none";
  const profileCard=modal.querySelector(".friends-profile-card");
  if(profileCard){const bg=u.backgroundUrl||"";profileCard.style.backgroundImage=bg?`linear-gradient(180deg,rgba(10,12,17,.18),rgba(10,12,17,.94) 62%),url("${String(bg).replace(/"/g, '\\\\"')}")`:"linear-gradient(180deg,#20242d,#17191e)";profileCard.style.backgroundSize=bg?"cover":"auto";profileCard.style.backgroundPosition="center";}
  const actions=$("friends-profile-actions");
  const mutuals=Array.isArray(u.mutualFriends)?u.mutualFriends:[];
  let mutualBox=document.getElementById("friends-profile-mutuals");
  if(!mutualBox){mutualBox=document.createElement("div");mutualBox.id="friends-profile-mutuals";mutualBox.className="friends-profile-mutuals";actions.before(mutualBox)}
  mutualBox.innerHTML=mutuals.length?`<strong>${mutuals.length} Mutual Friend${mutuals.length===1?"":"s"}</strong><div>${mutuals.slice(0,6).map(m=>m.avatarUrl?`<img src="${esc(m.avatarUrl)}" alt="@${esc(m.username)}" title="@${esc(m.username)}">`:`<span title="@${esc(m.username)}">${esc(initials(m.displayName||m.username))}</span>`).join("")}</div>`:"<strong>No Mutual Friends</strong>";
  const message=$("friends-profile-message"), friend=$("friends-profile-friend"), block=$("friends-profile-block"), report=$("friends-profile-report");
  actions.hidden=!!u.isSelf;
  message.onclick=()=>{closeUserProfile();const target=friends.find(x=>x.id===u.id)||{...u,isFriend:Boolean(u.isFriend),isBlocked:Boolean(u.isBlocked)};openDm(target);};
  friend.textContent=u.isFriend?"Added":(u.friendRequestPending?"Pending":"Friend");
  friend.disabled=!!u.isFriend||!!u.friendRequestPending;
  friend.onclick=async()=>{
    try{
      await api("/api/friends/requests",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:u.username})});
      friend.textContent="Pending"; friend.disabled=true; toast("Friend request sent.");
      await bootstrap();
    }catch(e){toast(e.message)}
  };
  block.textContent=u.isBlocked?"Blocked":"Block";
  block.disabled=!!u.isBlocked;
  block.onclick=async()=>{
    if(!confirm("Block @"+u.username+"?"))return;
    try{
      await api("/api/friends/block/"+encodeURIComponent(u.id),{method:"POST"});
      block.textContent="Blocked"; block.disabled=true; toast("User blocked."); closeUserProfile(); await bootstrap();
    }catch(e){toast(e.message)}
  };
  if(report)report.onclick=async()=>{
    try{
      await api("/api/friends/report/"+encodeURIComponent(u.id),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reason:"Reported from Friends profile"})});
      toast("Report submitted.");
    }catch(e){toast(e.message)}
  };
  modal.hidden=false;
}catch(e){toast(e.message)}
}
function closeUserProfile(){$("friends-profile-modal").hidden=true}
async function openDm(f){
  active=f;
  document.querySelector(".friends-app").classList.add("dm-open");
  $("dm-empty").hidden=true;
  $("dm-view").hidden=false;
  $("dm-top-username").textContent=f.username;
  $("dm-profile-name").textContent=f.displayName||f.username;
  $("dm-profile-handle").textContent="@"+f.username;
  $("dm-profile-description").textContent=f.bio||"";
  $("dm-mini-avatar").innerHTML=f.avatarUrl?'<img src="'+esc(f.avatarUrl)+'" alt=""><i class="'+(f.isOnline?"is-online":"")+'"></i>':esc(initials(f.displayName||f.username))+'<i class="'+(f.isOnline?"is-online":"")+'"></i>';
$("dm-large-avatar").innerHTML=f.avatarUrl?'<img src="'+esc(f.avatarUrl)+'" alt="">':esc(initials(f.displayName||f.username));
const mutuals=Array.isArray(f.mutualFriends)?f.mutualFriends:[];
const mutualRow=$(".mutual-row");
if(mutualRow){
  mutualRow.innerHTML='<span class="mutual-friends-label">'+(mutuals.length?mutuals.length+" Mutual Friend"+(mutuals.length===1?"":"s"):"No Mutual Friends")+'</span>'+
    (mutuals.length?'<div class="mutual-icons">'+mutuals.slice(0,6).map(u=>'<button type="button" class="mutual-friend-avatar" data-profile-user="'+esc(u.username)+'" title="@'+esc(u.username)+'">'+(u.avatarUrl?'<img src="'+esc(u.avatarUrl)+'" alt="">':esc(initials(u.displayName||u.username)))+'</button>').join("")+'</div>':"");
}
$("dm-input").placeholder="Message @"+f.username;
renderFriends();
await api("/api/friends/dms/"+encodeURIComponent(f.id)+"/read",{method:"POST"}).catch(()=>{});
await bootstrap();
  f=friends.find(x=>x.id===f.id)||f;
  active=f;
  await loadMessages(true);

/* Keep the mini-profile actions useful even when this view is opened for a non-friend. */
const miniFriendButton=$("profile-friend");
const miniBlockButton=$("profile-block");
const miniIsFriend=Boolean(f.isFriend);
miniFriendButton.textContent=miniIsFriend ? "Friended" : "Friend";
miniFriendButton.disabled=miniIsFriend;
miniFriendButton.onclick=async()=>{
  if(!active || miniFriendButton.disabled)return;
  try{
    await api("/api/friends/requests",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:active.username})});
    miniFriendButton.textContent="Pending";
    miniFriendButton.disabled=true;
    toast("Friend request sent.");
    await bootstrap();
  }catch(e){toast(e.message)}
};
miniBlockButton.textContent=f.isBlocked ? "Blocked" : "Block";
miniBlockButton.disabled=Boolean(f.isBlocked);
}
async function loadMessages(forceBottom=false){if(!active)return;try{const e=$("dm-messages");const wasAtBottom=e.scrollHeight-e.scrollTop-e.clientHeight<40;const oldTop=e.scrollTop;const oldHeight=e.scrollHeight;const d=await api("/api/friends/dms/"+active.id+"/messages?limit=100");messages=d.messages||[];renderMessages();if(forceBottom||wasAtBottom)e.scrollTop=e.scrollHeight;else e.scrollTop=Math.max(0,oldTop+(e.scrollHeight-oldHeight))}catch(e){toast(e.message)}}
function publicFriendUserLocal(u){return {id:u.id,username:u.username,displayName:u.displayName||u.username,avatarUrl:u.avatarUrl||"",status:u.status||"",isOnline:Boolean(u.isOnline)}}
function reactionHtml(m){return(m.reactions||[]).map(r=>{
  const kind=r.kind==="sticker"?"sticker":"emoji";
  const visual=kind==="sticker"
    ? '<img class="dm-reaction-sticker" src="'+esc(r.stickerUrl)+'" alt="'+esc(r.stickerName||"Sticker")+'">'
    : esc(r.emoji||"");
  return '<button class="dm-reaction '+(r.users.some(u=>u.userId===me.id)?"mine":"")+'" data-react="'+m.id+'" data-reaction-kind="'+kind+'" data-emoji="'+esc(r.emoji||"")+'" data-sticker-url="'+esc(r.stickerUrl||"")+'">'+visual+'<b>'+r.users.length+'</b></button>';
}).join("")}
function renderMessages(){
  const e=$("dm-messages");
  let lastDay="";
  const html=[];
  for(const m of messages){
    const day=new Date(m.createdAt).toLocaleDateString([], {weekday:"long",month:"long",day:"numeric",year:"numeric"});
    if(day!==lastDay){html.push('<div class="dm-date-divider">'+esc(day)+'</div>');lastDay=day;}
    const deleted=Boolean(m.deletedAt);
    const own=m.senderId===me.id;
    const attachment=deleted?"":(m.attachment
      ? (m.attachment.kind==="sticker"
        ? '<div class="dm-sticker-attachment" data-sticker-url="'+esc(m.attachment.url)+'" data-sticker-name="'+esc(m.attachment.name||"Sticker")+'"><img class="dm-sticker" src="'+esc(m.attachment.url)+'" alt="Sticker" loading="lazy"><button type="button" class="sticker-save-badge '+((me?.stickers||[]).some(st=>st.url===m.attachment.url)?"is-saved":"")+'" title="Sticker collection" aria-label="Sticker collection"><i class="fa-'+((me?.stickers||[]).some(st=>st.url===m.attachment.url)?"solid":"regular")+' fa-bookmark"></i></button></div>'
        : '<img class="dm-gif" src="'+esc(m.attachment.url)+'" alt="GIF" loading="lazy">')
      : "");
    const pending=m.pending?'<span class="dm-pending">Sending...</span>':"";
    html.push('<article class="dm-message '+(deleted?"is-deleted":"")+'" data-mid="'+m.id+'" data-own-message="'+(own?"true":"false")+'"><button class="dm-avatar dm-profile-trigger" data-profile-user="'+esc(m.sender.username)+'">'+(m.sender.avatarUrl?'<img src="'+esc(m.sender.avatarUrl)+'" alt="" onerror="this.style.display=\'none\'">':esc(initials(m.sender.displayName)))+'</button><div class="dm-message-content"><div class="dm-message-meta"><button class="dm-profile-trigger" data-profile-user="'+esc(m.sender.username)+'"><strong>'+esc(m.sender.displayName)+'</strong></button><time>'+new Date(m.createdAt).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})+'</time>'+pending+'</div>'+(m.forwarded?'<div class="dm-edited">Forwarded</div>':"")+(m.replyTo&&!deleted?'<div class="dm-edited">↪ @'+esc(m.replyTo.sender.username)+': '+esc(m.replyTo.message)+'</div>':"")+(deleted?'<div class="dm-deleted"><i class="fa-solid fa-ban"></i><span>Message deleted</span></div>':((m.message?'<div class="dm-text">'+esc(m.message)+'</div>':"")+attachment+(m.editedAt?'<span class="dm-edited"> (edited)</span>':"")+'<div class="dm-reactions">'+reactionHtml(m)+'</div>'))+'</div><div class="dm-message-actions"><button data-action="copy"><i class="fa-regular fa-copy"></i></button><button data-action="forward"><i class="fa-solid fa-share"></i></button><button data-action="react">☺</button>'+(own&&!deleted&&!m.pending?'<button data-action="delete"><i class="fa-regular fa-trash-can"></i></button><button data-action="edit"><i class="fa-solid fa-pen"></i></button>':"")+'<button data-action="reply"><i class="fa-solid fa-reply"></i></button></div></article>');
  }
  e.innerHTML=html.join("");
}
function saveSticker(url,name){
  if(!me||!url)return Promise.resolve(null);
  return api("/api/stickers/save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url,name:name||"Saved sticker"})})
    .then(d=>{me.stickers=d.stickers||[];renderFriendStickers(me.stickers);return me.stickers.find(s=>s.url===url)||null})
    .catch(()=>null);
}
function removeSticker(url){
  const saved=(me?.stickers||[]).find(s=>s.url===url);
  if(!saved?.id)return Promise.resolve(false);
  return api("/api/stickers/"+encodeURIComponent(saved.id),{method:"DELETE"})
    .then(d=>{me.stickers=d.stickers||[];renderFriendStickers(me.stickers);return true})
    .catch(()=>false);
}
async function toggleStickerSave(attachment){
  if(!attachment?.dataset.stickerUrl)return;
  const url=attachment.dataset.stickerUrl;
  const name=attachment.dataset.stickerName||"Saved sticker";
  const saved=(me?.stickers||[]).find(s=>s.url===url);
  const badge=attachment.querySelector(".sticker-save-badge");
  if(badge){badge.disabled=true;badge.classList.add("is-saving");}
  try{
    if(saved){
      const removed=await removeSticker(url);
      if(removed&&badge){badge.classList.remove("is-saved");badge.innerHTML='<i class="fa-regular fa-bookmark"></i>';}
      if(removed)toast("Sticker removed from your collection.");
    }else{
      const added=await saveSticker(url,name);
      if(added&&badge){badge.classList.add("is-saved");badge.innerHTML='<i class="fa-solid fa-bookmark"></i>';}
      if(added)toast("Sticker saved to your collection.");
    }
  }finally{if(badge){badge.disabled=false;badge.classList.remove("is-saving");}}
}
function positionFriendContextMenu(menu,x,y){
  menu.style.left="0px";menu.style.top="0px";menu.hidden=false;
  const rect=menu.getBoundingClientRect();
  menu.style.left=Math.max(8,Math.min(innerWidth-rect.width-8,x))+"px";
  menu.style.top=Math.max(8,Math.min(innerHeight-rect.height-8,y))+"px";
}
function openFriendContextMenu(id,event){
  const user=friends.find(x=>x.id===id);
  if(!user)return;
  const menu=$("friend-context-menu");
  const isFriend=areFriendLocally(id);
  const incomingRequest=incoming.find(x=>x.from?.id===id);
  const outgoingRequest=outgoing.find(x=>x.to?.id===id);
  const friendLabel=isFriend?"Friends":incomingRequest?"Accept Friend Request":outgoingRequest?"Friend Request Sent":"Add Friend";
  const friendAction=isFriend?"":incomingRequest?"accept":"friend";
  const friendDisabled=isFriend||Boolean(outgoingRequest);
  menu.innerHTML='<button data-fcm="message"><i class="fa-regular fa-message"></i><span>Message</span></button>'+
    '<button data-fcm="'+friendAction+'" '+(friendDisabled?'disabled':'')+'><i class="fa-solid fa-user-plus"></i><span>'+friendLabel+'</span></button>'+
    '<button data-fcm="profile"><i class="fa-regular fa-id-card"></i><span>View Profile</span></button>'+
    '<button data-fcm="copy-name"><i class="fa-regular fa-copy"></i><span>Copy Username</span></button>'+
    '<button data-fcm="copy-id"><i class="fa-regular fa-id-badge"></i><span>Copy User ID</span></button>'+
    '<button data-fcm="block"><i class="fa-solid fa-ban"></i><span>Block User</span></button>';
  menu.dataset.userId=id;
  menu.dataset.requestId=incomingRequest?.id||"";
  positionFriendContextMenu(menu,event.clientX,event.clientY);
}
function areFriendLocally(id){
  return Boolean(friends.find(x=>x.id===id)?.isFriend);
}
function showMenu(m,el){menuMessage=m;const q=$("message-menu");q.innerHTML='<button data-mm="copy">Copy</button><button data-mm="forward">Forward</button><button data-mm="react">React</button>'+(m.senderId===me.id&&!m.deletedAt?'<button data-mm="delete">Delete</button><button data-mm="edit">Edit</button>':"")+'<button data-mm="reply">Reply</button>';const r=el.getBoundingClientRect();q.style.left=Math.min(innerWidth-205,Math.max(6,r.left))+"px";q.style.top=Math.min(innerHeight-250,r.bottom+4)+"px";q.hidden=false}
let pickerContext={type:"compose",messageId:"",anchor:null};
function closeReactionPopups(){
  const picker=$("reaction-picker");if(picker)picker.hidden=true;
  const users=$("reaction-users");if(users)users.hidden=true;
  document.querySelectorAll(".dm-reaction-users").forEach(el=>el.remove());
  $("friend-sticker-drawer")?.setAttribute("aria-hidden","true");
}

let emojiPickerElement=null;
let emojiPickerLoading=null;
function setPickerTab(tab){
  const stickerTab=document.querySelector("#reaction-picker [data-picker-tab=\"stickers\"]");
  const stickersAllowed=pickerContext.type==="reaction"||pickerContext.type==="browse";
  if(stickerTab)stickerTab.hidden=!stickersAllowed;
  if(!stickersAllowed&&tab==="stickers")tab="emoji";
  document.querySelectorAll("#reaction-picker [data-picker-tab]").forEach(b=>b.classList.toggle("active",b.dataset.pickerTab===tab));
  document.querySelectorAll("#reaction-picker [data-picker-pane]").forEach(p=>p.classList.toggle("active",p.dataset.pickerPane===tab));
  const drawer=$("friend-sticker-drawer");
  if(drawer)drawer.setAttribute("aria-hidden",tab==="stickers"?"false":"true");
  if(tab==="stickers")renderFriendStickers(me?.stickers||[]);else renderRecentEmojis();
}
function renderRecentEmojis(){
  const wrap=$("friends-emoji-recent");if(!wrap)return;let recent=[];try{recent=JSON.parse(localStorage.getItem("lunar-recent-emojis")||"[]")}catch{}
  wrap.innerHTML=recent.map(emoji=>'<button type="button" data-recent-emoji="'+esc(emoji)+'" title="Recently used">'+esc(emoji)+'</button>').join("");wrap.hidden=!recent.length;
}
function rememberEmoji(emoji){let recent=[];try{recent=JSON.parse(localStorage.getItem("lunar-recent-emojis")||"[]")}catch{};recent=[emoji,...recent.filter(x=>x!==emoji)].slice(0,24);localStorage.setItem("lunar-recent-emojis",JSON.stringify(recent));renderRecentEmojis();}
async function ensureEmojiPicker(){
  if(emojiPickerElement)return emojiPickerElement;
  if(emojiPickerLoading)return emojiPickerLoading;
  emojiPickerLoading=(async()=>{
    if(!customElements.get("emoji-picker"))await import("https://cdn.jsdelivr.net/npm/emoji-picker-element@^1/index.js");
    await customElements.whenDefined("emoji-picker");
    const host=$("friends-emoji-picker-host");if(!host)return null;
    emojiPickerElement=document.createElement("emoji-picker");emojiPickerElement.className="dark";emojiPickerElement.setAttribute("locale","en");emojiPickerElement.setAttribute("emoji-version","17.0");
    host.replaceChildren(emojiPickerElement);
    emojiPickerElement.addEventListener("emoji-click",async e=>{
      const emoji=e.detail?.unicode;if(!emoji)return;rememberEmoji(emoji);
      if(pickerContext.type==="reaction"){await reactToMessageByPicker(pickerContext.messageId,emoji);return;}
      const input=$("dm-input");const start=input.selectionStart??input.value.length;const end=input.selectionEnd??start;input.setRangeText(emoji,start,end,"end");input.focus();closeReactionPopups();
    });
    return emojiPickerElement;
  })().catch(e=>{emojiPickerLoading=null;toast("Emoji picker could not load. Please try again.");throw e});
  return emojiPickerLoading;
}
function positionUnifiedPicker(anchor){
  const rect=(anchor||$("dm-plus"))?.getBoundingClientRect();const width=Math.min(420,innerWidth-20),height=Math.min(500,innerHeight-100);
  let left=rect?rect.left+rect.width/2-width/2:(innerWidth-width)/2,top=rect?rect.top-height-8:80;if(top<8)top=rect?rect.bottom+8:80;
  const p=$("reaction-picker");p.style.width=width+"px";p.style.left=Math.max(8,Math.min(innerWidth-width-8,left))+"px";p.style.top=Math.max(8,Math.min(innerHeight-height-8,top))+"px";
}
async function openUnifiedPicker(tab="emoji",anchor=null,context={type:"compose"}){
  if(!me){location.href="/account";return;}
  pickerContext=context;await ensureEmojiPicker();
  const slot=$("friends-sticker-slot"),drawer=$("friend-sticker-drawer");if(drawer&&slot&&drawer.parentElement!==slot)slot.appendChild(drawer);
  renderFriendStickers(me.stickers||[]);setPickerTab(tab);$("reaction-picker").hidden=false;positionUnifiedPicker(anchor);
}
async function reactToMessage(id,payload){
  try{
    await api("/api/friends/dms/messages/"+id+"/reactions",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    closeReactionPopups();
    await loadMessages();
  }catch(e){toast(e.message)}
}
async function reactToMessageByPicker(id,emoji){
  await reactToMessage(id,{kind:"emoji",emoji});
}
async function reactToStickerByPicker(id,sticker){
  await reactToMessage(id,{kind:"sticker",stickerUrl:sticker.url,stickerName:sticker.name||"Sticker"});
}
$("friends-emoji-recent")?.addEventListener("click",e=>{const b=e.target.closest("[data-recent-emoji]");if(!b)return;const emoji=b.dataset.recentEmoji;if(pickerContext.type==="reaction")reactToMessageByPicker(pickerContext.messageId,emoji);else{const input=$("dm-input");const start=input.selectionStart??input.value.length;const end=input.selectionEnd??start;input.setRangeText(emoji,start,end,"end");input.focus();closeReactionPopups()}});
function showReactionPicker(m,anchor){openUnifiedPicker("emoji",anchor,{type:"reaction",messageId:m.id})}
$("reaction-picker").onclick=async e=>{
  const tab=e.target.closest("[data-picker-tab]");if(tab){setPickerTab(tab.dataset.pickerTab);return;}
  if(e.target.closest("#emoji-sticker-close")){closeReactionPopups();return;}
  const sticker=e.target.closest("[data-friend-send-sticker]");
  if(sticker&&pickerContext.type==="reaction"){
    await reactToStickerByPicker(pickerContext.messageId,{url:sticker.dataset.friendSendSticker,name:sticker.dataset.stickerName});
  }else if(sticker&&pickerContext.type==="browse"){
    toast("Sticker collection opened. Use a message's reaction button to send a sticker reaction.");
  }
}
function showReactionUsers(m,anchor){
  closeReactionPopups();
  const p=document.createElement("div");p.className="dm-reaction-users";
  const users=(m.reactions||[]).flatMap(r=>(r.users||[]).map(u=>({reaction:r,username:u.username})));
  p.innerHTML="<strong>Reactions</strong>"+(users.length?users.map(x=>{
    const r=x.reaction;
    const visual=r.kind==="sticker"?"<img class=\"dm-reaction-user-sticker\" src=\""+esc(r.stickerUrl)+"\" alt=\"Sticker\">":esc(r.emoji||"");
    return "<div>"+visual+" @"+esc(x.username)+"</div>";
  }).join(""):"<div>No reactions yet.</div>");
  document.body.appendChild(p);positionPopup(p,anchor.getBoundingClientRect(),245,180);
}
$("dm-messages").onclick=async e=>{
  const messageArticle=e.target.closest("[data-mid]");
  if(e.shiftKey&&messageArticle?.dataset.ownMessage==="true"&&!e.target.closest("button,a,input,textarea")){
    try{await api("/api/friends/dms/messages/"+messageArticle.dataset.mid,{method:"DELETE"});toast("Message deleted.");await loadMessages()}catch(x){toast(x.message)}
    return;
  }

  const save=e.target.closest(".sticker-save-badge");
  if(save){e.preventDefault();e.stopPropagation();const attachment=save.closest(".dm-sticker-attachment");if(attachment)await toggleStickerSave(attachment);return}

  const profile=e.target.closest("[data-profile-user]");
  if(profile){e.preventDefault();openUserProfile(profile.dataset.profileUser,profile);return}
  const reaction=e.target.closest("[data-react]");
  if(reaction){
    const m=messages.find(x=>x.id===reaction.dataset.react);
    if(m){
      const kind=reaction.dataset.reactionKind==="sticker"?"sticker":"emoji";
      const payload=kind==="sticker"
        ? {kind:"sticker",stickerUrl:reaction.dataset.stickerUrl,stickerName:"Sticker"}
        : {kind:"emoji",emoji:reaction.dataset.emoji};
      await reactToMessage(m.id,payload);
    }
    return;
  }
  const action=e.target.closest("[data-action]");
  if(!action)return;
  const m=messages.find(x=>x.id===action.closest("[data-mid]")?.dataset.mid);
  if(!m)return;
  if(action.dataset.action==="react"){showReactionPicker(m,action);return}if(action.dataset.action==="delete"&&m.senderId===me.id&&!m.deletedAt){try{await api("/api/friends/dms/messages/"+m.id,{method:"DELETE"});toast("Message deleted.");await loadMessages()}catch(x){toast(x.message)}return}
  showMenu(m,action)
};
$("dm-messages").oncontextmenu=e=>{const reaction=e.target.closest("[data-react]");if(reaction){e.preventDefault();const m=messages.find(x=>x.id===reaction.dataset.react);if(m)showReactionUsers(m,reaction);return}const a=e.target.closest("[data-mid]");if(!a)return;e.preventDefault();const m=messages.find(x=>x.id===a.dataset.mid);if(m)showMenu(m,e.target)};
$("message-menu").onclick=async e=>{const b=e.target.closest("[data-mm]");if(!b||!menuMessage)return;const m=menuMessage;$("message-menu").hidden=true;try{if(b.dataset.mm==="copy"){await navigator.clipboard.writeText(m.message||m.attachment?.url||"");toast("Copied.")}else if(b.dataset.mm==="delete"){await api("/api/friends/dms/messages/"+m.id,{method:"DELETE"});await loadMessages()}else if(b.dataset.mm==="edit"){editing=m.id;$("dm-edit-bar").hidden=false;$("dm-input").value=m.message||"";$("dm-input").focus()}else if(b.dataset.mm==="reply"){reply=m;$("dm-reply-bar").hidden=false;$("dm-reply-label").textContent="@"+m.sender.username+": "+(m.message||"[GIF]").slice(0,70);$("dm-input").focus()}else if(b.dataset.mm==="react"){showReactionPicker(m,b)}else if(b.dataset.mm==="forward"){openForward(m)}}catch(x){toast(x.message)}};
let forwardContext={sourceType:"dm",messageId:"",excludeId:""};
function renderForwardTargets(){
  const wrap=$("forward-friends");
  const q=($("forward-search")?.value||"").trim().toLowerCase();
  const list=friends.filter(f=>{
    if(forwardContext.excludeId && f.id===forwardContext.excludeId) return false;
    const name=((f.displayName||"")+" "+(f.username||"")).toLowerCase();
    return !q || name.includes(q);
  });
  wrap.innerHTML=(forwardContext.sourceType==="dm"
    ? '<button class="forward-global-target" data-forward-global="1"><i class="fa-solid fa-earth-americas"></i><span><strong>Global Chat</strong><small>Send this message to Global Chat</small></span></button>'
    : '')+
    (list.map(f=>'<button data-forward="'+f.id+'">'+avatar(f)+'<span><strong>'+esc(f.displayName)+'</strong><small>@'+esc(f.username)+'</small></span></button>').join("")||'<div class="friends-empty">No matching friends.</div>');
}
async function openForward(m){
  forwardContext={sourceType:"dm",messageId:m.id,excludeId:active?.id||m.senderId||""};
  openModal("forward-modal");
  $("forward-search").value="";
  renderForwardTargets();
  $("forward-search").focus();
}
$("forward-search").oninput=renderForwardTargets;
$("forward-friends").onclick=async e=>{
  const global=e.target.closest("[data-forward-global]");
  const b=e.target.closest("[data-forward]");
  if(!global&&!b)return;
  try{
    const endpoint="/api/friends/dms/messages/"+forwardContext.messageId+"/forward";
    const body=global?{targetType:"global"}:{recipientId:b.dataset.forward,targetType:"friend"};
    await api(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    closeModals();toast(global?"Message forwarded to Global Chat.":"Message forwarded.");
  }catch(x){toast(x.message)}
};
$("dm-form").onsubmit=async e=>{
  e.preventDefault();
  if(!active)return;
  const text=$("dm-input").value.trim();
  if(editing){
    if(!text)return;
    try{
      await api("/api/friends/dms/messages/"+editing,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:text})});
      editing=null;$("dm-edit-bar").hidden=true;$("dm-input").value="";await loadMessages();
    }catch(x){toast(x.message)}
    return;
  }
  if(!text&&!gifDraft)return;
  const attachment=gifDraft?{kind:"gif",url:gifDraft.url,title:gifDraft.title}:null;
  const temp={
    id:"pending-"+Date.now(),
    threadId:"",
    senderId:me.id,
    recipientId:active.id,
    sender:publicFriendUserLocal(me),
    message:text,
    attachment,
    reactions:[],
    createdAt:new Date().toISOString(),
    editedAt:"",
    pending:true
  };
  messages.push(temp);
  renderMessages();
  $("dm-messages").scrollTop=$("dm-messages").scrollHeight;
  const sendText=text;
  $("dm-input").value="";gifDraft=null;$("gif-preview").hidden=true;reply=null;$("dm-reply-bar").hidden=true;
  try{
    await api("/api/friends/dms/"+active.id+"/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:sendText,attachment,replyTo:temp.replyTo?.id||""})});
    await loadMessages(true);
    await bootstrap();
  }catch(x){
    messages=messages.filter(m=>m.id!==temp.id);
    renderMessages();
    toast(x.message);
  }
};

$("friend-context-menu").onclick=async e=>{
  const b=e.target.closest("[data-fcm]");
  if(!b)return;
  const id=$("friend-context-menu").dataset.userId;
  const user=friends.find(x=>x.id===id);
  $("friend-context-menu").hidden=true;
  if(!user)return;
  try{
    if(b.dataset.fcm==="message")openDm(user);
    else if(b.dataset.fcm==="profile")openUserProfile(user.username,b);
    else if(b.dataset.fcm==="copy-name"){await navigator.clipboard.writeText("@"+user.username);toast("Username copied.");}
    else if(b.dataset.fcm==="copy-id"){await navigator.clipboard.writeText(user.id);toast("User ID copied.");}
    else if(b.dataset.fcm==="friend"){
      await api("/api/friends/requests",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:user.username})});
      toast("Friend request sent.");await bootstrap();
    }else if(b.dataset.fcm==="accept"){
      const requestId=$("friend-context-menu").dataset.requestId;
      await api("/api/friends/requests/"+encodeURIComponent(requestId),{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"accept"})});
      toast("Friend request accepted.");await bootstrap();
    }else if(b.dataset.fcm==="block"){
      if(confirm("Block @"+user.username+"?")){await api("/api/friends/block/"+user.id,{method:"POST"});toast("User blocked.");await bootstrap();}
    }
  }catch(x){toast(x.message)}
};
$("friends-profile-close").onclick=closeUserProfile;
$("dm-mini-avatar").onclick=()=>{if(active)openUserProfile(active.username,$("dm-mini-avatar"))};
$("friends-profile-modal").addEventListener("click",e=>{if(e.target.id==="friends-profile-modal")closeUserProfile()});
document.querySelector(".dm-top-name").onclick=()=>{if(active)openUserProfile(active.username)};

$("dm-back").onclick=()=>{active=null;document.querySelector(".friends-app").classList.remove("dm-open");$("dm-view").hidden=true;$("dm-empty").hidden=false};
$("dm-cancel-reply").onclick=()=>{reply=null;$("dm-reply-bar").hidden=true};$("dm-cancel-edit").onclick=()=>{editing=null;$("dm-edit-bar").hidden=true;$("dm-input").value=""};
$("profile-block").onclick=async()=>{if(!active)return;if(!confirm("Block @"+active.username+"?"))return;try{await api("/api/friends/block/"+active.id,{method:"POST"});toast("User blocked.");await bootstrap();$("dm-back").click()}catch(e){toast(e.message)}};
$("profile-report").onclick=async()=>{if(!active)return;try{await api("/api/friends/report/"+active.id,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reason:"Reported as spam"})});toast("Report submitted.")}catch(e){toast(e.message)}};
$("profile-friend").onclick=async()=>{if(!active)return;try{await api("/api/friends/requests",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:active.username})});toast("Friend request sent.")}catch(e){toast(e.message)}};
async function setupGifs(){try{const d=await api("/api/friends/gifs/config");gifKey=d.apiKey;loadGifs()}catch(e){$("gif-status").textContent=e.message}}
function gifObj(g){return{id:g.id,title:g.title||"GIF",url:g.images?.original?.url||g.images?.fixed_width?.url,preview:g.images?.fixed_width?.url||g.images?.downsized?.url||g.images?.original?.url}}
async function loadGifs(){if(gifTab==="favorites"){const d=await api("/api/friends/bootstrap");renderGifs(d.gifFavorites||[]);return}if(!gifKey)return;const q=$("gif-search-input").value.trim();const url=q?"https://api.giphy.com/v1/gifs/search?api_key="+encodeURIComponent(gifKey)+"&q="+encodeURIComponent(q)+"&limit=30&rating=g&bundle=messaging_non_clips":"https://api.giphy.com/v1/gifs/trending?api_key="+encodeURIComponent(gifKey)+"&limit=30&rating=g&bundle=messaging_non_clips";try{const r=await fetch(url);const d=await r.json();if(!r.ok)throw Error(d.message||"GIF search failed.");renderGifs((d.data||[]).map(gifObj))}catch(e){$("gif-status").textContent=e.message}}
function renderGifs(list){const favorites=gifTab==="favorites";$("gif-grid").innerHTML=(list||[]).map(g=>'<button class="gif-card" data-gif-id="'+esc(g.id)+'"><img src="'+esc(g.preview||g.url)+'" alt=""><span class="gif-fav '+(favorites?"is-saved":"")+'" title="'+(favorites?"Saved GIF":"Save GIF")+'"><i class="fa-'+(favorites?"solid":"regular")+' fa-bookmark"></i></span></button>').join("");$("gif-grid")._gifs=list||[];$("gif-status").textContent=list?.length?"":"No GIFs found."}
$("dm-gif").remove();
const dmPlus=$("dm-plus"),dmComposeMenu=$("dm-compose-menu");
function closeDmComposeMenu(){if(!dmComposeMenu)return;dmComposeMenu.hidden=true;dmPlus?.setAttribute("aria-expanded","false");}
function positionDmToolPanel(panel,anchor){if(!panel||!anchor)return;const rect=anchor.getBoundingClientRect(),width=Math.min(420,innerWidth-20),height=Math.min(500,innerHeight-100);let left=rect.left+rect.width/2-width/2,top=rect.top-height-10;if(top<8)top=rect.bottom+8;panel.style.width=width+"px";panel.style.left=Math.max(8,Math.min(innerWidth-width-8,left))+"px";panel.style.top=Math.max(8,Math.min(innerHeight-height-8,top))+"px";}
function openDmGifs(){closeReactionPopups();closeDmComposeMenu();$("gif-panel").hidden=false;positionDmToolPanel($("gif-panel"),dmPlus);loadGifs();$("gif-search-input").focus();}
function openDmEmoji(){closeDmComposeMenu();openUnifiedPicker("emoji",dmPlus,{type:"compose"});}
function openDmStickers(){closeDmComposeMenu();openUnifiedPicker("stickers",dmPlus,{type:"browse"});}
dmPlus?.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();const open=dmComposeMenu&&!dmComposeMenu.hidden;closeReactionPopups();$("gif-panel").hidden=true;if(open)closeDmComposeMenu();else{dmComposeMenu.hidden=false;dmPlus.setAttribute("aria-expanded","true");}});
dmComposeMenu?.addEventListener("click",e=>{const item=e.target.closest("[data-compose-tool]");if(!item)return;e.preventDefault();e.stopPropagation();const tool=item.dataset.composeTool;if(tool==="gif")openDmGifs();else if(tool==="emoji")openDmEmoji();else if(tool==="sticker")openDmStickers();});
$("dm-emoji-button")?.remove();$("dm-sticker-button")?.remove();
$("gif-close").onclick=()=>{$("gif-panel").hidden=true;};
document.querySelectorAll(".gif-tab").forEach(t=>t.onclick=()=>{document.querySelectorAll(".gif-tab").forEach(x=>x.classList.remove("active"));t.classList.add("active");gifTab=t.dataset.gifTab;loadGifs()});
$("gif-search-input").oninput=()=>{clearTimeout(timer);timer=setTimeout(loadGifs,300)};
$("gif-search-clear").onclick=()=>{$("gif-search-input").value="";loadGifs();$("gif-search-input").focus()};
$("gif-grid").onclick=async e=>{const card=e.target.closest(".gif-card");if(!card)return;const g=$("gif-grid")._gifs.find(x=>x.id===card.dataset.gifId);if(!g)return;const favorite=e.target.closest(".gif-fav");if(favorite){try{await api("/api/friends/gifs/favorites",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({gif:g})});favorite.classList.add("is-saved");favorite.innerHTML='<i class="fa-solid fa-bookmark"></i>';favorite.title="Saved GIF";toast("GIF saved to favourites.")}catch(x){toast(x.message)}return}gifDraft=g;$("gif-preview-image").src=g.preview||g.url;$("gif-preview").hidden=false;$("gif-panel").hidden=true;if(!$("dm-input").value.trim())$("dm-form").requestSubmit()};
$("gif-preview-remove").onclick=()=>{gifDraft=null;$("gif-preview").hidden=true};
document.querySelectorAll("[data-close-modal]").forEach(b=>b.onclick=closeModals);document.querySelector("[data-close-forward]").onclick=closeModals;
document.addEventListener("click",e=>{
  if(!e.target.closest("#message-menu")&&!e.target.closest("[data-action]")&&!e.target.closest("#reaction-picker")&&!e.target.closest(".dm-reaction-users")){$("message-menu").hidden=true;closeReactionPopups()}
  if(!$("gif-panel").hidden&&!e.target.closest("#gif-panel")&&!e.target.closest("#dm-plus"))$("gif-panel").hidden=true;
  if(!$("friend-context-menu").hidden&&!e.target.closest("#friend-context-menu")&&!e.target.closest("[data-friend-menu]"))$("friend-context-menu").hidden=true;
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){$("gif-panel").hidden=true;closeReactionPopups()}});
setupGifs();bootstrap();setInterval(()=>{bootstrap();if(active)loadMessages()},5000);

$("friends-profile-close").onclick=closeUserProfile;
$("friends-profile-modal").addEventListener("click",e=>{if(e.target===$("friends-profile-modal"))closeUserProfile();});
const requestedProfile=new URLSearchParams(location.search).get("user");
if(requestedProfile){
  setTimeout(()=>openUserProfile(requestedProfile),300);
}
})();