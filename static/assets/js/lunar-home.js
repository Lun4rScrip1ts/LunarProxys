(() => {
  const setHomeText=()=>{
    const title=document.querySelector(".title");
    if(title) title.textContent="Lunar Proxy";
    const splash=document.getElementById("splash");
    if(splash && !splash.textContent.trim()) splash.textContent="A cleaner way to explore the web.";
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setHomeText);else setHomeText();
})();