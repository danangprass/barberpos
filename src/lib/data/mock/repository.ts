import type {
	Appointment,
	AppointmentStatus,
	Barber,
	Branch,
	BranchSettings,
	Category,
	Customer,
	Item,
	OutboxEntry,
	Payment,
	Sale,
	Staff,
	StockMovement
} from '#lib/types/domain';
import { AuthError } from '../repository';
import type {
	AuthProfile,
	BackendStatus,
	CommitInput,
	DirectoryEntry,
	PendingSale,
	PosRepository
} from '../repository';
import { readAll, readOne, putMany, putOne, removeOne, wipeAll } from './db';
import { buildSeed } from './seed';
import { BRANCH_CODES } from '#shared/sample-data';
import { commissionAmount, buildProvisionalReceiptNo, buildReceiptNo } from '#lib/utils/receipt';
import { businessDayStamp } from '#shared/time';
import { verifyPin, generateSalt, hashPin } from '#lib/utils/pin';
import { uid, dayKey } from '#lib/utils/format';
import { isBrowser } from '#lib/utils/env';

const SESSION_KEY = 'pos.session';

const SEEDED_KEY = 'seeded:v1';

/**
 * IndexedDB-backed repository.
 *
 * Reads mirror what Firestore would return for the same query, and the sale
 * commit path mirrors the Cloud Function: the catalog is re-priced server-side
 * (here: "server-side" is this module, not the browser), the receipt number is
 * assigned centrally, and stock only moves at commit time.
 */
export class MockRepository implements PosRepository {
	async init(): Promise<void> {
		const seeded = await readOne<boolean>('meta', SEEDED_KEY);
		if (seeded) return;

		const seed = await buildSeed();
		await putMany('branches', seed.branches, (b) => b.id);
		await putMany('staff', seed.staff, (s) => s.id);
		await putMany('barbers', seed.barbers, (b) => b.id);
		await putMany('categories', seed.categories, (c) => c.id);
		await putMany('items', seed.items, (i) => i.id);
		await putMany('customers', seed.customers, (c) => c.id);
		await putMany('appointments', seed.appointments, (a) => a.id);
		await putMany('sales', seed.sales, (s) => s.id);
		await putMany('settings', seed.settings, (s) => s.branchId);
		await putOne('meta', true, SEEDED_KEY);
	}

	async resetDemo(): Promise<void> {
		await wipeAll();
		await this.init();
	}

	/** The mock already *is* the sample shop, so seeding is a reset. */
	async seedDemoData(_pin: string): Promise<Record<string, number>> {
		await this.resetDemo();
		const [branches, staff, items, customers, appointments, sales] = await Promise.all([
			readAll<Branch>('branches'),
			readAll<Staff>('staff'),
			readAll<Item>('items'),
			readAll<Customer>('customers'),
			readAll<Appointment>('appointments'),
			readAll<Sale>('sales')
		]);
		return {
			branches: branches.length,
			staff: staff.length,
			items: items.length,
			customers: customers.length,
			appointments: appointments.length,
			sales: sales.length
		};
	}

	/**
	 * The mock has no server side, so there is nothing to probe.
	 */
	async backendStatus(): Promise<BackendStatus | null> {
		return null;
	}

	// --- auth ---------------------------------------------------------------

	async listLoginDirectory(): Promise<DirectoryEntry[]> {
		const staff = await readAll<Staff>('staff');
		return staff
			.filter((s) => s.active)
			.map((s) => ({ id: s.id, displayName: s.displayName, role: s.role, active: s.active }));
	}

	async authenticate(staffId: string, pin: string): Promise<AuthProfile> {
		const record = (await readAll<Staff>('staff')).find((s) => s.id === staffId);
		if (!record || !record.active) throw new AuthError('PIN salah. Coba lagi.', 'pin');
		if (!record.pinHash || !record.pinSalt) {
			throw new AuthError('PIN belum diatur untuk staf ini.', 'server');
		}
		const ok = await verifyPin(pin, record.pinSalt, record.pinHash);
		if (!ok) throw new AuthError('PIN salah. Coba lagi.', 'pin');

		// Persist the session so a reload does not ask for the PIN again.
		if (isBrowser) localStorage.setItem(SESSION_KEY, JSON.stringify({ staffId: record.id }));

		return {
			id: record.id,
			displayName: record.displayName,
			role: record.role,
			branchIds: [...record.branchIds],
			phone: record.phone
		};
	}

	async signOut(): Promise<void> {
		// The mock has no server session to tear down — only the local marker.
		if (isBrowser) localStorage.removeItem(SESSION_KEY);
	}

