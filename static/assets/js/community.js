(() => {
  const messagesEl = document.getElementById("chat-messages");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const status = document.getElementById("chat-status");
  const note = document.getElementById("chat-login-note");
  const accountLabel = document.getElementById("community-account-label");
  let currentUser = null;
  let lastSignature = "";

  const escape = value => {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
  };

  const initials = name => (name || "?").trim().slice(0, 2).toUpperCase();

  const avatar = user => user.avatarUrl
    ? `<img src="${escape(user.avatarUrl)}" alt="">`
    : escape(initials(user.displayName));

  const time = iso => new Date(iso).toLocaleString([], {
    month:"short", day:"numeric", year:"numeric", hour:"numeric", minute:"2-digit"
  });

  async function api(url, options) {
    const response = await fetch(url, { credentials:"same-origin", ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  }

  function render(messages) {
    const signature = messages.map(m => m.id).join(",");
    if (signature === lastSignature) return;
    lastSignature = signature;
    const nearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 100;
    messagesEl.innerHTML = messages.map(message => `
      <article class="chat-message">
        <div class="chat-avatar">${avatar(message)}</div>
        <div>
          <div class="chat-meta">
            <span class="chat-name">${escape(message.displayName)}</span>
            <span class="chat-username">@${escape(message.username)}</span>
            <time class="chat-time" datetime="${escape(message.createdAt)}">${escape(time(message.createdAt))}</time>
          </div>
          <div class="chat-text">${escape(message.message)}</div>
        </div>
      </article>
    `).join("");
    if (nearBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function refresh() {
    try {
      const [me, chat] = await Promise.all([api("/api/auth/me"), api("/api/chat/messages?limit=100")]);
      currentUser = me.user;
      status.textContent = currentUser ? `Signed in as @${currentUser.username}` : "Read-only mode";
      accountLabel.textContent = currentUser ? "Profile" : "Log in";
      note.hidden = Boolean(currentUser);
      input.disabled = !currentUser;
      input.placeholder = currentUser ? "Write a message..." : "Log in to send a message";
      render(chat.messages);
    } catch (error) {
      status.textContent = error.message;
    }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!currentUser) { location.href = "/account"; return; }
    const message = input.value.trim();
    if (!message) return;
    input.disabled = true;
    try {
      await api("/api/chat/messages", {
        method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({message})
      });
      input.value = "";
      await refresh();
      input.focus();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      input.disabled = !currentUser;
    }
  });

  refresh();
  setInterval(refresh, 3000);
})();
