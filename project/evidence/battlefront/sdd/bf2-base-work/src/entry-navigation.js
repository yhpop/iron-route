import {getOptionalMission} from './content/optional-records.js';

/** Synchronize an explicit entry choice without navigation or unrelated query normalization. */
export function syncEntryUrl(location, history, slug, resolveOptional = getOptionalMission) {
  try {
    if (slug !== null && (typeof slug !== 'string' || !resolveOptional(slug))) return false;
    const current = new URL(location.href), href = current.href;
    const hashIndex = href.indexOf('#'), hash = hashIndex < 0 ? '' : href.slice(hashIndex);
    const beforeHash = hashIndex < 0 ? href : href.slice(0, hashIndex);
    const queryIndex = beforeHash.indexOf('?');
    // Decode only the raw key: a literal leading ? belongs to that key, not a new query.
    const segments = queryIndex < 0 ? [] : beforeHash.slice(queryIndex + 1).split('&');
    const retained = segments.filter(segment => {
      const rawKey = segment.split('=', 1)[0];
      try { return decodeURIComponent(rawKey.replace(/\+/g, ' ')) !== 'sortie'; }
      catch { return true; } // Malformed keys are unrelated and must remain byte-exact.
    });
    if (slug !== null) retained.push(`sortie=${slug}`);
    const search = retained.length ? `?${retained.join('&')}` : '';
    const prefix = queryIndex < 0 ? beforeHash : beforeHash.slice(0, queryIndex);
    const next = prefix + search + hash;
    if (next === href) return true;
    if (typeof history?.replaceState !== 'function') return false;
    // An absolute same-origin URL also preserves pathnames beginning with //.
    history.replaceState(history.state, '', next);
    return true;
  } catch {
    return false;
  }
}