	/**
	 * The mock keeps its session in localStorage, so a reload can restore it
	 * without re-entering the PIN.
	 */
	async restoreSession(): Promise<AuthProfile | null> {
		const raw = localStorage.getItem(SESSION_KEY);
		if (!raw) return null;
		try {
			const parsed = JSON.parse(raw) as { staffId: string };
			const record = (await readAll<Staff>('staff')).find((s) => s.id === parsed.staffId);
			if (!record || !record.active) {
				if (isBrowser) localStorage.removeItem(SESSION_KEY);
				return null;
			}
			return {
				id: record.id,
				displayName: record.displayName,
				role: record.role,
				branchIds: [...record.branchIds],
				phone: record.phone
			};
		} catch {
			return null;
		}
	}

	async setStaffPin(staffId: string, pin: string): Promise<void> {
		const record = (await readOne<Staff>('staff', staffId));
		if (!record) throw new Error('Staf tidak ditemukan.');
		const pinSalt = generateSalt();
		await putOne('staff', { ...record, pinSalt, pinHash: await hashPin(pin, pinSalt) }, staffId);
	}

	// --- branching ----------------------------------------------------------

	listBranches(): Promise<Branch[]> {
		return readAll<Branch>('branches');
	}

	async saveBranch(branch: Branch): Promise<void> {
		await putOne('branches', branch, branch.id);
	}

	listStaff(): Promise<Staff[]> {
		return readAll<Staff>('staff');
	}

	async saveStaff(staff: Staff): Promise<void> {
		await putOne('staff', staff, staff.id);
	}

	async deleteStaff(id: string): Promise<void> {
		await removeOne('staff', id);
	}

	listBarbers(): Promise<Barber[]> {
		return readAll<Barber>('barbers');
	}

	async saveBarber(barber: Barber): Promise<void> {
		await putOne('barbers', barber, barber.id);
	}

	// --- catalog ------------------------------------------------------------

	listCategories(): Promise<Category[]> {
		return readAll<Category>('categories');
	}

	async saveCategory(category: Category): Promise<void> {
		await putOne('categories', category, category.id);
	}

	listItems(): Promise<Item[]> {
		return readAll<Item>('items');
	}

	async saveItem(item: Item): Promise<void> {
		await putOne('items', item, item.id);
	}

	async deleteItem(id: string): Promise<void> {
		await removeOne('items', id);
	}

	// --- customers ----------------------------------------------------------

	listCustomers(): Promise<Customer[]> {
		return readAll<Customer>('customers');
	}

	async saveCustomer(customer: Customer): Promise<void> {
		await putOne('customers', customer, customer.id);
	}

	// --- appointments -------------------------------------------------------

	listAppointments(): Promise<Appointment[]> {
		return readAll<Appointment>('appointments');
	}

	async saveAppointment(appointment: Appointment): Promise<void> {
		await putOne('appointments', appointment, appointment.id);
	}

	async setAppointmentStatus(id: string, status: AppointmentStatus): Promise<void> {
		const existing = await readOne<Appointment>('appointments', id);
		if (!existing) return;
		await putOne('appointments', { ...existing, status }, id);
	}

	async deleteAppointment(id: string): Promise<void> {
		await removeOne('appointments', id);
	}

	// --- sales --------------------------------------------------------------

	listSales(): Promise<Sale[]> {
		return readAll<Sale>('sales');
	}

	listStockMovements(): Promise<StockMovement[]> {
		return readAll<StockMovement>('stockMovements');
	}

	// --- settings -----------------------------------------------------------

	getSettings(branchId: string): Promise<BranchSettings | undefined> {
		return readOne<BranchSettings>('settings', branchId);
	}

	async saveSettings(settings: BranchSettings): Promise<void> {
		await putOne('settings', settings, settings.branchId);
	}

	// --- selling ------------------------------------------------------------

	async commitSale(input: CommitInput): Promise<Sale> {
		const catalog = await readAll<Item>('items');

		// Re-price from the catalog — the client price is only a hint.
		const lines = input.lines.map((line) => {
			const item = catalog.find((i) => i.id === line.itemId);
			const unitPrice = item?.price ?? line.unitPrice;
			const lineTotal = line.qty * unitPrice - line.discount;
			return {
				itemId: line.itemId,
				type: line.type,
				name: item?.name ?? line.name,
				qty: line.qty,
				unitPrice,
				discount: line.discount,
				lineTotal,
				...(line.type === 'service'
					? {
							barberId: line.barberId,
							commissionPct: line.commissionPct ?? item?.commissionPct ?? 0,
							commissionAmount: commissionAmount(lineTotal, line.commissionPct ?? item?.commissionPct ?? 0),
							durationMin: line.durationMin ?? item?.durationMin ?? 0
						}
					: {})
			};
		});

		const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
		const existing = (await readAll<Sale>('sales')).find((s) => s.clientId === input.clientId);
		if (existing) return existing; // idempotent

		const sale: Sale = {
			id: uid('sale_'),
			clientId: input.clientId,
			receiptNo: '',
			provisionalReceiptNo: null,
			receiptDay: 0,
			receiptSeq: 0,
			branchId: input.branchId,
			cashierId: input.cashierId,
			soldAt: input.soldAt,
			customerName: input.customerName,
			customerPhone: input.customerPhone,
			customerId: null,
			lines,
			subtotal,
			discount: lines.reduce((sum, l) => sum + l.discount, 0),
			total: subtotal,
			payment: input.payment,
			syncState: 'synced',
			stockShortfall: false
		};

		await this.assignReceiptNo(sale);
		const shortfall = await this.applyStockEffects(sale);
		sale.stockShortfall = shortfall;

		await putOne('sales', sale, sale.id);
		await this.touchCustomer(sale);
		if (input.appointmentId) await this.setAppointmentStatus(input.appointmentId, 'done');

		return sale;
	}

