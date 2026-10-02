(() => {
  const player = document.getElementById('spotify-floating-player');
  const handle = document.getElementById('spotify-drag-handle');
  if (!player || !handle) return;

  const POSITION_KEY = 'lunarSpotifyPlayerPosition';
  let drag = null;
  let frame = 0;
  let pendingX = 0;
  let pendingY = 0;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  function savePosition() {
    if (player.hidden) return;
    const rect = player.getBoundingClientRect();
    localStorage.setItem(POSITION_KEY, JSON.stringify({ x: Math.round(rect.left), y: Math.round(rect.top) }));
  }

  function applyPosition(x, y) {
    const width = player.offsetWidth || 360;
    const height = player.offsetHeight || 240;
    const maxX = Math.max(8, window.innerWidth - width - 8);
    const maxY = Math.max(8, window.innerHeight - height - 8);
    player.style.left = `${clamp(x, 8, maxX)}px`;
    player.style.top = `${clamp(y, 8, maxY)}px`;
    player.style.right = 'auto';
    player.style.bottom = 'auto';
  }

  function restorePosition() {
    try {
      const saved = JSON.parse(localStorage.getItem(POSITION_KEY) || 'null');
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) applyPosition(saved.x, saved.y);
    } catch {}
  }

  function scheduleMove(x, y) {
    pendingX = x;
    pendingY = y;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (drag) applyPosition(pendingX - drag.offsetX, pendingY - drag.offsetY);
    });
  }

  function stopDrag(event) {
    if (!drag) return;
    try { handle.releasePointerCapture(drag.pointerId); } catch {}
    drag = null;
    handle.classList.remove('is-dragging');
    savePosition();
    if (event) event.preventDefault();
  }

  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('button')) return;
    const rect = player.getBoundingClientRect();
    drag = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    handle.classList.add('is-dragging');
    try { handle.setPointerCapture(event.pointerId); } catch {}
    event.preventDefault();
  });

  handle.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    scheduleMove(event.clientX, event.clientY);
    event.preventDefault();
  });

  handle.addEventListener('pointerup', stopDrag);
  handle.addEventListener('pointercancel', stopDrag);
  handle.addEventListener('lostpointercapture', () => { if (drag) stopDrag(); });

  window.addEventListener('resize', () => {
    if (!player.hidden) {
      const rect = player.getBoundingClientRect();
      applyPosition(rect.left, rect.top);
      savePosition();
    }
  });

  const observer = new MutationObserver(() => {
    if (!player.hidden) restorePosition();
  });
  observer.observe(player, { attributes: true, attributeFilter: ['hidden'] });

  restorePosition();
})();
