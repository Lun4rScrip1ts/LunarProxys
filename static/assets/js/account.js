(() => {
  const authCard=document.getElementById("auth-card"), profileCard=document.getElementById("profile-card");
  const authForm=document.getElementById("auth-form"), errorEl=document.getElementById("auth-error");
  const tabs=[...document.querySelectorAll(".auth-tab")]; let mode="login", user=null;
  const api=async(url,options)=>{const res=await fetch(url,{credentials:"same-origin",...options});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||"Something went wrong.");return data;};
  const setMode=m=>{mode=m;const reg=m==="register";tabs.forEach(t=>t.classList.toggle("active",t.dataset.mode===m));
    document.getElementById("auth-title").textContent=reg?"Create your Lunar account":"Welcome back";
    document.getElementById("auth-subtitle").textContent=reg?"Use an email, username, and password to create your profile.":"Log in with your username or email.";
    document.getElementById("auth-submit").textContent=reg?"Create Account":"Log In";
    ["register-username-row","email-row","display-name-row"].forEach(id=>document.getElementById(id).hidden=!reg);
    document.getElementById("identifier-label").hidden=reg; document.getElementById("auth-identifier").required=!reg;
    document.getElementById("auth-username").required=reg; document.getElementById("auth-email").required=reg; errorEl.textContent="";};
  const initials=n=>(n||"?").trim().slice(0,2).toUpperCase();
  const setProfile=()=>{authCard.hidden=true;profileCard.hidden=false;
    document.getElementById("profile-display").textContent=user.displayName;
    document.getElementById("profile-username").textContent="@"+user.username;
    document.getElementById("profile-avatar").innerHTML=user.avatarUrl?'<img src="'+user.avatarUrl+'" alt="">':initials(user.displayName);
    document.getElementById("profile-username-input").value=user.username||"";
    document.getElementById("profile-email").value=user.email||"";
    document.getElementById("profile-name").value=user.displayName||"";
    document.getElementById("profile-status").value=user.status||"";
    document.getElementById("profile-bio").value=user.bio||"";
    document.getElementById("profile-banner").style.backgroundImage=user.bannerUrl?'url("'+user.bannerUrl+'")':"";
    document.getElementById("profile-background").style.backgroundImage=user.backgroundUrl?'url("'+user.backgroundUrl+'")':"";
  };
  const fileData=async id=>{const f=document.getElementById(id).files?.[0];if(!f)return "";
    if(!["image/png","image/jpeg","image/webp","image/gif"].includes(f.type))throw new Error("Use PNG, JPG, WEBP, or GIF images.");
    if(f.size>8*1024*1024)throw new Error("Each image must be smaller than 8 MB.");
    return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error("Could not read image."));r.readAsDataURL(f);});};
  const savedLogin = localStorage.getItem("ls_login_identifier") || "";
  const identifierInput = document.getElementById("auth-identifier");
  if (identifierInput) identifierInput.value = savedLogin;
  tabs.forEach(t=>t.addEventListener("click",()=>setMode(t.dataset.mode)));
  authForm.addEventListener("submit",async e=>{e.preventDefault();errorEl.textContent="";const b=document.getElementById("auth-submit");b.disabled=true;
    try{const data=await api(mode==="register"?"/api/auth/register":"/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(mode==="register"?{
      username:document.getElementById("auth-username").value,email:document.getElementById("auth-email").value,
      displayName:document.getElementById("auth-display-name").value,password:document.getElementById("auth-password").value}:{
      identifier:document.getElementById("auth-identifier").value,password:document.getElementById("auth-password").value})});
      if (mode === "login") localStorage.setItem("ls_login_identifier", document.getElementById("auth-identifier").value.trim());
      user=data.user;setProfile();}
    catch(err){errorEl.textContent=err.message;}finally{b.disabled=false;}});
  document.getElementById("profile-form").addEventListener("submit",async e=>{e.preventDefault();const ok=document.getElementById("profile-success"),err=document.getElementById("profile-error");ok.textContent="";err.textContent="";
    try{const [avatarData,bannerData,backgroundData]=await Promise.all([fileData("profile-avatar-file"),fileData("profile-banner-file"),fileData("profile-background-file")]);
      const data=await api("/api/profile",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        username:document.getElementById("profile-username-input").value,email:document.getElementById("profile-email").value,
        displayName:document.getElementById("profile-name").value,status:document.getElementById("profile-status").value,
        bio:document.getElementById("profile-bio").value,avatarData,bannerData,backgroundData})});
      user=data.user;setProfile();["profile-avatar-file","profile-banner-file","profile-background-file"].forEach(id=>document.getElementById(id).value="");ok.textContent="Profile saved.";
    }catch(e2){err.textContent=e2.message;}});
  document.getElementById("logout-button").addEventListener("click",async()=>{try{await api("/api/auth/logout",{method:"POST"});}catch{}user=null;authCard.hidden=false;profileCard.hidden=true;setMode("login");});
  api("/api/auth/me").then(d=>{user=d.user;if(user)setProfile();else setMode("login");}).catch(()=>setMode("login"));
})();
