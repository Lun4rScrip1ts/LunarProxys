(() => {
  const ready = () => {
    if (!window.store) return;
    const body=document.body;
    const get=(key,fallback)=>store.get(key) ?? fallback;
    const setClass=(prefix,value)=>{
      [...body.classList].filter(x=>x.startsWith(prefix)).forEach(x=>body.classList.remove(x));
      if(value) body.classList.add(prefix+value);
    };

    const glass=document.getElementById("lunar-glass-switch");
    const motion=document.getElementById("lunar-motion-switch");
    const compact=document.getElementById("lunar-compact-switch");
    const glassRange=document.getElementById("lunar-glass-range");
    const scaleRange=document.getElementById("lunar-scale-range");
    const glassOut=document.getElementById("lunar-glass-value");
    const scaleOut=document.getElementById("lunar-scale-value");

    const glassOn=get("lunarGlass","true")==="true";
    const motionOn=get("lunarMotion","true")==="true";
    const compactOn=get("lunarCompact","false")==="true";
    const glassValue=Number(get("lunarGlassIntensity","72"));
    const scaleValue=Number(get("lunarScale","100"));

    if(glass){glass.checked=glassOn;glass.onchange=()=>{store.set("lunarGlass",String(glass.checked));body.classList.toggle("lunar-glass-off",!glass.checked)}}
    if(motion){motion.checked=motionOn;motion.onchange=()=>{store.set("lunarMotion",String(motion.checked));body.classList.toggle("lunar-no-motion",!motion.checked)}}
    if(compact){compact.checked=compactOn;compact.onchange=()=>{store.set("lunarCompact",String(compact.checked));body.classList.toggle("lunar-compact",compact.checked)}}
    if(glassRange){glassRange.value=glassValue;if(glassOut)glassOut.value=glassValue+"%";glassRange.oninput=()=>{store.set("lunarGlassIntensity",glassRange.value);if(glassOut)glassOut.value=glassRange.value+"%";document.documentElement.style.setProperty("--lunar-panel-alpha",(Number(glassRange.value)/100).toFixed(2))}}
    if(scaleRange){scaleRange.value=scaleValue;if(scaleOut)scaleOut.value=scaleValue+"%";setClass("lunar-scale-",scaleValue===100?"":scaleValue);scaleRange.oninput=()=>{store.set("lunarScale",scaleRange.value);if(scaleOut)scaleOut.value=scaleRange.value+"%";setClass("lunar-scale-",scaleRange.value==="100"?"":scaleRange.value)}}

    body.classList.toggle("lunar-glass-off",!glassOn);
    body.classList.toggle("lunar-no-motion",!motionOn);
    body.classList.toggle("lunar-compact",compactOn);
    document.documentElement.style.setProperty("--lunar-panel-alpha",(glassValue/100).toFixed(2));

    const pointer=document.getElementById("pointer-dropdown");
    if(pointer && !get("pointer")) pointer.value="lunar-dot";
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",ready);else ready();
})();