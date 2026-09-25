(() => {
  const messagesEl = document.getElementById("chat-messages");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const status = document.getElementById("chat-status");
  const note = document.getElementById("chat-login-note");
  const accountLabel = document.getElementById("community-account-label");
  const replyBar = document.getElementById("reply-bar");
  const replyLabel = document.getElementById("reply-label");
  const editBar = document.getElementById("edit-bar");
  const stickerDrawer = document.getElementById("sticker-drawer");
  const stickerGrid = document.getElementById("sticker-grid");
  const stickerEmpty = document.getElementById("sticker-empty");
  const toast = document.getElementById("chat-toast");
  const reactionPicker = document.getElementById("reaction-picker");
  const reactionUsers = document.getElementById("reaction-users");
  const ALLOWED_REACTIONS = ["👍","❤️","😂","😮","😢","🎉","🔥","👎"];
  let currentUser = null;
  let messages = [];
  let replyTo = null;
  let editingId = null;
  let lastSignature = "";
  let refreshBusy = false;
  let toastTimer = null;

  const escape = value => {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
  };

  const escapeAttr = value => escape(value).replace(/"/g, "&quot;");
  const initials = name => (name || "?").trim().slice(0, 2).toUpperCase();
  const avatar = user => user.avatarUrl
    ? `<img src="${escapeAttr(user.avatarUrl)}" alt="">`
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

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function closePopovers() {
    reactionPicker.hidden = true;
    reactionUsers.hidden = true;
  }

  function openReply(message) {
    if (!currentUser) return;
    editingId = null;
    editBar.hidden = true;
    replyTo = message;
    replyLabel.textContent = `Replying to @${message.username}: ${(message.message || "[attachment]").slice(0, 90)}`;
    replyBar.hidden = false;
    input.focus();
  }

  function cancelReply() {
    replyTo = null;
    replyBar.hidden = true;
  }

  function openEdit(message) {
    if (!currentUser || message.userId !== currentUser.id) return;
    replyTo = null;
    replyBar.hidden = true;
    editingId = message.id;
    editBar.hidden = false;
    input.value = message.message || "";
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }

  function cancelEdit() {
    editingId = null;
    editBar.hidden = true;
    input.value = "";
  }

  function attachmentHtml(message) {
    const attachment = message.attachments?.[0];
    if (!attachment) return "";
    const url = escapeAttr(attachment.url);
    if (attachment.kind === "sticker") {
      return `<div class="chat-attachment chat-sticker-attachment" data-sticker-url="${url}" data-sticker-name="${escapeAttr(attachment.name || "Saved sticker")}">
        <img src="${url}" alt="${escapeAttr(attachment.name || "Sticker")}" loading="lazy">
        <button class="sticker-save-badge" type="button" title="Save sticker"><i class="fa-regular fa-bookmark"></i></button>
      </div>`;
    }
    return `<div class="chat-attachment ${attachment.kind === "gif" ? "chat-gif" : "chat-image"}"><img src="${url}" alt="${escapeAttr(attachment.name || attachment.kind)}" loading="lazy"></div>`;
  }

  function reactionHtml(message) {
    return (message.reactions || []).map(reaction => {
      const mine = (reaction.users || []).some(user => user.userId === currentUser?.id);
      return `<button type="button" class="reaction-pill ${mine ? "mine" : ""}" data-reaction-message="${message.id}" data-reaction-emoji="${escapeAttr(reaction.emoji)}" title="Click to react • Right-click to see who reacted">
        <span>${escape(reaction.emoji)}</span><b>${reaction.users?.length || 0}</b>
      </button>`;
    }).join("");
  }

  function render(messagesList) {
    const signature = JSON.stringify(messagesList.map(m => ({
      id:m.id, message:m.message, editedAt:m.editedAt, replyTo:m.replyTo?.id || "",
      attachments:m.attachments || [], reactions:m.reactions || [], avatarUrl:m.avatarUrl || ""
    })));
    const nearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 120;
    messages = messagesList;
    if (signature === lastSignature) return;
    lastSignature = signature;

    messagesEl.innerHTML = messagesList.map(message => `
      <article class="chat-message" data-message-id="${message.id}">
        <div class="chat-avatar"><a href="/profile/${encodeURIComponent(message.username)}">${avatar(message)}</a></div>
        <div class="chat-message-body">
          <div class="chat-meta">
            <a class="chat-name" href="/profile/${encodeURIComponent(message.username)}">${escape(message.displayName)}</a>
            <span class="chat-username">@${escape(message.username)}</span>
            <time class="chat-time" datetime="${escapeAttr(message.createdAt)}">${escape(time(message.createdAt))}</time>
          </div>
          ${message.replyTo ? `<button type="button" class="chat-reply-preview" data-jump-to="${escapeAttr(message.replyTo.id)}"><i class="fa-solid fa-reply"></i><span>Replying to <b>@${escape(message.replyTo.username)}</b>: ${escape((message.replyTo.message || "[attachment]").slice(0, 90))}</span></button>` : ""}
          <div class="chat-text">${escape(message.message)}</div>
          ${attachmentHtml(message)}
          ${message.editedAt ? `<div class="chat-edited" title="${escapeAttr("Edited " + time(message.editedAt))}">Edited</div>` : ""}
          <div class="reaction-row">${reactionHtml(message)}</div>
        </div>
        <div class="message-actions" aria-label="Message actions">
          <button type="button" data-action="react" title="Add reaction"><i class="fa-regular fa-face-smile"></i></button>
          <button type="button" data-action="reply" title="Reply"><i class="fa-solid fa-reply"></i></button>
          ${message.userId === currentUser?.id ? `<button type="button" data-action="edit" title="Edit"><i class="fa-solid fa-pen"></i></button>` : ""}
        </div>
      </article>
    `).join("");

    if (nearBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function renderStickers(stickers) {
    stickerGrid.innerHTML = (stickers || []).map(sticker => `
      <button type="button" class="sticker-card" data-send-sticker="${escapeAttr(sticker.url)}" data-sticker-name="${escapeAttr(sticker.name || "Saved sticker")}">
        <img src="${escapeAttr(sticker.url)}" alt="${escapeAttr(sticker.name || "Sticker")}" loading="lazy">
        <span>${escape(sticker.name || "Sticker")}</span>
      </button>
    `).join("");
    stickerEmpty.hidden = Boolean(stickers?.length);
    document.getElementById("sticker-count").textContent = `${stickers?.length || 0} saved sticker${stickers?.length === 1 ? "" : "s"}`;
  }

  async function refresh() {
    if (refreshBusy) return;
    refreshBusy = true;
    try {
      const [me, chat] = await Promise.all([
        api("/api/auth/me"),
        api("/api/chat/messages?limit=100")
      ]);
      currentUser = me.user;
      status.textContent = currentUser ? `Signed in as @${currentUser.username}` : "Read-only mode";
      accountLabel.textContent = currentUser ? "Profile" : "Log in";
      note.hidden = Boolean(currentUser);
      input.disabled = !currentUser;
      input.placeholder = currentUser ? (editingId ? "Edit your message..." : "Write a message...") : "Log in to send a message";
      render(chat.messages);
      if (currentUser) renderStickers(currentUser.stickers || []);
    } catch (error) {
      status.textContent = error.message;
    } finally {
      refreshBusy = false;
    }
  }

  async function uploadFile(file, kind) {
    if (!currentUser) {
      location.href = "/account";
      return;
    }
    if (!file) return;
    if (!["image/png","image/jpeg","image/webp","image/gif"].includes(file.type)) {
      showToast("Use a PNG, JPG, WEBP, or GIF image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast("Images must be smaller than 8 MB.");
      return;
    }
    if (kind === "gif" && file.type !== "image/gif") {
      showToast("Choose a GIF file for the GIF button.");
      return;
    }

    try {
      showToast(kind === "sticker" ? "Creating sticker..." : "Uploading...");
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not read the image."));
        reader.readAsDataURL(file);
      });
      const uploaded = await api("/api/chat/uploads", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({kind, data:dataUrl})
      });
      await sendMessage("", {
        url:uploaded.url,
        kind:uploaded.kind,
        name:file.name.replace(/\.[^.]+$/, "").slice(0,80)
      });
      if (kind === "sticker") {
        await saveSticker(uploaded.url, file.name.replace(/\.[^.]+$/, "").slice(0,50) || "Sticker");
      }
    } catch (error) {
      showToast(error.message);
    }
  }

  async function saveSticker(url, name) {
    if (!currentUser || !url) return;
    try {
      const data = await api("/api/stickers/save", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({url, name:name || "Saved sticker"})
      });
      currentUser.stickers = data.stickers || [];
      renderStickers(currentUser.stickers);
    } catch {}
  }

  async function sendMessage(text, attachment = null) {
    if (!currentUser) return;
    const payload = { message:text, attachment };
    if (replyTo) payload.replyTo = replyTo.id;
    const data = await api("/api/chat/messages", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload)
    });
    if (attachment?.kind === "sticker") await saveSticker(attachment.url, attachment.name);
    replyTo = null;
    replyBar.hidden = true;
    input.value = "";
    await refresh();
    input.focus();
    return data;
  }

  function showReactionPicker(button, messageId) {
    closePopovers();
    reactionPicker.innerHTML = ALLOWED_REACTIONS.map(emoji =>
      `<button type="button" data-picker-message="${escapeAttr(messageId)}" data-picker-emoji="${escapeAttr(emoji)}">${emoji}</button>`
    ).join("");
    const rect = button.getBoundingClientRect();
    reactionPicker.style.left = Math.max(8, Math.min(window.innerWidth - 250, rect.left - 80)) + "px";
    reactionPicker.style.top = Math.max(8, rect.top - 55) + "px";
    reactionPicker.hidden = false;
  }

  function showReactionUsers(button, reaction) {
    closePopovers();
    const users = reaction?.users || [];
    reactionUsers.innerHTML = `
      <div class="reaction-users-title">${escape(reaction?.emoji || "")} ${users.length} reaction${users.length === 1 ? "" : "s"}</div>
      <div class="reaction-users-list">${users.map(user => `<a href="/profile/${encodeURIComponent(user.username)}"><span class="reaction-user-avatar">${escape(initials(user.username))}</span>@${escape(user.username)}</a>`).join("") || "<span class=\"reaction-users-empty\">Nobody has reacted yet.</span>"}</div>
    `;
    const rect = button.getBoundingClientRect();
    reactionUsers.style.left = Math.max(8, Math.min(window.innerWidth - 260, rect.left)) + "px";
    reactionUsers.style.top = Math.max(8, rect.top - Math.min(220, 70 + users.length * 34)) + "px";
    reactionUsers.hidden = false;
  }

  messagesEl.addEventListener("click", async event => {
    const reactionButton = event.target.closest("[data-reaction-message]");
    if (reactionButton) {
      const id = reactionButton.dataset.reactionMessage;
      const emoji = reactionButton.dataset.reactionEmoji;
      if (!currentUser) { location.href="/account"; return; }
      try {
        await api(`/api/chat/messages/${encodeURIComponent(id)}/reactions`, {
          method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({emoji})
        });
        await refresh();
      } catch (error) { showToast(error.message); }
      return;
    }

    const pickerButton = event.target.closest("[data-picker-message]");
    if (pickerButton) {
      const id = pickerButton.dataset.pickerMessage;
      const emoji = pickerButton.dataset.pickerEmoji;
      reactionPicker.hidden = true;
      try {
        await api(`/api/chat/messages/${encodeURIComponent(id)}/reactions`, {
          method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({emoji})
        });
        await refresh();
      } catch (error) { showToast(error.message); }
      return;
    }

    const action = event.target.closest("[data-action]");
    if (action) {
      const article = action.closest("[data-message-id]");
      const message = messages.find(item => item.id === article?.dataset.messageId);
      if (!message) return;
      if (action.dataset.action === "react") showReactionPicker(action, message.id);
      if (action.dataset.action === "reply") openReply(message);
      if (action.dataset.action === "edit") openEdit(message);
      return;
    }

    const jump = event.target.closest("[data-jump-to]");
    if (jump) {
      const target = messagesEl.querySelector(`[data-message-id="${CSS.escape(jump.dataset.jumpTo)}"]`);
      if (target) {
        target.scrollIntoView({behavior:"smooth", block:"center"});
        target.classList.add("chat-message-highlight");
        setTimeout(() => target.classList.remove("chat-message-highlight"), 1100);
      }
      return;
    }

    const save = event.target.closest(".sticker-save-badge");
    if (save) {
      const attachment = save.closest(".chat-sticker-attachment");
      await saveSticker(attachment?.dataset.stickerUrl, attachment?.dataset.stickerName);
      showToast("Sticker saved to your collection.");
    }
  });

  messagesEl.addEventListener("contextmenu", event => {
    const reactionButton = event.target.closest("[data-reaction-message]");
    if (!reactionButton) return;
    event.preventDefault();
    const message = messages.find(item => item.id === reactionButton.dataset.reactionMessage);
    const reaction = message?.reactions?.find(item => item.emoji === reactionButton.dataset.reactionEmoji);
    showReactionUsers(reactionButton, reaction);
  });

  messagesEl.addEventListener("mouseover", event => {
    const sticker = event.target.closest(".chat-sticker-attachment");
    if (sticker && currentUser && !sticker.dataset.saved) {
      sticker.dataset.saved = "1";
      saveSticker(sticker.dataset.stickerUrl, sticker.dataset.stickerName);
    }
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!currentUser) { location.href = "/account"; return; }
    const text = input.value.trim();
    if (editingId) {
      if (!text) return;
      const id = editingId;
      try {
        await api(`/api/chat/messages/${encodeURIComponent(id)}`, {
          method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({message:text})
        });
        cancelEdit();
        showToast("Message edited.");
        await refresh();
      } catch (error) { showToast(error.message); }
      return;
    }
    if (!text) return;
    input.disabled = true;
    try {
      await sendMessage(text);
    } catch (error) {
      showToast(error.message);
    } finally {
      input.disabled = !currentUser;
    }
  });

  document.getElementById("cancel-reply").addEventListener("click", cancelReply);
  document.getElementById("cancel-edit-top").addEventListener("click", cancelEdit);

  document.getElementById("chat-image-button").addEventListener("click", () => document.getElementById("chat-image-file").click());
  document.getElementById("chat-gif-button").addEventListener("click", () => document.getElementById("chat-gif-file").click());
  document.getElementById("chat-sticker-button").addEventListener("click", () => document.getElementById("chat-sticker-file").click());
  document.getElementById("chat-image-file").addEventListener("change", event => uploadFile(event.target.files?.[0], "image").finally(() => event.target.value=""));
  document.getElementById("chat-gif-file").addEventListener("change", event => uploadFile(event.target.files?.[0], "gif").finally(() => event.target.value=""));
  document.getElementById("chat-sticker-file").addEventListener("change", event => uploadFile(event.target.files?.[0], "sticker").finally(() => event.target.value=""));

  function openStickerDrawer() {
    if (!currentUser) { location.href="/account"; return; }
    renderStickers(currentUser.stickers || []);
    stickerDrawer.classList.add("open");
    stickerDrawer.setAttribute("aria-hidden","false");
  }
  function closeStickerDrawer() {
    stickerDrawer.classList.remove("open");
    stickerDrawer.setAttribute("aria-hidden","true");
  }
  document.getElementById("chat-sticker-catalog").addEventListener("click", openStickerDrawer);
  document.getElementById("close-sticker-drawer").addEventListener("click", closeStickerDrawer);

  stickerGrid.addEventListener("click", async event => {
    const sticker = event.target.closest("[data-send-sticker]");
    if (!sticker) return;
    try {
      await sendMessage("", {url:sticker.dataset.sendSticker, kind:"sticker", name:sticker.dataset.stickerName});
      closeStickerDrawer();
    } catch (error) { showToast(error.message); }
  });

  document.addEventListener("click", event => {
    if (!event.target.closest(".reaction-picker") && !event.target.closest("[data-action='react']")) reactionPicker.hidden = true;
    if (!event.target.closest(".reaction-users") && !event.target.closest("[data-reaction-message]")) reactionUsers.hidden = true;
  });

  refresh();
  setInterval(refresh, 3000);
})();