import { derived, get, writable } from 'svelte/store';
import type { Item, Rupiah } from '#lib/types/domain';

/**
 * A cart line. `key` uniquely identifies the row so the same service sold by
 * two different barbers stays on separate lines — that separation is what
 * makes per-barber commission correct.
 */
export interface CartLine {
	key: string;
	itemId: string;
	type: 'service' | 'product';
	name: string;
	qty: number;
	unitPrice: Rupiah;
	discount: Rupiah;
	barberId?: string;
	commissionPct?: number;
	durationMin?: number;
}

export const cartLines = writable<CartLine[]>([]);
export const cartBarberId = writable<string | null>(null);
export const cartCustomerName = writable('');
export const cartCustomerPhone = writable<string | null>(null);
export const queueDraftAppointment = writable<string | null>(null);

function lineKey(item: Item, barberId: string | null): string {
	// Retail lines never split by barber; service lines always do.
	return item.type === 'service' ? `${item.id}::${barberId ?? 'none'}` : `${item.id}::retail`;
}

function makeLine(item: Item, barberId: string | null): CartLine {
	return {
		key: lineKey(item, barberId),
		itemId: item.id,
		type: item.type,
		name: item.name,
		qty: 1,
		unitPrice: item.price,
		discount: 0,
		...(item.type === 'service'
			? {
					barberId: barberId ?? undefined,
					commissionPct: item.commissionPct ?? 0,
					durationMin: item.durationMin ?? 0
				}
			: {})
	};
}

/** Tapping an item again bumps qty rather than adding a duplicate row. */
export function addToCart(item: Item, barberId: string | null): void {
	const key = lineKey(item, barberId);
	cartLines.update((all) => {
		const existing = all.find((l) => l.key === key);
		if (existing) {
			return all.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l));
		}
		return [...all, makeLine(item, barberId)];
	});
}

export function setLineQty(key: string, qty: number): void {
	if (qty <= 0) {
		removeLine(key);
		return;
	}
	cartLines.update((all) => all.map((l) => (l.key === key ? { ...l, qty } : l)));
}

export function setLineDiscount(key: string, discount: Rupiah): void {
	cartLines.update((all) =>
		all.map((l) => (l.key === key ? { ...l, discount: Math.max(0, Math.min(discount, l.qty * l.unitPrice)) } : l))
	);
}

/**
 * Reassign a service line to a different barber. The line re-keys so the same
 * service under two barbers occupies two rows instead of collapsing.
 */
export function setLineBarber(key: string, barberId: string, commissionPct?: number): void {
	cartLines.update((all) => {
		const target = all.find((l) => l.key === key);
		if (!target) return all;

		const newKey = `${target.itemId}::${barberId}`;
		if (newKey === key) return all;

		const merged = all.find((l) => l.key === newKey);
		if (merged) {
			// Collapse into the existing barber's row.
			return all
				.filter((l) => l.key !== key)
				.map((l) => (l.key === newKey ? { ...l, qty: l.qty + target.qty } : l));
		}

		return all.map((l) =>
			l.key === key
				? { ...l, key: newKey, barberId, commissionPct: commissionPct ?? l.commissionPct }
				: l
		);
	});
}

export function removeLine(key: string): void {
	cartLines.update((all) => all.filter((l) => l.key !== key));
}

export function clearCart(): void {
	cartLines.set([]);
	cartCustomerName.set('');
	cartCustomerPhone.set(null);
	queueDraftAppointment.set(null);
}

export const cartCount = derived(cartLines, ($lines) => $lines.reduce((n, l) => n + l.qty, 0));

export const cartTotal = derived(cartLines, ($lines) =>
	$lines.reduce((sum, l) => sum + (l.qty * l.unitPrice - l.discount), 0)
);

/** Total chair time for the cart — drives the expected finish time. */
export const cartDuration = derived(cartLines, ($lines) =>
	$lines.reduce((sum, l) => sum + (l.type === 'service' ? l.qty * (l.durationMin ?? 0) : 0), 0)
);

export const cartHasServices = derived(cartLines, ($lines) => $lines.some((l) => l.type === 'service'));

export const cartLinesWithTotal = derived(cartLines, ($lines) =>
	$lines.map((l) => ({ ...l, lineTotal: l.qty * l.unitPrice - l.discount }))
);

/** Seed the cart from a queue appointment so checkout is one tap from the board. */
export function loadFromAppointment(
	items: Item[],
	barberId: string,
	customerName: string,
	customerPhone: string | null,
	appointmentId: string | null
): void {
	cartLines.set(items.map((item) => makeLine(item, barberId)));
	cartBarberId.set(barberId);
	cartCustomerName.set(customerName);
	cartCustomerPhone.set(customerPhone);
	queueDraftAppointment.set(appointmentId);
}

export function cartSnapshot(): CartLine[] {
	return get(cartLines);
}