import { derived, writable } from 'svelte/store';
import { isBrowser } from '#lib/utils/env';

const DEVICE_KEY = 'pos.deviceId';
const OFFLINE_KEY = 'pos.forceOffline';

/**
 * Connectivity state.
 *
 * Kept in its own module so the sale domain and the sync store can both use it
 * without importing each other.
 */

/** Stable per-browser identifier used to mint provisional receipt numbers. */
export function deviceId(): string {
	if (!isBrowser) return 'SERVER';
	let id = localStorage.getItem(DEVICE_KEY);
	if (!id) {
		id = Math.random().toString(36).slice(2, 8).toUpperCase();
		localStorage.setItem(DEVICE_KEY, id);
	}
	return id;
}

export const browserOnline = writable(true);
export const forceOffline = writable(false);

/**
 * Demo affordance: lets you prove the offline path without pulling the network
 * cable. Real deployments just use `browserOnline`.
 */
export const online = derived([browserOnline, forceOffline], ([$net, $forced]) => $net && !$forced);

if (isBrowser) {
	browserOnline.set(navigator.onLine);
	window.addEventListener('online', () => browserOnline.set(true));
	window.addEventListener('offline', () => browserOnline.set(false));
	forceOffline.set(localStorage.getItem(OFFLINE_KEY) === '1');
	forceOffline.subscribe((v) => localStorage.setItem(OFFLINE_KEY, v ? '1' : '0'));
}
