const MOVIE_KEY="lunar-movie-saved";let movies=[],activeMovie=null,activeFilter="all";
const $=s=>document.querySelector(s);
const saved=()=>{try{return JSON.parse(localStorage.getItem(MOVIE_KEY)||"[]")}catch{return[]}};
const saveList=v=>localStorage.setItem(MOVIE_KEY,JSON.stringify([...new Set(v)]));
const esc=v=>{const d=document.createElement("div");d.textContent=String(v??"");return d.innerHTML};
const isSaved=id=>saved().includes(id);
const fmt=t=>{if(!Number.isFinite(t))return"0:00";const m=Math.floor(t/60),s=Math.floor(t%60);return m+":"+(s<10?"0":"")+s};

function setPlayIcon(){
  const v=$("#movie-player"),icon=$("#movie-play i"),big=$("#movie-big-play i");
  const playing=!v.paused;
  icon.className=playing?"fa-solid fa-pause":"fa-solid fa-play";
  big.className=playing?"fa-solid fa-pause":"fa-solid fa-play";
  $("#movie-big-play").classList.toggle("visible",!playing);
  $("#movie-play").setAttribute("aria-label",playing?"Pause":"Play");
}

function syncPlayer(){
  const v=$("#movie-player");
  if(!v)return;
  $("#movie-current-time").textContent=fmt(v.currentTime);
  $("#movie-duration").textContent=fmt(v.duration);
  $("#movie-progress").value=v.duration?((v.currentTime/v.duration)*100):0;
  setPlayIcon();
}

function togglePlayback(){
  const v=$("#movie-player");
  if(v.paused)v.play().catch(()=>{});
  else v.pause();
}

function closeMovie(){
  const modal=$("#movie-modal"),video=$("#movie-player");
  if(video){video.pause();video.removeAttribute("src");video.load()}
  if(modal)modal.hidden=true;
  document.body.classList.remove("movie-player-open");
}

function openMovie(m){
  activeMovie=m;
  const modal=$("#movie-modal"),video=$("#movie-player"),poster=$("#movie-modal-poster");
  poster.innerHTML='<img src="'+esc(m.posterUrl)+'" alt="" loading="eager">';
  video.src=m.videoUrl;
  video.poster=m.posterUrl;
  video.load();
  $("#movie-player-title").textContent=m.title;
  $("#movie-modal-year").textContent=m.year+" • "+m.runtime;
  $("#movie-modal-title").textContent=m.title;
  $("#movie-modal-description").textContent=m.description;
  $("#movie-modal-tags").innerHTML=m.tags.map(t=>"<span>"+esc(t)+"</span>").join("");
  $("#movie-modal-source").textContent="Source: "+m.source;
  $("#movie-pin").onclick=()=>toggleSave(m);
  $("#movie-pin").innerHTML=isSaved(m.id)?'<i class="fa-solid fa-bookmark"></i> Saved':'<i class="fa-regular fa-bookmark"></i> Save';
  $("#movie-player-error").hidden=true;
  $("#movie-progress").value=0;
  $("#movie-current-time").textContent="0:00";
  $("#movie-duration").textContent="0:00";
  modal.hidden=false;
  document.body.classList.add("movie-player-open");
  video.play().catch(()=>setPlayIcon());
}

function toggleSave(m){
  const list=saved(),i=list.indexOf(m.id);
  if(i>=0)list.splice(i,1);else list.push(m.id);
  saveList(list);render();
  if(activeMovie?.id===m.id)$("#movie-pin").innerHTML=isSaved(m.id)?'<i class="fa-solid fa-bookmark"></i> Saved':'<i class="fa-regular fa-bookmark"></i> Save';
}

