/**
 * Environment probe.
 *
 * The whole app runs with `ssr = false` (see `src/routes/+layout.ts`), so every
 * module here is browser-only in practice. Using a direct check instead of
 * SvelteKit's `$app/environment` keeps this independent of framework alias
 * churn and keeps the guards honest under unit tests or prerendering.
 */
export const isBrowser: boolean = typeof window !== 'undefined';