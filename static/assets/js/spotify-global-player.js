(() => {
  if (window.__lunarGlobalSpotifyPlayerBooted) return;
  window.__lunarGlobalSpotifyPlayerBooted = true;

  const STATE_KEY = "lunarSpotifyLast";
  const POSITION_KEY = "lunarSpotifyGlobalPlayerPosition";
  const QUEUE_KEY = "lunarSpotifyQueue";
  const CLOSED_KEY = "lunarSpotifyGlobalPlayerClosed";
  const API_SRC = "https://open.spotify.com/embed/iframe-api/v1";

  const safeParse = value => { try { return JSON.parse(value); } catch { return null; } };
  const escapeHtml = value => String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");
  const validType = type => ["track","album","playlist","artist","show","episode"].includes(type);
  const uriFor = (type, id) => `spotify:${type}:${id}`;

  function readState() { return safeParse(localStorage.getItem(STATE_KEY) || "null"); }
  function writeState(state) { try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch {} }
  function readQueue() { const q = safeParse(localStorage.getItem(QUEUE_KEY) || "null"); return q && Array.isArray(q.tracks) ? q : {tracks:[],index:0}; }
  function writeQueue(queue) { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); } catch {} }
  function readPosition() { const p = safeParse(localStorage.getItem(POSITION_KEY) || "null"); return p && Number.isFinite(p.position) ? p : null; }
  function writePosition(position, duration, trackId) { try { localStorage.setItem(POSITION_KEY, JSON.stringify({ position, duration, trackId, updatedAt: Date.now() })); } catch {} }

  function readPlayerPosition() {
    const saved = safeParse(localStorage.getItem("lunarSpotifyPlayerPosition") || "null");
    return saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) ? saved : null;
  }
  function savePlayerPosition(element) {
    const r = element.getBoundingClientRect();
    try { localStorage.setItem("lunarSpotifyPlayerPosition", JSON.stringify({x:r.left,y:r.top})); } catch {}
  }
  function clampPosition(element, x, y) {
    const w = element.offsetWidth || 420, h = element.offsetHeight || 210, m = 8;
    return {x:Math.max(m,Math.min(x,Math.max(m,innerWidth-w-m))),y:Math.max(m,Math.min(y,Math.max(m,innerHeight-h-m)))};
  }
  function applyPosition(element, p) {
    const r = clampPosition(element,p.x,p.y); element.style.left=`${r.x}px`; element.style.top=`${r.y}px`; element.style.right="auto"; element.style.bottom="auto";
  }

  let apiPromise = null;
  function loadApi() {
    if (window.SpotifyIframeApi) return Promise.resolve(window.SpotifyIframeApi);
    if (apiPromise) return apiPromise;
    apiPromise = new Promise(resolve => {
      const previous = window.onSpotifyIframeApiReady;
      window.onSpotifyIframeApiReady = api => { window.SpotifyIframeApi = api; try { previous?.(api); } catch {} resolve(api); };
      const existing = document.querySelector(`script[src="${API_SRC}"]`);
      if (existing) return;
      const script = document.createElement("script"); script.src = API_SRC; script.async = true; document.head.appendChild(script);
    });
    return apiPromise;
  }

  let controller = null;
  let controllerReady = null;
  let activeTrackId = null;
  let endHandled = false;

  function create() {
    const old = document.getElementById("lunar-global-spotify-player");
    if (old) return old;
    const player = document.createElement("section");
    player.id="lunar-global-spotify-player";
    player.setAttribute("aria-label","Lunar Spotify player");
    player.innerHTML=`<div class="lunar-global-spotify-head" id="lunar-global-spotify-drag"><div class="lunar-global-spotify-title"><i class="fa-brands fa-spotify"></i><span id="lunar-global-spotify-label">Spotify</span></div><div class="lunar-global-spotify-actions"><button type="button" id="lunar-global-spotify-popout" title="Open player window"><i class="fa-solid fa-up-right-from-square"></i></button><button type="button" id="lunar-global-spotify-hide" title="Close player"><i class="fa-solid fa-xmark"></i></button></div></div><div class="lunar-global-spotify-body"><div id="lunar-global-spotify-frame"></div></div><div class="lunar-global-spotify-foot"><span><i class="fa-solid fa-grip-lines"></i> Drag anywhere</span><small>Spotify controls include volume.</small></div>`;
    document.body.appendChild(player);
    const saved = readPlayerPosition(); if (saved) applyPosition(player,saved);
    const drag = player.querySelector("#lunar-global-spotify-drag");
    const hide = player.querySelector("#lunar-global-spotify-hide");
    const popout = player.querySelector("#lunar-global-spotify-popout");
    hide.onclick = e => { e.stopPropagation(); player.hidden=true; try { localStorage.setItem(CLOSED_KEY,"1"); } catch {} };
    popout.onclick = e => { e.stopPropagation(); window.open("/spotify-player.html","lunarSpotifyPlayer","popup,width=430,height=650,resizable=yes"); };
    let dragState=null, raf=0, pending=null;
    const end=()=>{if(!dragState)return;dragState=null;drag.classList.remove("is-dragging");savePlayerPosition(player);};
    drag.addEventListener("pointerdown",e=>{if(e.target.closest("button"))return;const r=player.getBoundingClientRect();dragState={dx:e.clientX-r.left,dy:e.clientY-r.top};drag.classList.add("is-dragging");drag.setPointerCapture?.(e.pointerId);e.preventDefault();});
    drag.addEventListener("pointermove",e=>{if(!dragState)return;pending=e;if(raf)return;raf=requestAnimationFrame(()=>{raf=0;if(!dragState||!pending)return;applyPosition(player,{x:pending.clientX-dragState.dx,y:pending.clientY-dragState.dy});});});
    drag.addEventListener("pointerup",end); drag.addEventListener("pointercancel",end);
    addEventListener("resize",()=>{const r=player.getBoundingClientRect();applyPosition(player,{x:r.left,y:r.top});savePlayerPosition(player);},{passive:true});
    return player;
  }

  async function initController(player) {
    if (controller) return controller;
    const host = player.querySelector("#lunar-global-spotify-frame");
    if (!host) return null;
    const api = await loadApi();
    const state = readState();
    const initial = state?.type && state?.id ? uriFor(state.type,state.id) : "spotify:track:0VjIjW4GlUZAMYd2vXMi3b";
    controllerReady = new Promise(resolve => {
      api.createController(host,{width:"100%",height:"152",uri:initial}, c => {
        controller=c;
        c.addListener("playback_update", event => {
          const d=event?.data || {}; const uri=d.playingURI || ""; const id=uri.split(":").pop();
          if (id) activeTrackId=id;
          if (Number.isFinite(d.position)) writePosition(d.position,d.duration,id || activeTrackId);
          if (Number.isFinite(d.position) && Number.isFinite(d.duration) && d.duration>0 && d.position >= d.duration-900 && !d.isBuffering) advanceQueue();
        });
        c.addListener("playback_started", event => { const uri=event?.data?.playingURI || ""; const id=uri.split(":").pop(); if(id) activeTrackId=id; endHandled=false; });
        resolve(c);
      });
    });
    return controllerReady;
  }

  async function loadTrack(track, index=0, queueTracks=null, startAt=0, autoplay=true) {
    if (!track?.id) return;
    const player=create(); player.hidden=false;
    try { localStorage.removeItem(CLOSED_KEY); } catch {}
    const queue = Array.isArray(queueTracks) && queueTracks.length ? queueTracks : [{...track}];
    writeQueue({tracks:queue,index});
    const label = `${track.name || "Spotify"}${track.artists ? ` — ${Array.isArray(track.artists) ? track.artists.map(a=>a.name||a).join(", ") : track.artists}` : ""}`;
    document.getElementById("lunar-global-spotify-label").textContent=label;
    writeState({type:"track",id:track.id,label,track});
    const c=await initController(player); if(!c)return;
    activeTrackId=track.id; endHandled=false;
    try { await c.loadEntity(track.uri || uriFor("track",track.id),false,Math.max(0,Number(startAt)||0)); if(autoplay)c.play(); } catch {}
  }

  async function advanceQueue() {
    if (endHandled) return;
    const q=readQueue(); if(!q.tracks.length || q.index >= q.tracks.length-1) return;
    endHandled=true;
    const nextIndex=q.index+1, next=q.tracks[nextIndex];
    try { localStorage.setItem(POSITION_KEY,JSON.stringify({position:0,duration:next.duration_ms||0,trackId:next.id,updatedAt:Date.now()})); } catch {}
    await loadTrack(next,nextIndex,q.tracks,0,true);
  }

  window.lunarSpotifyPlayTrack = (track, tracks=null, index=0) => loadTrack(track,index,tracks,0,true);
  window.lunarSpotifySetQueue = (tracks,index=0) => writeQueue({tracks:Array.isArray(tracks)?tracks:[],index});

  async function restore() {
    if (!document.body) return;
    if (localStorage.getItem(CLOSED_KEY)==="1") return;
    const state=readState(); if(!state?.id || !validType(state.type)) return;
    const player=create(); player.hidden=false;
    const position=readPosition();
    const q=readQueue();
    let track=state.track || {id:state.id,name:state.label||"Spotify",uri:uriFor(state.type,state.id)};
    if (q.tracks[q.index]?.id===state.id) track=q.tracks[q.index];
    const c=await initController(player); if(!c)return;
    const start=(position?.trackId===state.id && position.position>1000 && position.position < (position.duration||Infinity)-1200) ? position.position/1000 : 0;
    try { await c.loadEntity(track.uri || uriFor(state.type,state.id),false,start); if(state.autoplay!==false)c.play(); } catch {}
  }

  function boot() { restore(); }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