function render(){
  const q=($("#movies-search")?.value||"").trim().toLowerCase();
  const list=movies.filter(m=>(activeFilter==="all"||m.categories.includes(activeFilter))&&(!q||m.title.toLowerCase().includes(q)||m.tags.join(" ").toLowerCase().includes(q)));
  $("#movies-count").textContent=list.length+" film"+(list.length===1?"":"s");
  $("#movie-grid").innerHTML=list.map(m=>{
    const savedClass=isSaved(m.id)?"saved":"";
    const icon=isSaved(m.id)?"solid":"regular";
    return '<article class="movie-card" data-id="'+esc(m.id)+'"><button class="movie-save '+savedClass+'" data-save="'+esc(m.id)+'" aria-label="Save film"><i class="fa-'+icon+' fa-bookmark"></i></button><span class="movie-badge">'+esc(m.badge)+'</span><div class="movie-poster"><img src="'+esc(m.posterUrl)+'" alt="" loading="lazy"><div class="movie-poster-shade"></div><strong class="movie-poster-title">'+esc(m.short)+'</strong><span class="movie-play"><i class="fa-solid fa-play"></i></span></div><div class="movie-card-body"><h3>'+esc(m.title)+'</h3><div class="movie-meta"><span>'+m.year+'</span><span>•</span><span>'+esc(m.runtime)+'</span></div></div></article>';
  }).join("");
  document.querySelectorAll(".movie-card").forEach(card=>card.onclick=e=>{
    if(e.target.closest(".movie-save"))return;
    const m=movies.find(x=>x.id===card.dataset.id);
    if(m)openMovie(m);
  });
  document.querySelectorAll(".movie-save").forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    const m=movies.find(x=>x.id===b.dataset.save);
    if(m)toggleSave(m);
  });
}

async function init(){
  try{
    const r=await fetch("/assets/data/movies.json?v=lunar3",{cache:"no-store"});
    if(!r.ok)throw new Error("Movie catalogue request failed: "+r.status);
    movies=await r.json();
    if(movies[0])$("#movies-featured-watch").onclick=()=>openMovie(movies[0]);
    $("#movies-random").onclick=()=>movies.length&&openMovie(movies[Math.floor(Math.random()*movies.length)]);
    $("#movies-search").oninput=render;
    document.querySelectorAll(".movie-filter").forEach(b=>b.onclick=()=>{
      document.querySelectorAll(".movie-filter").forEach(x=>x.classList.remove("active"));
      b.classList.add("active");activeFilter=b.dataset.filter;render();
    });
    document.querySelectorAll("[data-close-movie]").forEach(x=>x.onclick=closeMovie);
    const video=$("#movie-player");
    $("#movie-play").onclick=togglePlayback;
    $("#movie-big-play").onclick=togglePlayback;
    video.onclick=togglePlayback;
    video.addEventListener("play",setPlayIcon);
    video.addEventListener("pause",setPlayIcon);
    video.addEventListener("timeupdate",syncPlayer);
    video.addEventListener("loadedmetadata",syncPlayer);
    video.addEventListener("ended",setPlayIcon);
    video.addEventListener("error",()=>$("#movie-player-error").hidden=false);
    $("#movie-progress").oninput=e=>{
      if(video.duration)video.currentTime=(Number(e.target.value)/100)*video.duration;
    };
    $("#movie-mute").onclick=()=>{
      video.muted=!video.muted;
      $("#movie-mute i").className=video.muted?"fa-solid fa-volume-xmark":"fa-solid fa-volume-high";
    };
    $("#movie-fullscreen").onclick=()=>{
      const wrap=$(".movie-player-wrap");
      if(document.fullscreenElement)document.exitFullscreen();
      else wrap.requestFullscreen?.();
    };
    document.addEventListener("keydown",e=>{
      if($("#movie-modal").hidden)return;
      if(e.key==="Escape")closeMovie();
      if(e.key===" "&&document.activeElement.tagName!=="INPUT"){e.preventDefault();togglePlayback()}
      if(e.key==="ArrowRight")video.currentTime=Math.min(video.duration||0,video.currentTime+5);
      if(e.key==="ArrowLeft")video.currentTime=Math.max(0,video.currentTime-5);
    });
    render();
  }catch(e){
    console.error(e);
    $("#movie-grid").innerHTML="<p>Movies could not be loaded right now.</p>";
  }
}
document.addEventListener("DOMContentLoaded",init);