(() => {
  const authCard = document.getElementById("auth-card");
  const profileCard = document.getElementById("profile-card");
  const authForm = document.getElementById("auth-form");
  const authTitle = document.getElementById("auth-title");
  const authSubtitle = document.getElementById("auth-subtitle");
  const authSubmit = document.getElementById("auth-submit");
  const errorEl = document.getElementById("auth-error");
  const tabs = [...document.querySelectorAll(".auth-tab")];
  let mode = "login";
  let user = null;

  const api = async (url, options) => {
    const response = await fetch(url, { credentials:"same-origin", ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  };

  function setMode(next) {
    mode = next;
    const register = mode === "register";
    tabs.forEach(tab => tab.classList.toggle("active", tab.dataset.mode === mode));
    authTitle.textContent = register ? "Create your Lunar account" : "Welcome back";
    authSubtitle.textContent = register ? "Create a profile for Global Chat and the Lunar community." : "Log in to use Global Chat and manage your profile.";
    authSubmit.textContent = register ? "Create Account" : "Log In";
    ["display-name-row","avatar-row","bio-row","status-row"].forEach(id => document.getElementById(id).hidden = !register);
    document.getElementById("auth-password").autocomplete = register ? "new-password" : "current-password";
    errorEl.textContent = "";
  }

  function initials(name) { return (name || "?").trim().slice(0, 2).toUpperCase(); }

  function avatarHtml(user) {
    return user.avatarUrl
      ? `<img src="${encodeURI(user.avatarUrl)}" alt="Profile picture">`
      : initials(user.displayName);
  }

  function showProfile() {
    authCard.hidden = true;
    profileCard.hidden = false;
    document.getElementById("profile-display").textContent = user.displayName;
    document.getElementById("profile-username").textContent = "@" + user.username;
    document.getElementById("profile-avatar").innerHTML = avatarHtml(user);
    document.getElementById("profile-name").value = user.displayName || "";
    document.getElementById("profile-picture").value = user.avatarUrl || "";
    document.getElementById("profile-status").value = user.status || "";
    document.getElementById("profile-bio").value = user.bio || "";
  }

  function showAuth() {
    authCard.hidden = false;
    profileCard.hidden = true;
  }

  tabs.forEach(tab => tab.addEventListener("click", () => setMode(tab.dataset.mode)));

  authForm.addEventListener("submit", async event => {
    event.preventDefault();
    errorEl.textContent = "";
    authSubmit.disabled = true;
    const body = {
      username: document.getElementById("auth-username").value,
      password: document.getElementById("auth-password").value,
      displayName: document.getElementById("auth-display-name").value,
      avatarUrl: document.getElementById("auth-avatar").value,
      bio: document.getElementById("auth-bio").value,
      status: document.getElementById("auth-status").value,
    };
    try {
      const data = await api(mode === "register" ? "/api/auth/register" : "/api/auth/login", {
        method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)
      });
      user = data.user;
      showProfile();
    } catch (error) {
      errorEl.textContent = error.message;
    } finally {
      authSubmit.disabled = false;
    }
  });

  document.getElementById("profile-form").addEventListener("submit", async event => {
    event.preventDefault();
    const success = document.getElementById("profile-success");
    const error = document.getElementById("profile-error");
    success.textContent = "";
    error.textContent = "";
    try {
      const data = await api("/api/profile", {
        method:"PATCH", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          displayName:document.getElementById("profile-name").value,
          avatarUrl:document.getElementById("profile-picture").value,
          status:document.getElementById("profile-status").value,
          bio:document.getElementById("profile-bio").value
        })
      });
      user = data.user;
      showProfile();
      success.textContent = "Profile saved.";
    } catch (err) { error.textContent = err.message; }
  });

  document.getElementById("logout-button").addEventListener("click", async () => {
    await api("/api/auth/logout", { method:"POST" });
    user = null;
    showAuth();
    setMode("login");
  });

  api("/api/auth/me").then(data => {
    user = data.user;
    if (user) showProfile(); else { showAuth(); setMode("login"); }
  }).catch(() => { showAuth(); setMode("login"); });
})();
