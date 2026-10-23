import { get } from 'svelte/store';
import { repo } from '#lib/data/index';
import type { CommitInput, PendingSale } from '#lib/data/repository';
import {
	dequeueSale,
	enqueueSale,
	markQueueError,
	newClientId,
	nextProvisionalReceiptNo,
	refreshQueue
} from '#lib/data/local/outbox';
import { online, deviceId } from '#lib/stores/connectivity.svelte';
import type { CartLine } from '#lib/stores/cart.svelte';
import type { Payment, Sale, SaleLine } from '#lib/types/domain';
import { commissionAmount } from '#lib/utils/receipt';

export interface CheckoutInput {
	branchId: string;
	cashierId: string;
	customerName: string;
	customerPhone: string | null;
	lines: CartLine[];
	payment: Payment;
	appointmentId?: string | null;
}

function toCommitLines(lines: CartLine[]) {
	return lines.map((l) => ({
		itemId: l.itemId,
		type: l.type,
		name: l.name,
		qty: l.qty,
		unitPrice: l.unitPrice,
		discount: l.discount,
		barberId: l.barberId,
		commissionPct: l.commissionPct,
		durationMin: l.durationMin
	}));
}

/**
 * Commit a sale.
 *
 * Online  → the backend writes it to Firestore, where the security rules check
 *            every price, the total and the receipt number.
 * Offline → the sale is queued locally with a provisional receipt number, and
 *            the cashier still gets a printable receipt.
 */
export async function commitSale(input: CheckoutInput): Promise<Sale> {
	const clientId = newClientId();
	const soldAt = new Date().toISOString();

	const pending: PendingSale = {
		clientId,
		branchId: input.branchId,
		cashierId: input.cashierId,
		customerName: input.customerName,
		customerPhone: input.customerPhone,
		lines: toCommitLines(input.lines),
		payment: input.payment,
		soldAt,
		appointmentId: input.appointmentId ?? null
	};

	if (!get(online)) {
		const provisionalReceiptNo = nextProvisionalReceiptNo(deviceId());
		await enqueueSale(pending, provisionalReceiptNo);
		return provisionalSale(pending, provisionalReceiptNo);
	}

	const commit: CommitInput = { ...pending };
	return repo.commitSale(commit);
}

/**
 * A locally-built sale used for printing while the real one is still queued.
 * Totals are computed the same way the rules will check them.
 */
function provisionalSale(pending: PendingSale, provisionalReceiptNo: string): Sale {
	const lines: SaleLine[] = pending.lines.map((l) => {
		const lineTotal = l.qty * l.unitPrice - l.discount;
		return {
			itemId: l.itemId,
			type: l.type,
			name: l.name,
			qty: l.qty,
			unitPrice: l.unitPrice,
			discount: l.discount,
			lineTotal,
			...(l.type === 'service'
				? {
						barberId: l.barberId,
						commissionPct: l.commissionPct ?? 0,
						commissionAmount: commissionAmount(lineTotal, l.commissionPct ?? 0),
						durationMin: l.durationMin ?? 0
					}
				: {})
		};
	});

	const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);

	return {
		id: pending.clientId,
		clientId: pending.clientId,
		receiptNo: provisionalReceiptNo,
		provisionalReceiptNo,
		// The real day and sequence are assigned when the queued sale lands.
		receiptDay: 0,
		receiptSeq: 0,
		branchId: pending.branchId,
		cashierId: pending.cashierId,
		soldAt: pending.soldAt,
		customerName: pending.customerName,
		customerPhone: pending.customerPhone,
		customerId: null,
		lines,
		subtotal,
		discount: lines.reduce((sum, l) => sum + l.discount, 0),
		total: subtotal,
		payment: pending.payment,
		syncState: 'pending_sync',
		stockShortfall: false
	};
}

/**
 * Drain the outbox.
 *
 * Idempotent by construction: each entry carries the `clientId` minted at
 * checkout, so a retry after a partial failure cannot create a duplicate sale.
 */
export async function syncPendingSales(): Promise<number> {
	const { queuedSales } = await import('#lib/data/local/outbox');
	const pending = get(queuedSales);
	if (pending.length === 0) return 0;

	let synced = 0;
	for (const entry of pending) {
		try {
			const results = await repo.syncPendingSales([entry]);
			for (const { clientId, sale } of results) {
				await dequeueSale(clientId);
				void sale;
			}
			synced += 1;
		} catch (error) {
			await markQueueError(
				entry.clientId,
				error instanceof Error ? error.message : String(error)
			);
		}
	}

	await refreshQueue();
	return synced;
}

/** Record a stock count from the catalog screen. */
export async function recordStockCount(
	itemId: string,
	branchId: string,
	newStock: number,
	actorId: string
): Promise<void> {
	const all = await repo.listItems();
	const item = all.find((i) => i.id === itemId);
	if (!item || item.type !== 'product') return;

	await repo.saveItem({ ...item, stock: Math.max(0, newStock) });
}
