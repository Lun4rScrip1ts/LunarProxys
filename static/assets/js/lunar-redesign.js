(() => {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  if (path === '/spotify' || path === '/spotify.html') return;

  const start = () => {
    const useNewUI = store.get("homeUI") !== "old";

    // Old UI is intentionally the original site-wide interface. Do not inject
    // any of the refined redesign CSS/navigation when Old UI is selected.
    if (!useNewUI) {
      document.body?.classList.add("lunar-site-old-ui");
      return;
    }
    document.body?.classList.add("lunar-site-new-ui");

    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = '/assets/css/lunar-redesign.css?v=figma4';
    document.head.appendChild(style);

    const fixesStyle = document.createElement('link');
    fixesStyle.rel = 'stylesheet';
    fixesStyle.href = '/assets/css/lunar-redesign-fixes.css?v=fix5';
    document.head.appendChild(fixesStyle);

  const loadPresenceHeartbeat = () => {
    if (document.querySelector('script[data-lunar-presence-heartbeat]')) return;
    const script = document.createElement('script');
    script.src = '/assets/js/lunar-presence-heartbeat.js?v=presence3';
    script.dataset.lunarPresenceHeartbeat = 'true';
    script.defer = false;
    document.body.appendChild(script);
  };

  const loadChatFixes = () => {
    if (path !== '/chat' && path !== '/chat.html' && path !== '/friends' && path !== '/friends.html') return;
    const script = document.createElement('script');
    script.src = '/assets/js/lunar-chat-fixes.js?v=fix2';
    script.defer = false;
    document.body.appendChild(script);
  };

  const buildNav = () => {
    const nav = document.querySelector('.nav-bar');
    if (!nav) return;
    const links = [
      ['/','fa-house','Home'],
      ['/friends','fa-user-group','Friends'],
      ['/chat','fa-comments','Chat'],
      ['/apps','fa-table-cells','Apps'],
      ['/games','fa-gamepad','Games'],
      ['/spotify','fa-spotify','Spotify'],
      ['/settings','fa-gear','Settings']
    ];
    const normalize = p => p.replace(/\/$/, '') || '/';
    const current = normalize(window.location.pathname);
    nav.innerHTML = `
      <aside class="lunar-sidebar">
        <a class="lunar-sidebar-brand" href="/" aria-label="LunarProxys">LS</a>
        ${links.map(([href, icon, label]) => `<a class="lunar-side-link navbar-link lunar-nav-${label.toLowerCase()}" href="${href}"><i class="${icon === 'fa-spotify' ? 'fa-brands' : 'fa-solid'} ${icon}"></i><span>${label}</span></a>`).join('')}
        <div class="lunar-side-spacer"></div>
        <a class="lunar-side-link lunar-account-mini navbar-link lunar-account-nav" href="/account"><span>A</span></a>
      </aside>
      <header class="lunar-topbar">
        <div class="lunar-top-brand"><strong>LUNARPROXYS</strong><span>Secure • Social • Fast</span></div>
        <div class="lunar-top-spacer"></div>
        <span class="lunar-top-search" aria-hidden="true">⌕</span>
        <span class="lunar-online"><i class="fa-solid fa-circle"></i><span>Online</span></span>
        <a class="lunar-account-nav navbar-link" href="/account"><span>Account</span></a>
      </header>`;

    nav.querySelectorAll('.navbar-link').forEach(link => {
      const href = normalize(new URL(link.href, window.location.origin).pathname);
      const active = href === current || (current === '/play.html' && href === '/games') || (current.startsWith('/profile') && href === '/account');
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
    });

    fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.user) return;
        const labels = nav.querySelectorAll('.lunar-account-nav span');
        if (labels[0]) labels[0].textContent = String(data.user.displayName || data.user.username || 'A').slice(0, 1).toUpperCase();
        if (labels[1]) labels[1].textContent = 'Profile';
      }).catch(() => {});
  };

    buildNav();
    loadPresenceHeartbeat();
    loadChatFixes();
  };

  const boot = async () => {
    // Account settings are authoritative, so the Old/New mode remains
    // consistent after switching accounts or opening the site elsewhere.
    if (typeof store.loadAccountSettings === "function") {
      try { await store.loadAccountSettings(); } catch {}
    }
    start();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
