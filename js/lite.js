// Low-bandwidth ("lite") mode. One decision, made once at page load, shared by
// every module that picks an asset tier:
//
//   solarSystem.js  → ~5 MB planet texture set instead of the ~70 MB 8K set
//   skyMedia.js     → 4K all-sky plate instead of 8K, never probes video
//   app.js          → lower pixel ratio, no bloom pass
//
// Enabled by ?lite=1, a saved preference from the explorer settings panel, or
// automatically when the browser reports Data Saver or a 2G–3G connection.
// ?lite=0 always wins so a teacher can force full quality on a lab machine.

export const LITE_STORAGE_KEY = 'solaris-lite';

export const LITE_MODE = (() => {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has('lite')) return params.get('lite') !== '0';
    const saved = window.localStorage.getItem(LITE_STORAGE_KEY);
    if (saved === '1') return true;
    if (saved === '0') return false;
    const connection = navigator.connection;
    if (connection?.saveData) return true;
    if (/(^|-)2g$|^3g$/.test(connection?.effectiveType || '')) return true;
  } catch { /* privacy modes may block storage */ }
  return false;
})();

/** Persist the preference and reload so every asset tier is re-chosen. */
export function setLitePreference(on) {
  try { window.localStorage.setItem(LITE_STORAGE_KEY, on ? '1' : '0'); } catch { /* ignore */ }
  const url = new URL(window.location.href);
  url.searchParams.set('lite', on ? '1' : '0');
  window.location.replace(url.toString());
}
