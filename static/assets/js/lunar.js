(() => {
  const finePointer = matchMedia("(pointer:fine)");
  if (!finePointer.matches) return;
  const dot=document.createElement("div");
  dot.className="lunar-cursor";
  document.documentElement.appendChild(dot);
  let x=innerWidth/2,y=innerHeight/2,tx=x,ty=y,visible=false;
  const speed=.28;
  addEventListener("mousemove",e=>{tx=e.clientX;ty=e.clientY;visible=true;dot.style.opacity="1";},{passive:true});
  addEventListener("mouseleave",()=>{visible=false;dot.style.opacity="0";},{passive:true});
  addEventListener("mouseenter",()=>{if(visible)dot.style.opacity="1";},{passive:true});
  const tick=()=>{x+=(tx-x)*speed;y+=(ty-y)*speed;dot.style.transform=`translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;requestAnimationFrame(tick)};
  requestAnimationFrame(tick);
  const update=()=>document.querySelectorAll("a,button,input,select,textarea,[role=button]").forEach(el=>{
    if(el.dataset.lunarCursor) return;
    el.dataset.lunarCursor="1";
    el.addEventListener("mouseenter",()=>dot.classList.add("is-hover"));
    el.addEventListener("mouseleave",()=>dot.classList.remove("is-hover"));
  });
  new MutationObserver(update).observe(document.body,{childList:true,subtree:true});
  update();
  document.documentElement.style.cursor="none";
  document.addEventListener("mouseover",e=>{if(e.target.closest("iframe")) dot.style.opacity="0"});
  document.addEventListener("mouseout",e=>{if(e.target.closest("iframe")&&visible) dot.style.opacity="1"});
})();