	async syncPendingSales(
		pending: PendingSale[]
	): Promise<Array<{ clientId: string; sale: Sale }>> {
		const results: Array<{ clientId: string; sale: Sale }> = [];

		for (const item of pending) {
			const sale = await this.commitSale({
				branchId: item.branchId,
				cashierId: item.cashierId,
				customerName: item.customerName,
				customerPhone: item.customerPhone,
				lines: item.lines,
				payment: item.payment,
				clientId: item.clientId,
				soldAt: item.soldAt,
				appointmentId: item.appointmentId ?? null
			});
			results.push({ clientId: item.clientId, sale });
		}

		return results;
	}

	/**
	 * Assigns the receipt number and its day/sequence, mirroring what the
	 * Firestore rules enforce on the Firebase side.
	 */
	private async assignReceiptNo(sale: Sale): Promise<void> {
		const all = await readAll<Sale>('sales');
		const sameDay = all.filter(
			(s) => s.branchId === sale.branchId && dayKey(s.soldAt) === dayKey(sale.soldAt)
		);
		const branchCode = BRANCH_CODES[sale.branchId] ?? sale.branchId.slice(0, 3).toUpperCase();
		sale.receiptSeq = sameDay.length + 1;
		sale.receiptDay = Number(businessDayStamp(sale.soldAt));
		sale.receiptNo = buildReceiptNo(branchCode, sale.soldAt, sale.receiptSeq);
	}

	/**
	 * Stock moves only at commit time, mirroring the Cloud Function.
	 * A negative result is recorded rather than rejected: two branches can
	 * legitimately oversell while offline and the discrepancy must stay visible.
	 */
	private async applyStockEffects(sale: Sale): Promise<boolean> {
		const catalog = await readAll<Item>('items');
		let shortfall = false;

		for (const line of sale.lines) {
			if (line.type !== 'product') continue;
			const item = catalog.find((i) => i.id === line.itemId);
			if (!item || item.type !== 'product') continue;

			const nextStock = (item.stock ?? 0) - line.qty;
			if (nextStock < 0) shortfall = true;

			await putOne('items', { ...item, stock: nextStock }, item.id);
			const movement: StockMovement = {
				id: uid('sm_'),
				branchId: sale.branchId,
				itemId: item.id,
				qtyDelta: -line.qty,
				type: 'sale',
				refId: sale.id,
				actorId: sale.cashierId,
				note: sale.receiptNo,
				createdAt: sale.soldAt
			};
			await putOne('stockMovements', movement, movement.id);
		}

		return shortfall;
	}

	private async touchCustomer(sale: Sale): Promise<void> {
		const all = await readAll<Customer>('customers');
		const existing =
			(sale.customerId ? all.find((c) => c.id === sale.customerId) : undefined) ??
			all.find((c) => sale.customerPhone && c.phone === sale.customerPhone) ??
			all.find((c) => c.name.toLowerCase() === sale.customerName.toLowerCase());
		if (!existing) return;

		await putOne(
			'customers',
			{
				...existing,
				visitCount: existing.visitCount + 1,
				totalSpent: existing.totalSpent + sale.total,
				lastVisitAt: sale.soldAt
			},
			existing.id
		);
	}

	// --- outbox -------------------------------------------------------------

	listOutbox(): Promise<OutboxEntry[]> {
		return readAll<OutboxEntry>('outbox');
	}

	async enqueue(entry: OutboxEntry): Promise<void> {
		await putOne('outbox', entry, entry.clientId);
	}

	async dequeue(clientId: string): Promise<void> {
		await removeOne('outbox', clientId);
	}

	async clearOutbox(): Promise<void> {
		const all = await readAll<OutboxEntry>('outbox');
		await Promise.all(all.map((entry) => removeOne('outbox', entry.clientId)));
	}
}

export const mockRepository = new MockRepository();

/** Re-exported so the mock can build provisional offline receipt numbers. */
export { buildProvisionalReceiptNo };
export type { Payment };
