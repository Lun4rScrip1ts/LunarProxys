(() => {
  const messagesEl = document.getElementById("chat-messages");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const status = document.getElementById("chat-status");
  const note = document.getElementById("chat-login-note");
  const accountLabel = document.getElementById("community-account-label");
  const mediaButton = document.getElementById("media-button");
  const mediaInput = document.getElementById("media-input");
  const stickerButton = document.getElementById("sticker-button");
  const stickerPanel = document.getElementById("sticker-panel");
  const stickerGrid = document.getElementById("sticker-grid");
  const stickerEmpty = document.getElementById("sticker-empty");
  const stickerCount = document.getElementById("sticker-count");
  const attachmentDraft = document.getElementById("attachment-draft");
  const attachmentPreview = document.getElementById("attachment-preview");
  const attachmentName = document.getElementById("attachment-name");
  const attachmentKindLabel = document.getElementById("attachment-kind-label");
  const sendAsSticker = document.getElementById("send-as-sticker");
  const replyBar = document.getElementById("reply-bar");
  const replyName = document.getElementById("reply-name");
  const replyPreview = document.getElementById("reply-preview");

  const reactionChoices = ["👍","❤️","😂","😮","😢","🎉","🔥","👎"];
  let currentUser = null;
  let currentMessages = [];
  let lastSignature = "";
  let replyTo = null;
  let attachment = null;
  let sending = false;

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

  function signature(messages) {
    return messages.map(m => [
      m.id, m.message, m.editedAt, JSON.stringify(m.reactions || []),
      JSON.stringify(m.attachments || []), m.replyTo?.id || ""
    ].join(":")).join("|");
  }

  function attachmentHtml(item, message) {
    if (!item?.url) return "";
    const sticker = item.kind === "sticker";
    const safeUrl = escape(item.url);
    const safeName = escape(item.name || "Sticker");
    return `<div class="chat-attachment ${sticker ? "sticker" : ""}">
      <img src="${safeUrl}" alt="${safeName}" loading="lazy">
      ${sticker ? `<button type="button" class="sticker-save-button" data-action="save-sticker" data-url="${safeUrl}" data-name="${safeName}"><i class="fa-solid fa-bookmark"></i> Save sticker</button>` : ""}
    </div>`;
  }

  function reactionHtml(message) {
    if (!message.reactions?.length) return "";
    return `<div class="chat-reactions">${message.reactions.map(reaction => {
      const mine = reaction.users?.some(user => user.userId === currentUser?.id);
      return `<button type="button" class="reaction-chip ${mine ? "mine" : ""}" data-action="reaction" data-message-id="${escape(message.id)}" data-emoji="${escape(reaction.emoji)}" title="Right-click to see who reacted">
        <span>${escape(reaction.emoji)}</span><strong>${reaction.users?.length || 0}</strong>
      </button>`;
    }).join("")}</div>`;
  }

  function render(messages) {
    const nextSignature = signature(messages);
    if (nextSignature === lastSignature) return;
    lastSignature = nextSignature;
    currentMessages = messages;
    const nearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 100;

    messagesEl.innerHTML = messages.map(message => {
      const own = message.userId === currentUser?.id;
      const reply = message.replyTo ? `<div class="chat-reply-preview"><strong>Replying to @${escape(message.replyTo.username)}</strong> · ${escape(message.replyTo.message || "[attachment]")}</div>` : "";
      const attachments = (message.attachments || []).map(item => attachmentHtml(item, message)).join("");
      const edited = message.editedAt ? `<span class="chat-edited-note">Edited ${escape(time(message.editedAt))}</span>` : "";
      return `<article class="chat-message" data-message-id="${escape(message.id)}">
        <div class="chat-hover-actions">
          <button type="button" data-action="reply" title="Reply"><i class="fa-solid fa-reply"></i></button>
          <button type="button" data-action="react" title="Add reaction"><i class="fa-regular fa-face-smile"></i></button>
          ${own ? `<button type="button" data-action="edit" title="Edit"><i class="fa-solid fa-pencil"></i></button>` : ""}
        </div>
        <div class="chat-avatar">${avatar(message)}</div>
        <div class="chat-content">
          ${reply}
          <div class="chat-meta">
            <span class="chat-name">${escape(message.displayName)}</span>
            <span class="chat-username">@${escape(message.username)}</span>
            <time class="chat-time" datetime="${escape(message.createdAt)}">${escape(time(message.createdAt))}</time>
          </div>
          <div class="chat-text">${escape(message.message)}</div>
          ${edited}
          ${attachments ? `<div class="chat-attachments">${attachments}</div>` : ""}
          ${reactionHtml(message)}
        </div>
      </article>`;
    }).join("");

    if (nearBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function renderStickerCatalog() {
    const stickers = currentUser?.stickers || [];
    stickerCount.textContent = `${stickers.length} saved`;
    stickerEmpty.hidden = stickers.length > 0;
    stickerGrid.innerHTML = stickers.map(sticker => `
      <div class="catalog-sticker" data-sticker-id="${escape(sticker.id)}" data-url="${escape(sticker.url)}" data-name="${escape(sticker.name)}" title="${escape(sticker.name)}">
        <img src="${escape(sticker.url)}" alt="${escape(sticker.name)}" loading="lazy">
        <button type="button" class="catalog-sticker-remove" data-action="remove-saved-sticker" data-sticker-id="${escape(sticker.id)}" title="Remove sticker"><i class="fa-solid fa-xmark"></i></button>
      </div>
    `).join("");
  }

  function setReply(message) {
    replyTo = message;
    replyName.textContent = `@${message.username}`;
    replyPreview.textContent = message.message || "[attachment]";
    replyBar.hidden = false;
    input.focus();
  }

  function clearReply() {
    replyTo = null;
    replyBar.hidden = true;
    replyName.textContent = "";
    replyPreview.textContent = "";
  }

  function clearAttachment() {
    attachment = null;
    attachmentDraft.hidden = true;
    attachmentPreview.innerHTML = "";
    attachmentName.textContent = "";
    sendAsSticker.checked = false;
    mediaInput.value = "";
  }

  function showAttachment(file) {
    attachment = { file, url: "", kind: file.type === "image/gif" ? "gif" : "image", name: file.name };
    attachmentName.textContent = file.name;
    attachmentKindLabel.textContent = attachment.kind === "gif" ? "GIF" : "Image";
    const objectUrl = URL.createObjectURL(file);
    attachmentPreview.innerHTML = `<img src="${objectUrl}" alt="">`;
    attachmentDraft.hidden = false;
  }

  async function uploadFile(file, kind) {
    if (!file) return null;
    if (!["image/png","image/jpeg","image/webp","image/gif"].includes(file.type)) throw new Error("Use PNG, JPG, WEBP, or GIF images.");
    if (file.size > 8 * 1024 * 1024) throw new Error("Images must be smaller than 8 MB.");
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Could not read the image."));
      reader.readAsDataURL(file);
    });
    const result = await api("/api/chat/uploads", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({data, kind})
    });
    return result.url;
  }

  async function sendMessage() {
    if (!currentUser || sending) return;
    const text = input.value.trim();
    if (!text && !attachment) return;
    sending = true;
    input.disabled = true;

    try {
      let uploaded = null;
      if (attachment) {
        const kind = sendAsSticker.checked ? "sticker" : attachment.kind;
        uploaded = {
          url: await uploadFile(attachment.file, kind),
          kind,
          name: attachment.name
        };
      }

      await api("/api/chat/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          message:text,
          attachment:uploaded,
          replyTo:replyTo?.id || ""
        })
      });

      input.value = "";
      clearReply();
      clearAttachment();
      stickerPanel.hidden = true;
      await refresh();
      input.focus();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      sending = false;
      input.disabled = !currentUser;
    }
  }

  async function toggleReaction(messageId, emoji) {
    try {
      await api(`/api/chat/messages/${encodeURIComponent(messageId)}/reactions`, {
        method:"PATCH",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({emoji})
      });
      await refresh();
    } catch (error) {
      status.textContent = error.message;
    }
  }

  function showReactionUsers(message, emoji, anchor) {
    document.querySelectorAll(".reaction-users-popover").forEach(el => el.remove());
    const reaction = (message.reactions || []).find(item => item.emoji === emoji);
    if (!reaction) return;
    const box = document.createElement("div");
    box.className = "reaction-users-popover";
    box.innerHTML = `<h4>${escape(emoji)} ${reaction.users.length} reaction${reaction.users.length === 1 ? "" : "s"}</h4>${reaction.users.map(user => `<div>@${escape(user.username)}</div>`).join("")}`;
    anchor.closest(".chat-message").appendChild(box);
    setTimeout(() => {
      const close = event => {
        if (!box.contains(event.target) && event.target !== anchor) {
          box.remove();
          document.removeEventListener("click", close);
        }
      };
      document.addEventListener("click", close);
    }, 0);
  }

  function openReactionPicker(article) {
    const old = article.querySelector(".chat-reaction-picker");
    if (old) { old.remove(); return; }
    const picker = document.createElement("div");
    picker.className = "chat-reaction-picker";
    picker.innerHTML = reactionChoices.map(emoji => `<button type="button" data-action="picker-reaction" data-emoji="${escape(emoji)}">${escape(emoji)}</button>`).join("");
    article.appendChild(picker);
  }

  async function startEdit(message, article) {
    const textEl = article.querySelector(".chat-text");
    if (!textEl) return;
    const original = message.message || "";
    textEl.innerHTML = `<div class="chat-edit-box"><textarea maxlength="500">${escape(original)}</textarea><div class="edit-actions"><button type="button" class="edit-action edit-save" data-action="save-edit">Save</button><button type="button" class="edit-action edit-cancel" data-action="cancel-edit">Cancel</button></div></div>`;
    const textarea = textEl.querySelector("textarea");
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }

  async function saveEdit(message, article) {
    const textarea = article.querySelector("textarea");
    const value = textarea?.value.trim();
    if (!value && !(message.attachments || []).length) return;
    const save = article.querySelector("[data-action='save-edit']");
    if (save) { save.disabled = true; save.textContent = "Saving..."; }
    try {
      await api(`/api/chat/messages/${encodeURIComponent(message.id)}`, {
        method:"PATCH",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({message:value})
      });
      await refresh();
    } catch (error) {
      status.textContent = error.message;
    }
  }

  async function saveSticker(url, name) {
    if (!currentUser) { location.href = "/account"; return; }
    try {
      const data = await api("/api/stickers/save", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({url, name})
      });
      currentUser.stickers = data.stickers || [];
      renderStickerCatalog();
      status.textContent = "Sticker saved to your catalog.";
    } catch (error) {
      status.textContent = error.message;
    }
  }

  async function removeSavedSticker(id) {
    try {
      const data = await api(`/api/stickers/${encodeURIComponent(id)}`, {method:"DELETE"});
      currentUser.stickers = data.stickers || [];
      renderStickerCatalog();
    } catch (error) {
      status.textContent = error.message;
    }
  }

  async function sendSavedSticker(url, name) {
    if (!currentUser || sending) return;
    sending = true;
    input.disabled = true;
    try {
      await api("/api/chat/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({message:"", attachment:{url, kind:"sticker", name}, replyTo:replyTo?.id || ""})
      });
      clearReply();
      stickerPanel.hidden = true;
      await refresh();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      sending = false;
      input.disabled = !currentUser;
      input.focus();
    }
  }

  async function refresh() {
    try {
      const [me, chat] = await Promise.all([api("/api/auth/me"), api("/api/chat/messages?limit=100")]);
      currentUser = me.user;
      status.textContent = currentUser ? `Signed in as @${currentUser.username}` : "Read-only mode";
      accountLabel.textContent = currentUser ? "Profile" : "Log in";
      note.hidden = Boolean(currentUser);
      input.disabled = !currentUser;
      mediaButton.disabled = !currentUser;
      stickerButton.disabled = !currentUser;
      input.placeholder = currentUser ? "Write a message..." : "Log in to send a message";
      render(chat.messages || []);
      renderStickerCatalog();
    } catch (error) {
      status.textContent = error.message;
    }
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!currentUser) { location.href = "/account"; return; }
    sendMessage();
  });

  mediaButton.addEventListener("click", () => {
    if (currentUser) mediaInput.click();
  });

  mediaInput.addEventListener("change", () => {
    const file = mediaInput.files?.[0];
    if (file) showAttachment(file);
  });

  sendAsSticker.addEventListener("change", () => {
    if (!attachment) return;
    attachmentKindLabel.textContent = sendAsSticker.checked ? "Sticker" : (attachment.kind === "gif" ? "GIF" : "Image");
  });

  document.getElementById("cancel-attachment").addEventListener("click", clearAttachment);
  document.getElementById("cancel-reply").addEventListener("click", clearReply);

  stickerButton.addEventListener("click", () => {
    if (!currentUser) return;
    stickerPanel.hidden = !stickerPanel.hidden;
  });

  document.querySelector("[data-close-stickers]").addEventListener("click", () => stickerPanel.hidden = true);

  messagesEl.addEventListener("click", async event => {
    const target = event.target.closest("[data-action]");
    const article = event.target.closest(".chat-message");
    if (!target || !article) return;
    const message = currentMessages.find(item => item.id === article.dataset.messageId);
    if (!message) return;
    const action = target.dataset.action;

    if (action === "reply") return setReply(message);
    if (action === "react") return openReactionPicker(article);
    if (action === "picker-reaction") {
      article.querySelector(".chat-reaction-picker")?.remove();
      return toggleReaction(message.id, target.dataset.emoji);
    }
    if (action === "reaction") return toggleReaction(message.id, target.dataset.emoji);
    if (action === "save-sticker") {
      event.stopPropagation();
      return saveSticker(target.dataset.url, target.dataset.name);
    }
    if (action === "edit") return startEdit(message, article);
    if (action === "cancel-edit") return render(currentMessages);
    if (action === "save-edit") return saveEdit(message, article);
  });

  messagesEl.addEventListener("contextmenu", event => {
    const chip = event.target.closest(".reaction-chip");
    if (!chip) return;
    event.preventDefault();
    const article = chip.closest(".chat-message");
    const message = currentMessages.find(item => item.id === article?.dataset.messageId);
    if (message) showReactionUsers(message, chip.dataset.emoji, chip);
  });

  stickerGrid.addEventListener("click", event => {
    const remove = event.target.closest("[data-action='remove-saved-sticker']");
    if (remove) {
      event.stopPropagation();
      return removeSavedSticker(remove.dataset.stickerId);
    }
    const item = event.target.closest(".catalog-sticker");
    if (item) sendSavedSticker(item.dataset.url, item.dataset.name);
  });

  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  refresh();
  setInterval(refresh, 2500);
})();
