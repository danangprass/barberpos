import { writable } from 'svelte/store';
import { readAll, putOne, removeOne } from '#lib/data/mock/db';
import type { PendingSale } from '#lib/data/repository';
import { buildProvisionalReceiptNo } from '#lib/utils/receipt';
import { uid } from '#lib/utils/format';

/**
 * The device-local outbox.
 *
 * Sales taken while offline live here until the server accepts them. This is
 * deliberately client-side and backend-agnostic: the mock and Firebase
 * backends share it, and it never leaves the browser.
 */
export interface QueuedSale extends PendingSale {
	queuedAt: string;
	attempts: number;
	lastError: string | null;
	/** Receipt number minted locally; replaced by the server's on sync. */
	provisionalReceiptNo: string;
}

export const queuedSales = writable<QueuedSale[]>([]);

export async function refreshQueue(): Promise<void> {
	queuedSales.set(await readAll<QueuedSale>('outbox'));
}

export async function enqueueSale(sale: PendingSale, provisionalReceiptNo: string): Promise<void> {
	const entry: QueuedSale = {
		...sale,
		queuedAt: new Date().toISOString(),
		attempts: 0,
		lastError: null,
		provisionalReceiptNo
	};
	await putOne('outbox', entry, entry.clientId);
	await refreshQueue();
}

export async function dequeueSale(clientId: string): Promise<void> {
	await removeOne('outbox', clientId);
	await refreshQueue();
}

export async function clearQueue(): Promise<void> {
	for (const entry of await readAll<QueuedSale>('outbox')) {
		await removeOne('outbox', entry.clientId);
	}
	await refreshQueue();
}

export async function markQueueError(clientId: string, error: string): Promise<void> {
	const entry = (await readAll<QueuedSale>('outbox')).find((e) => e.clientId === clientId);
	if (!entry) return;
	await putOne('outbox', { ...entry, attempts: entry.attempts + 1, lastError: error }, clientId);
	await refreshQueue();
}

/** Monotonic per-device counter so provisional receipt numbers never collide. */
export function nextProvisionalReceiptNo(deviceId: string): string {
	if (typeof localStorage === 'undefined') return buildProvisionalReceiptNo(deviceId, 1);
	const key = 'pos.offlineSeq';
	const next = Number(localStorage.getItem(key) ?? '0') + 1;
	localStorage.setItem(key, String(next));
	return buildProvisionalReceiptNo(deviceId, next);
}

export function newClientId(): string {
	return uid('c-');
}
