// A POS is an installable offline-first single-page app: every data source is
// IndexedDB or a browser API, so SSR would have nothing to render and would
// only add a hydration surface.
export const ssr = false;
export const prerender = false;