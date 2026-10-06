(() => {
  if (window.location.pathname !== '/chat' && window.location.pathname !== '/chat.html' && window.location.pathname !== '/friends' && window.location.pathname !== '/friends.html') return;

  const compressImage = file => new Promise(resolve => {
    if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type) || file.size <= 2 * 1024 * 1024) return resolve(file);
    const reader = new FileReader();
    reader.onerror = () => resolve(file);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(file);
      img.onload = () => {
        const max = 2000;
        const scale = Math.min(1, max / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
        canvas.height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return resolve(file);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (!blob || blob.size >= file.size) return resolve(file);
          const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
          const base = (file.name || 'image').replace(/\.[^.]+$/, '');
          resolve(new File([blob], `${base}.${ext}`, { type: blob.type || file.type, lastModified: Date.now() }));
        }, file.type === 'image/png' ? 'image/png' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg', .84);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  const install = () => {
    const input = document.getElementById('chat-image-file');
    if (!input || input.dataset.lunarFixInstalled) return;
    input.dataset.lunarFixInstalled = '1';

    // Capture phase runs before community.js's normal change handler, so large images
    // are reduced before the existing attachmentDraft is created.
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      const smaller = await compressImage(file);
      if (smaller === file) return;
      try {
        const dt = new DataTransfer();
        dt.items.add(smaller);
        input.files = dt.files;
      } catch (_) {}
    }, true);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
