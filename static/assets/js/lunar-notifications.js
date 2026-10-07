(() => {
  const path = () => (location.pathname.replace(/\/$/, "") || "/");
  let me = null;
  let lastChatMessageId = "";
  let initializedChatRead = false;
  let pollTimer = null;

  const esc = value => {
    const d = document.createElement("div");
    d.textContent = value ?? "";
    return d.innerHTML;
  };

  function isNewUI() {
    return document.body?.classList.contains("lunar-site-new-ui") || Boolean(document.querySelector(".lunar-sidebar"));
  }

  function findLinks() {
    return [...document.querySelectorAll(".navbar-link")];
  }

  function addNotificationUi() {
    const nav = document.querySelector(".nav-bar");
    if (!nav) return;

    const links = findLinks();
    const friends = links.find(link => /\/friends\/?$/.test(link.getAttribute("href") || ""));
    const chat = links.find(link => /\/chat\/?$/.test(link.getAttribute("href") || ""));
    if (!friends || !chat) return;

    let friendNotify = nav.querySelector(".lunar-friend-notification");
    if (!friendNotify) {
      friendNotify = document.createElement("a");
      friendNotify.className = "lunar-friend-notification";
      friendNotify.href = "/friends";
      friendNotify.setAttribute("aria-label", "Friends notifications");
      friendNotify.innerHTML = '<i class="fa-regular fa-bell"></i><span class="lunar-notification-dot"></span>';
    }

    if (isNewUI()) {
      friendNotify.classList.add("is-new-ui");
      friendNotify.classList.remove("is-old-ui");
      if (friends.nextElementSibling !== friendNotify) friends.after(friendNotify);
    } else {
      friendNotify.classList.add("is-old-ui");
      friendNotify.classList.remove("is-new-ui");
      if (friends.previousElementSibling !== friendNotify) friends.before(friendNotify);
    }

    let chatDot = chat.querySelector(".lunar-chat-notification-dot");
    if (!chatDot) {
      chatDot = document.createElement("span");
      chatDot.className = "lunar-chat-notification-dot";
      chatDot.setAttribute("aria-hidden", "true");
      chat.appendChild(chatDot);
    }
  }

  function setFriendUnread(hasUnread) {
    const button = document.querySelector(".lunar-friend-notification");
    if (!button) return;
    button.classList.toggle("has-unread", Boolean(hasUnread));
    button.setAttribute("aria-label", hasUnread ? "New friend message or request" : "Friends notifications");
  }

  function setChatUnread(hasUnread) {
    document.querySelectorAll(".lunar-chat-notification-dot").forEach(dot => dot.classList.toggle("has-unread", Boolean(hasUnread)));
    document.querySelectorAll('.lunar-nav-chat').forEach(link => link.classList.toggle("has-unread", Boolean(hasUnread)));
  }

  function readChatState() {
    try {
      return localStorage.getItem("lunar-chat-last-read") || "";
    } catch {
      return "";
    }
  }

  function writeChatState(value) {
    try { localStorage.setItem("lunar-chat-last-read", value || ""); } catch {}
  }

  async function poll() {
    addNotificationUi();
    try {
      const auth = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
      const authData = auth.ok ? await auth.json() : null;
      me = authData?.user || null;
      if (!me) {
        setFriendUnread(false);
        setChatUnread(false);
        return;
      }

      const [friendsResponse, chatResponse] = await Promise.all([
        fetch("/api/friends/bootstrap", { credentials: "same-origin", cache: "no-store" }),
        fetch("/api/chat/messages?limit=1", { credentials: "same-origin", cache: "no-store" })
      ]);

      const friendsData = friendsResponse.ok ? await friendsResponse.json() : null;
      const chatData = chatResponse.ok ? await chatResponse.json() : null;

      setFriendUnread(Number(friendsData?.unreadCount || 0) > 0);

      const latest = Array.isArray(chatData?.messages) ? chatData.messages[chatData.messages.length - 1] : null;
      if (latest?.id) {
        const lastRead = readChatState();
        if (!initializedChatRead) {
          lastChatMessageId = lastRead;
          initializedChatRead = true;
          if (!lastRead && path() === "/chat") {
            writeChatState(latest.createdAt || latest.id);
          }
        }
        const latestIsOwn = latest.userId === me.id;
        const latestReadAt = lastRead || "";
        const latestKey = latest.createdAt || latest.id;
        const unread = Boolean(lastRead && latestKey > latestReadAt && !latestIsOwn);
        setChatUnread(unread);
        lastChatMessageId = latestKey;

        if (path() === "/chat") {
          writeChatState(latestKey);
          setChatUnread(false);
        }
      }
    } catch {}
  }

  function start() {
    addNotificationUi();
    poll();
    clearInterval(pollTimer);
    pollTimer = setInterval(poll, 5000);
    const observer = new MutationObserver(() => addNotificationUi());
    observer.observe(document.querySelector(".nav-bar") || document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 10000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
