/**
 * Core domain model.
 *
 * These types are transport-agnostic on purpose: the mock repository and the
 * future Firebase repository both speak exactly this shape, so swapping the
 * backing store never touches UI code.
 */

/** Rupiah is handled as whole integers throughout — no cents anywhere. */
export type Rupiah = number;

export type Role = 'owner' | 'manager' | 'barber';

export interface Branch {
	id: string;
	name: string;
	address: string;
	phone: string;
	/** Short code used in receipt numbers, e.g. `SDM`. */
	code: string;
	active: boolean;
}

export interface Staff {
	id: string;
	displayName: string;
	role: Role;
	branchIds: string[];
	phone: string;
	/**
	 * Hex-encoded SHA-256 of the PIN plus per-staff salt.
	 *
	 * Absent when the staff record comes from a remote backend — the secret
	 * half of the credential never leaves the server in that case.
	 */
	pinHash?: string;
	pinSalt?: string;
	active: boolean;
}

export interface Barber {
	id: string;
	staffId: string;
	displayName: string;
	active: boolean;
}

export type ItemType = 'service' | 'product';

export interface Category {
	id: string;
	name: string;
	kind: ItemType;
	sortOrder: number;
}

/**
 * One collection for both services and retail products.
 * `type` is the discriminator; the optional fields only exist for their kind.
 */
export interface Item {
	id: string;
	type: ItemType;
	name: string;
	categoryId: string | null;
	price: Rupiah;
	active: boolean;

	// --- service only ---
	durationMin?: number;
	/** Default commission rate, e.g. 40 for 40%. Overridable per sale line. */
	commissionPct?: number;

	// --- product only ---
	sku?: string;
	barcode?: string;
	costPrice?: Rupiah;
	stock?: number;
	lowStockThreshold?: number;
}

export interface Customer {
	id: string;
	name: string;
	phone: string | null;
	notes: string;
	visitCount: number;
	totalSpent: Rupiah;
	lastVisitAt: string | null;
	createdAt: string;
}

export type AppointmentStatus =
	| 'booked'
	| 'arrived'
	| 'queued'
	| 'in_service'
	| 'done'
	| 'cancelled'
	| 'no_show';

export interface Appointment {
	id: string;
	branchId: string;
	customerName: string;
	customerPhone: string | null;
	barberId: string;
	serviceIds: string[];
	scheduledAt: string;
	durationMin: number;
	status: AppointmentStatus;
	notes: string;
	createdBy: string;
	createdAt: string;
}

export type PaymentMethod = 'cash' | 'qris';

export interface Payment {
	method: PaymentMethod;
	amountTendered: Rupiah;
	change: Rupiah;
	/** Manual QRIS transfer reference, transcribed by the cashier. */
	qrisRef: string | null;
}

export interface SaleLine {
	itemId: string;
	type: ItemType;
	name: string;
	qty: number;
	unitPrice: Rupiah;
	discount: Rupiah;
	lineTotal: Rupiah;

	// service attribution — what makes barber earnings computable
	barberId?: string;
	commissionPct?: number;
	commissionAmount?: Rupiah;
	durationMin?: number;
}

export type SaleSyncState = 'synced' | 'pending_sync';

/**
 * Sales are append-only. A `pending_sync` sale was taken while offline and
 * carries a provisional local receipt number until the server assigns the real
 * one; `provisionalReceiptNo` is kept so the reprint can explain the difference.
 */
export interface Sale {
	id: string;
	clientId: string;
	receiptNo: string;
	provisionalReceiptNo: string | null;
	/**
	 * Business day of the sale as `yyyymmdd`, and the sequence number within
	 * that day. Both are stored so the security rules can check the receipt
	 * number against the branch's counter.
	 */
	receiptDay: number;
	receiptSeq: number;
	branchId: string;
	cashierId: string;
	soldAt: string;
	customerName: string;
	customerPhone: string | null;
	customerId: string | null;
	lines: SaleLine[];
	subtotal: Rupiah;
	discount: Rupiah;
	total: Rupiah;
	payment: Payment;
	syncState: SaleSyncState;
	/** Set when stock could not cover the sale — surfaces in the discrepancy log. */
	stockShortfall: boolean;
}

export type StockMovementType = 'sale' | 'count' | 'adjust';

export interface StockMovement {
	id: string;
	branchId: string;
	itemId: string;
	qtyDelta: number;
	type: StockMovementType;
	refId: string | null;
	actorId: string;
	note: string;
	createdAt: string;
}

export interface BranchSettings {
	branchId: string;
	receiptHeader: string;
	receiptFooter: string;
	lowStockDefault: number;
}

/** A sale sitting in the local outbox, waiting for connectivity. */
export interface OutboxEntry {
	clientId: string;
	queuedAt: string;
	attempts: number;
	lastError: string | null;
}