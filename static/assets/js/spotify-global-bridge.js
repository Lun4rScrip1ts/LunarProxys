(() => {
  const parse = raw => { try { const u = new URL(String(raw).trim(), location.origin); const p=u.pathname.split('/').filter(Boolean); return p.length===2 && ['track','album','playlist','artist','show','episode'].includes(p[0]) ? {type:p[0],id:p[1]} : null; } catch { return null; } };
  const image = t => t?.images?.[0]?.url || t?.album?.images?.[0]?.url || '';
  const artists = t => Array.isArray(t?.artists) ? t.artists.map(a => a.name || a).join(', ') : (t?.artists || '');
  const play = (type,id,label,track=null) => {
    if (typeof window.lunarSpotifyPlayTrack === 'function') {
      const item = track || {id,name:label || 'Spotify',uri:`spotify:${type}:${id}`,artists:'',album:'',image:image(track),duration_ms:track?.duration_ms||0};
      window.lunarSpotifyPlayTrack(item,[item],0);
      return true;
    }
    return false;
  };
  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-play-type][data-play-id]');
    if (!button) return;
    const id=button.dataset.playId, type=button.dataset.playType, label=button.dataset.playLabel || 'Spotify';
    const card=button.closest('[data-track-id]');
    const track=card && window.__lunarSpotifySearchTracks?.find(t => t.id === id);
    if (play(type,id,label,track)) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  document.addEventListener('click', event => {
    const preset=event.target.closest?.('.spotify-preset[data-spotify]');
    if (!preset) return;
    const parsed=parse(preset.dataset.spotify);
    if (parsed && parsed.type==='track' && play(parsed.type,parsed.id,preset.dataset.label||'Spotify')) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
})();
