(function attachYouTubeUrl(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BlooDyYouTubeUrl = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createYouTubeUrl() {
  'use strict';

  function getVideoId(value) {
    try {
      const url = new URL(value.trim());
      if (!['https:', 'http:'].includes(url.protocol)) return null;
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      let id = null;
      if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0];
      else if (['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)) {
        if (url.pathname === '/watch') id = url.searchParams.get('v');
        else id = url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?]+)/)?.[1] || null;
      }
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    } catch (_) { return null; }
  }

  return Object.freeze({getVideoId});
});
