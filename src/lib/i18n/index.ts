import { derived, writable } from 'svelte/store';
import { isBrowser } from '#lib/utils/env';
import { dictionaries, type Locale, type MessageKey } from './messages';

const STORAGE_KEY = 'pos.locale';

/** Default to Indonesian; the shop floor is Indonesian-speaking. */
function initialLocale(): Locale {
	if (!isBrowser) return 'id';
	const stored = localStorage.getItem(STORAGE_KEY);
	return stored === 'en' ? 'en' : 'id';
}

export const locale = writable<Locale>(initialLocale());

locale.subscribe((value) => {
	if (isBrowser) localStorage.setItem(STORAGE_KEY, value);
});

/** BCP-47 tag used for Intl formatting so dates/numbers match the UI language. */
export const intlLocale = derived(locale, ($locale) => ($locale === 'id' ? 'id-ID' : 'en-GB'));

export function translate(l: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
	let text: string = dictionaries[l][key] ?? dictionaries.id[key] ?? key;
	if (vars) {
		for (const [name, value] of Object.entries(vars)) {
			text = text.replaceAll(`{${name}}`, String(value));
		}
	}
	return text;
}

/** Reactive translator — reads `$locale` from the calling component's scope. */
export const t = derived(locale, ($locale) => {
	return (key: MessageKey, vars?: Record<string, string | number>) =>
		translate($locale, key, vars);
});