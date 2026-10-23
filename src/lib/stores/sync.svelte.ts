import { derived, get, writable } from 'svelte/store';
import { queuedSales, refreshQueue } from '#lib/data/local/outbox';
import { commitSale as commitSaleToBackend, syncPendingSales as drainSales } from '#lib/domain/sales';
import { online } from '#lib/stores/connectivity.svelte';
import type { Payment } from '#lib/types/domain';
import type { CartLine } from './cart.svelte';

export const syncing = writable(false);
export const lastSyncAt = writable<string | null>(null);

/** Sales still waiting for the server. */
export const pendingCount = derived(queuedSales, ($sales) => $sales.length);

/**
 * Drain the outbox.
 *
 * Idempotent by construction: each entry is keyed by the clientId minted at
 * checkout, so a retry after a partial failure cannot create a duplicate sale.
 */
export async function drainOutbox(): Promise<number> {
	if (get(syncing)) return 0;
	if (!get(online)) return 0;

	syncing.set(true);
	try {
		const synced = await drainSales();
		if (synced > 0) {
			await refreshQueue();
			lastSyncAt.set(new Date().toISOString());
		}
		return synced;
	} finally {
		syncing.set(false);
	}
}

export interface CommitInput {
	branchId: string;
	cashierId: string;
	customerName: string;
	customerPhone: string | null;
	lines: CartLine[];
	payment: Payment;
	appointmentId?: string | null;
}

/** Entry point used by the checkout dialog. */
export async function checkout(input: CommitInput) {
	const sale = await commitSaleToBackend(input);
	if (get(online)) {
		await drainOutbox();
	}
	return sale;
}

export { online, forceOffline, browserOnline, deviceId } from './connectivity.svelte';
export { queuedSales };
