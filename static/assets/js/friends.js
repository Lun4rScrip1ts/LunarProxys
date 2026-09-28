(() => {
const $=id=>document.getElementById(id);
const api=async(url,opt={})=>{const r=await fetch(url,{credentials:"same-origin",...opt});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"Something went wrong.");return d};
const esc=v=>{const d=document.createElement("div");d.textContent=v??"";return d.innerHTML};
const initials=n=>(n||"?").slice(0,2).toUpperCase();
let me=null,friends=[],incoming=[],outgoing=[],active=null,messages=[],reply=null,editing=null,gifDraft=null,gifKey="",gifTab="trending",menuMessage=null,timer=null;
const toast=m=>{clearTimeout(timer);$("friends-toast").textContent=m;$("friends-toast").classList.add("show");timer=setTimeout(()=>$("friends-toast").classList.remove("show"),2200)};
const avatar=u=>u&&u.avatarUrl?'<div class="friend-avatar"><img src="'+esc(u.avatarUrl)+'" alt=""><i></i></div>':'<div class="friend-avatar">'+esc(initials(u&&u.displayName||u&&u.username))+'<i></i></div>';
const friendOf=id=>friends.some(x=>x.id===id);
function renderFriends(){
const e=$("friends-list");
const filter=($("friends-filter")?.value||"").trim().toLowerCase();
const onlineOnly=document.querySelector(".friends-tab.active")?.dataset.tab==="online";
const visible=friends.filter(f=>{
  const name=((f.displayName||"")+" "+(f.username||"")).toLowerCase();
  const isOnline=!f.status||f.status==="online";
  return (!filter||name.includes(filter))&&(!onlineOnly||isOnline);
});
e.innerHTML=visible.map(f=>'<button class="friend-item '+(active&&active.id===f.id?"active":"")+'" data-friend="'+f.id+'">'+avatar(f)+'<span class="friend-copy"><strong>'+esc(f.displayName)+'</strong><span>@'+esc(f.username)+'</span></span></button>').join("");$("friends-empty").hidden=!!visible.length;
if(!visible.length && filter) $("friends-empty").innerHTML="No friends match your search.";
else if(!visible.length) $("friends-empty").innerHTML="No friends yet.<br>Send someone a friend request to start chatting.";
}
function renderInbox(){const e=$("friends-list");$("inbox-count").textContent=incoming.length;$("inbox-count").hidden=!incoming.length;e.innerHTML=incoming.map(x=>'<div class="search-user">'+avatar(x.from)+'<span class="search-user-info"><strong>'+esc(x.from.displayName)+'</strong><span>@'+esc(x.from.username)+'</span></span><button data-request="accept" data-id="'+x.id+'">Accept</button><button data-request="decline" data-id="'+x.id+'" style="background:#303238">Decline</button></div>').join("")||'<div class="friends-empty">Your inbox is clear.</div>'}
async function bootstrap(){try{const d=await api("/api/friends/bootstrap");me=d.user;friends=d.friends||[];incoming=d.incoming||[];outgoing=d.outgoing||[];document.querySelector(".friends-tab.active")?.dataset.tab==="inbox"?renderInbox():renderFriends();$("inbox-count").textContent=incoming.length;$("inbox-count").hidden=!incoming.length}catch(e){toast(e.message);location.href="/account"}}
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
$("friend-close-sticker-drawer")?.addEventListener("click",()=>closeReactionPopups());
document.addEventListener("keydown",e=>{if(e.key==="Escape"){if(friendStickerCreateInline&&!friendStickerCreateInline.hidden)closeFriendStickerCreator();else closeReactionPopups();}});
document.addEventListener("click",e=>{if($("reaction-picker")&&!$("reaction-picker").hidden&&!$("reaction-picker").contains(e.target)&&!e.target.closest("#dm-emoji-button")&&!e.target.closest("[data-action=\"react\"]"))closeReactionPopups();});
$("friend-open-sticker-create")?.addEventListener("click",async()=>{
  const context=pickerContext.type==="reaction"?pickerContext:{type:"reaction",messageId:"",anchor:$("dm-emoji-button")};
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
$("friends-search-button").onclick=()=>{const w=$("friends-filter-wrap");w.hidden=!w.hidden;if(!w.hidden)$("friends-filter").focus()};
$("friends-filter").oninput=()=>renderFriends();
$("friends-filter-clear").onclick=()=>{$("friends-filter").value="";renderFriends();$("friends-filter").focus()};
$("friends-refresh-button").onclick=async()=>{const b=$("friends-refresh-button");b.classList.add("spinning");await bootstrap();setTimeout(()=>b.classList.remove("spinning"),400)};
$("dm-search-button").onclick=()=>{if(!active)return;const q=prompt("Search this conversation");if(!q)return;const found=messages.find(m=>(m.message||"").toLowerCase().includes(q.toLowerCase()));toast(found?"Found a matching message.":"No matching messages.")};
$("dm-call-button").onclick=()=>toast("Voice calls are not enabled yet.");
$("dm-video-button").onclick=()=>toast("Video calls are not enabled yet.");
$("dm-more-button").onclick=()=>{if(active)openUserProfile(active.username,document.querySelector(".dm-top-name"))};
document.querySelectorAll(".friends-tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".friends-tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");b.dataset.tab==="inbox"?renderInbox():renderFriends()});
$("friend-search-input").oninput=async e=>{const q=e.target.value.trim();if(q.length<2){$("friend-search-results").innerHTML="";return}try{const d=await api("/api/friends/users?q="+encodeURIComponent(q));$("friend-search-results").innerHTML=(d.users||[]).map(u=>{const p=outgoing.some(x=>x.to.id===u.id)||incoming.some(x=>x.from.id===u.id);return'<div class="search-user">'+avatar(u)+'<span class="search-user-info"><strong>'+esc(u.displayName)+'</strong><span>@'+esc(u.username)+'</span></span><button data-add-user="'+esc(u.username)+'" '+(p||friendOf(u.id)?"disabled":"")+'>'+(friendOf(u.id)?"Friends":p?"Pending":"Add")+'</button></div>'}).join("")||'<div class="friends-empty">No users found.</div>'}catch(x){toast(x.message)}};
$("friend-search-results").onclick=async e=>{const b=e.target.closest("[data-add-user]");if(!b||b.disabled)return;try{await api("/api/friends/requests",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:b.dataset.addUser})});toast("Friend request sent.");closeModals();await bootstrap()}catch(x){toast(x.message)}};
$("friends-list").onclick=async e=>{const b=e.target.closest("[data-request]");if(b){try{const old=incoming.find(x=>x.id===b.dataset.id);await api("/api/friends/requests/"+b.dataset.id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:b.dataset.request})});await bootstrap();if(b.dataset.request==="accept"&&old)openDm(old.from)}catch(x){toast(x.message)}return}const f=e.target.closest("[data-friend]");if(f){const u=friends.find(x=>x.id===f.dataset.friend);if(u)openDm(u)}};
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
  $("friends-profile-status").textContent=u.status||"Online";
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
  const message=$("friends-profile-message"), friend=$("friends-profile-friend"), block=$("friends-profile-block");
  actions.hidden=!!u.isSelf;
  message.onclick=()=>{ location.href="/friends?user="+encodeURIComponent(u.username); };
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
  modal.hidden=false;
  const card=modal.querySelector(".friends-profile-card");
  card.style.left="50%";
  card.style.top="50%";
  card.style.right="auto";
  card.style.bottom="auto";
  card.style.transform="translate(-50%,-50%)";
}catch(e){toast(e.message)}
}
function closeUserProfile(){$("friends-profile-modal").hidden=true}
async function openDm(f){
active=f;
document.querySelector(".friends-app").classList.add("dm-open");
$("dm-empty").hidden=true;
$("dm-view").hidden=false;
$("dm-top-username").textContent=f.username;
$("dm-profile-name").textContent=f.displayName;
$("dm-profile-handle").textContent="@"+f.username;
$("dm-profile-description").textContent="This is the very beginning of your legendary conversation with "+f.username+".";
$("dm-mini-avatar").innerHTML=f.avatarUrl?'<img src="'+esc(f.avatarUrl)+'" alt=""><i></i>':esc(initials(f.displayName))+'<i></i>';
$("dm-large-avatar").innerHTML=f.avatarUrl?'<img src="'+esc(f.avatarUrl)+'" alt="">':esc(initials(f.displayName));
const mutuals=Array.isArray(f.mutualFriends)?f.mutualFriends:[];
const mutualRow=$(".mutual-row");
if(mutualRow){
  mutualRow.innerHTML='<span class="mutual-friends-label">'+(mutuals.length?mutuals.length+" Mutual Friend"+(mutuals.length===1?"":"s"):"No Mutual Friends")+'</span>'+
    (mutuals.length?'<div class="mutual-icons">'+mutuals.slice(0,6).map(u=>'<button type="button" class="mutual-friend-avatar" data-profile-user="'+esc(u.username)+'" title="@'+esc(u.username)+'">'+(u.avatarUrl?'<img src="'+esc(u.avatarUrl)+'" alt="">':esc(initials(u.displayName||u.username)))+'</button>').join("")+'</div>':"");
}
$("dm-input").placeholder="Message @"+f.username;
renderFriends();
await loadMessages(false);
$("profile-friend").disabled=true;
$("profile-friend").textContent="Friends";
}
async function loadMessages(forceBottom=false){if(!active)return;try{const e=$("dm-messages");const wasAtBottom=e.scrollHeight-e.scrollTop-e.clientHeight<40;const oldTop=e.scrollTop;const oldHeight=e.scrollHeight;const d=await api("/api/friends/dms/"+active.id+"/messages?limit=100");messages=d.messages||[];renderMessages();if(forceBottom||wasAtBottom)e.scrollTop=e.scrollHeight;else e.scrollTop=Math.max(0,oldTop+(e.scrollHeight-oldHeight))}catch(e){toast(e.message)}}
function reactionHtml(m){return(m.reactions||[]).map(r=>{
  const kind=r.kind==="sticker"?"sticker":"emoji";
  const visual=kind==="sticker"
    ? '<img class="dm-reaction-sticker" src="'+esc(r.stickerUrl)+'" alt="'+esc(r.stickerName||"Sticker")+'">'
    : esc(r.emoji||"");
  return '<button class="dm-reaction '+(r.users.some(u=>u.userId===me.id)?"mine":"")+'" data-react="'+m.id+'" data-reaction-kind="'+kind+'" data-emoji="'+esc(r.emoji||"")+'" data-sticker-url="'+esc(r.stickerUrl||"")+'">'+visual+'<b>'+r.users.length+'</b></button>';
}).join("")}
function renderMessages(){const e=$("dm-messages");e.innerHTML=messages.map(m=>'<article class="dm-message" data-mid="'+m.id+'"><button class="dm-avatar dm-profile-trigger" data-profile-user="'+esc(m.sender.username)+'">'+(m.sender.avatarUrl?'<img src="'+esc(m.sender.avatarUrl)+'" alt="" onerror="this.style.display=\'none\'">':esc(initials(m.sender.displayName)))+'</button><div class="dm-message-content"><div class="dm-message-meta"><button class="dm-profile-trigger" data-profile-user="'+esc(m.sender.username)+'"><strong>'+esc(m.sender.displayName)+'</strong></button><time>'+new Date(m.createdAt).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})+'</time></div>'+(m.forwarded?'<div class="dm-edited">Forwarded</div>':"")+(m.replyTo?'<div class="dm-edited">↪ @'+esc(m.replyTo.sender.username)+': '+esc(m.replyTo.message)+'</div>':"")+(m.message?'<div class="dm-text">'+esc(m.message)+'</div>':"")+(m.attachment?'<img class="'+(m.attachment.kind==="sticker"?"dm-sticker":"dm-gif")+'" src="'+esc(m.attachment.url)+'" alt="'+(m.attachment.kind==="sticker"?"Sticker":"GIF")+'" loading="lazy">':"")+(m.editedAt?'<span class="dm-edited"> (edited)</span>':"")+'<div class="dm-reactions">'+reactionHtml(m)+'</div></div><div class="dm-message-actions"><button data-action="copy"><i class="fa-regular fa-copy"></i></button><button data-action="forward"><i class="fa-solid fa-share"></i></button><button data-action="react">☺</button><button data-action="delete"><i class="fa-regular fa-trash-can"></i></button>'+(m.senderId===me.id?'<button data-action="edit"><i class="fa-solid fa-pen"></i></button>':"")+'<button data-action="reply"><i class="fa-solid fa-reply"></i></button></div></article>').join("");}
function showMenu(m,el){menuMessage=m;const q=$("message-menu");q.innerHTML='<button data-mm="copy">Copy</button><button data-mm="forward">Forward</button><button data-mm="react">React</button><button data-mm="delete">Delete for me</button>'+(m.senderId===me.id?'<button data-mm="edit">Edit</button>':"")+'<button data-mm="reply">Reply</button>';const r=el.getBoundingClientRect();q.style.left=Math.min(innerWidth-205,Math.max(6,r.left))+"px";q.style.top=Math.min(innerHeight-250,r.bottom+4)+"px";q.hidden=false}
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
  const stickersAllowed=pickerContext.type==="reaction";
  if(stickerTab)stickerTab.hidden=!stickersAllowed;
  if(!stickersAllowed&&tab==="stickers")tab="emoji";
  document.querySelectorAll("#reaction-picker [data-picker-tab]").forEach(b=>b.classList.toggle("active",b.dataset.pickerTab===tab));
  document.querySelectorAll("#reaction-picker [data-picker-pane]").forEach(p=>p.classList.toggle("active",p.dataset.pickerPane===tab));
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
  const rect=(anchor||$("dm-emoji-button"))?.getBoundingClientRect();const width=Math.min(420,innerWidth-20),height=Math.min(500,innerHeight-100);
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
  if(action.dataset.action==="react"){showReactionPicker(m,action);return}
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
$("dm-form").onsubmit=async e=>{e.preventDefault();if(!active)return;const text=$("dm-input").value.trim();if(editing){if(!text)return;try{await api("/api/friends/dms/messages/"+editing,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:text})});editing=null;$("dm-edit-bar").hidden=true;$("dm-input").value="";await loadMessages()}catch(x){toast(x.message)}return}if(!text&&!gifDraft)return;try{await api("/api/friends/dms/"+active.id+"/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:text,attachment:gifDraft?{kind:"gif",url:gifDraft.url,title:gifDraft.title}:null,replyTo:reply?reply.id:""})});$("dm-input").value="";gifDraft=null;$("gif-preview").hidden=true;reply=null;$("dm-reply-bar").hidden=true;await loadMessages()}catch(x){toast(x.message)}};

$("friends-profile-close").onclick=closeUserProfile;
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
$("dm-gif").onclick=()=>{$("gif-panel").hidden=!$("gif-panel").hidden;if(!$("gif-panel").hidden)loadGifs()};$("gif-close").onclick=()=>$("gif-panel").hidden=true;
document.querySelectorAll(".gif-tab").forEach(t=>t.onclick=()=>{document.querySelectorAll(".gif-tab").forEach(x=>x.classList.remove("active"));t.classList.add("active");gifTab=t.dataset.gifTab;loadGifs()});
$("gif-search-input").oninput=()=>{clearTimeout(timer);timer=setTimeout(loadGifs,300)};
$("gif-search-clear").onclick=()=>{$("gif-search-input").value="";loadGifs();$("gif-search-input").focus()};
$("gif-grid").onclick=async e=>{const card=e.target.closest(".gif-card");if(!card)return;const g=$("gif-grid")._gifs.find(x=>x.id===card.dataset.gifId);if(!g)return;const favorite=e.target.closest(".gif-fav");if(favorite){try{await api("/api/friends/gifs/favorites",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({gif:g})});favorite.classList.add("is-saved");favorite.innerHTML='<i class="fa-solid fa-bookmark"></i>';favorite.title="Saved GIF";toast("GIF saved to favourites.")}catch(x){toast(x.message)}return}gifDraft=g;$("gif-preview-image").src=g.preview||g.url;$("gif-preview").hidden=false;$("gif-panel").hidden=true;if(!$("dm-input").value.trim())$("dm-form").requestSubmit()};
$("gif-preview-remove").onclick=()=>{gifDraft=null;$("gif-preview").hidden=true};
document.querySelectorAll("[data-close-modal]").forEach(b=>b.onclick=closeModals);document.querySelector("[data-close-forward]").onclick=closeModals;
document.addEventListener("click",e=>{if(!e.target.closest("#message-menu")&&!e.target.closest("[data-action]")&&!e.target.closest("#reaction-picker")&&!e.target.closest(".dm-reaction-users")){$("message-menu").hidden=true;closeReactionPopups()}if(!$("gif-panel").hidden&&!e.target.closest("#gif-panel")&&!e.target.closest("#dm-gif"))$("gif-panel").hidden=true});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){$("gif-panel").hidden=true;closeReactionPopups()}});
setupGifs();bootstrap();setInterval(()=>{bootstrap();if(active)loadMessages()},5000);

$("friends-profile-close").onclick=closeUserProfile;
$("friends-profile-modal").addEventListener("click",e=>{if(e.target===$("friends-profile-modal"))closeUserProfile();});
const requestedProfile=new URLSearchParams(location.search).get("user");
if(requestedProfile){
  setTimeout(()=>openUserProfile(requestedProfile),300);
}
})();