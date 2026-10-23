import {
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	query,
	runTransaction,
	setDoc,
	where,
	writeBatch,
	type Query
} from 'firebase/firestore';
import {
	onAuthStateChanged,
	signInWithEmailAndPassword,
	signOut as firebaseSignOut,
	updatePassword,
	type User
} from 'firebase/auth';
import { getFirebase } from '#lib/firebase/client';
import { authEmailFor } from '#lib/utils/auth';
import { businessDayStamp } from '#shared/time';
import { commissionAmount } from '#lib/utils/receipt';
import type {
	Appointment,
	AppointmentStatus,
	Barber,
	Branch,
	BranchSettings,
	Category,
	Customer,
	Item,
	Role,
	Sale,
	SaleLine,
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

/**
 * Firestore repository — no server side.
 *
 * Reads and writes go straight to Firestore and `firestore.rules` is the
 * authority: the rules re-price every sale line against the catalog, sum the
 * total, and allocate the receipt number from a counter document. A tampered
 * client is rejected by the rules, not trusted.
 *
 * Sign-in is Firebase Authentication with the PIN as the password, so the PIN
 * hash never touches Firestore.
 */
export class FirebaseRepository implements PosRepository {
	private get db() {
		return getFirebase().firestore;
	}

	private get auth() {
		return getFirebase().auth;
	}

	/** A collection reference, using the modular (functional) Firestore API. */
	private col(path: string) {
		return collection(this.db, path);
	}

	/**
	 * The branches this signed-in staff member may read, taken from their own
	 * staff document — the same document `firestore.rules` trusts.
	 */
	private async myBranchIds(): Promise<string[]> {
		const user = this.auth.currentUser;
		if (!user) return [];
		const snap = await getDoc(doc(this.db, 'staff', user.uid));
		if (!snap.exists()) return [];
		const branchIds = (snap.data() as { branchIds?: string[] }).branchIds;
		return Array.isArray(branchIds) ? branchIds : [];
	}

	/**
	 * A branch-scoped query for the collections the rules protect by branch.
	 *
	 * The `where` clause is not an optimisation — it is required. The rules
	 * evaluate `resource.data.branchId`, which Firestore can only prove for a
	 * list query when the query itself constrains that field. Without it the
	 * whole read is rejected.
	 *
	 * A signed-out user has no branches, and Firestore rejects an empty `in`
	 * list, so that case returns nothing rather than an invalid query.
	 */
	private async branchScoped(path: string): Promise<Query | null> {
		const branchIds = await this.myBranchIds();
		if (branchIds.length === 0) return null;
		return query(this.col(path), where('branchId', 'in', branchIds));
	}

	/**
	 * Reads a collection that the rules require a signed-in user for.
	 *
	 * Before sign-in there is nothing to read and the read would be denied, so
	 * it returns an empty list instead of failing the whole boot.
	 */
	private async readAll<T>(path: string): Promise<Array<{ id: string } & T>> {
		if (!this.auth.currentUser) return [];
		const snap = await getDocs(this.col(path));
		return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as { id: string } & T);
	}

	/** Reads a branch-scoped collection; nothing is visible without branches. */
	private async readBranchScoped<T>(path: string): Promise<Array<{ id: string } & T>> {
		const scoped = await this.branchScoped(path);
		if (!scoped) return [];
		const snap = await getDocs(scoped);
		return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as { id: string } & T);
	}

	// --- lifecycle ----------------------------------------------------------

	async init(): Promise<void> {
		// Touch the SDK so an invalid config fails loudly at boot rather than
		// on the first user action.
		getFirebase();
	}

	async resetDemo(): Promise<void> {
		throw new Error(
			'Reset data demo hanya tersedia pada mode mock. Untuk Firestore, jalankan scripts/seed-live.cjs dari komputer pemilik toko.'
		);
	}

	// --- auth ---------------------------------------------------------------

	async listLoginDirectory(): Promise<DirectoryEntry[]> {
		const snap = await getDocs(this.col('staffDirectory'));
		return snap.docs.map((d) => {
			const data = d.data() as { displayName: string; role: Role; active: boolean };
			return {
				id: d.id,
				displayName: data.displayName,
				role: data.role,
				active: data.active
			};
		});
	}

	/**
	 * Sign in with the PIN.
	 *
	 * Firebase Authentication does the verification, so the PIN never reaches
	 * Firestore and never leaves Google's password store. The error is mapped
	 * so the login screen can tell a wrong PIN from a lost connection.
	 */
	async authenticate(staffId: string, pin: string): Promise<AuthProfile> {
		try {
			const credential = await signInWithEmailAndPassword(
				this.auth,
				authEmailFor(staffId),
				pin
			);
			return await this.profileFromUser(credential.user);
		} catch (error) {
			const code = String((error as { code?: string })?.code ?? '');
			if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
				throw new AuthError('PIN salah atau belum lengkap. Coba lagi.', 'pin');
			}
			if (code === 'auth/too-many-requests') {
				throw new AuthError('Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.', 'locked');
			}
			if (code === 'auth/user-not-found' || code === 'auth/invalid-email') {
				throw new AuthError('Akun ini belum terdaftar. Hubungi pemilik toko.', 'account');
			}
			throw new AuthError('Server tidak dapat dihubungi. Periksa koneksi internet.', 'server');
		}
	}

	/** Health check: can Firestore be reached, and does it hold the shop? */
	async backendStatus(): Promise<BackendStatus> {
		const snap = await getDocs(this.col('staffDirectory'));
		return { ok: true, staffCount: snap.size };
	}

	async restoreSession(): Promise<AuthProfile | null> {
		const user = await this.waitForAuth();
		if (!user) return null;
		try {
			return await this.profileFromUser(user);
		} catch {
			// Signed in, but not a staff member (or deactivated).
			return null;
		}
	}

	async signOut(): Promise<void> {
		await firebaseSignOut(this.auth);
	}

	/**
	 * Changes a PIN.
	 *
	 * Firebase Authentication only lets an account change its own password, so
	 * this works for the signed-in member. Resetting somebody else's PIN needs
	 * admin access, which the shop owner has through the seed script.
	 */
	async setStaffPin(staffId: string, pin: string): Promise<void> {
		const user = this.auth.currentUser;
		if (!user) throw new Error('Belum masuk.');
		if (user.uid !== staffId) {
			throw new Error(
				'PIN staf lain hanya bisa diubah oleh pemilik toko lewat scripts/set-all-pins.cjs. Nonaktifkan stafnya dulu lewat menu Cabang.'
			);
		}
		await updatePassword(user, pin);
	}

	private waitForAuth(): Promise<User | null> {
		const current = this.auth.currentUser;
		if (current) return Promise.resolve(current);
		return new Promise((resolve) => {
			const unsubscribe = onAuthStateChanged(this.auth, (user) => {
				unsubscribe();
				resolve(user);
			});
		});
	}

	/**
	 * The profile comes from the staff document, which is where the rules
	 * read the role and the branch list from too.
	 */
	private async profileFromUser(user: User): Promise<AuthProfile> {
		const snap = await getDoc(doc(this.db, 'staff', user.uid));
		if (!snap.exists()) {
			throw new AuthError('Akun ini belum terdaftar. Hubungi pemilik toko.', 'account');
		}
		const data = snap.data() as {
			displayName?: string;
			role?: Role;
			branchIds?: string[];
			phone?: string;
			active?: boolean;
		};
		if (data.active === false) {
			throw new AuthError('Akun ini sudah dinonaktifkan. Hubungi pemilik toko.', 'account');
		}
		return {
			id: user.uid,
			displayName: data.displayName ?? user.displayName ?? user.uid,
			role: data.role ?? 'barber',
			branchIds: Array.isArray(data.branchIds) ? data.branchIds : [],
			phone: data.phone ?? ''
		};
	}

	// --- branching ----------------------------------------------------------

	async listBranches(): Promise<Branch[]> {
		return this.readAll<Branch>('branches');
	}

	async saveBranch(branch: Branch): Promise<void> {
		await setDoc(doc(this.db, 'branches', branch.id), branch);
	}

	async listStaff(): Promise<Staff[]> {
		return this.readAll<Staff>('staff');
	}

	async saveStaff(staff: Staff): Promise<void> {
		const { id, ...rest } = staff;
		await setDoc(doc(this.db, 'staff', id), rest);
	}

	async deleteStaff(id: string): Promise<void> {
		await deleteDoc(doc(this.db, 'staff', id));
	}

	async listBarbers(): Promise<Barber[]> {
		return this.readAll<Barber>('barbers');
	}

	async saveBarber(barber: Barber): Promise<void> {
		const { id, ...rest } = barber;
		await setDoc(doc(this.db, 'barbers', id), rest);
	}

	// --- catalog ------------------------------------------------------------

	async listCategories(): Promise<Category[]> {
		return this.readAll<Category>('categories');
	}

	async saveCategory(category: Category): Promise<void> {
		const { id, ...rest } = category;
		await setDoc(doc(this.db, 'categories', id), rest);
	}

	async listItems(): Promise<Item[]> {
		return this.readAll<Item>('items');
	}

	async saveItem(item: Item): Promise<void> {
		const { id, ...rest } = item;
		await setDoc(doc(this.db, 'items', id), rest);
	}

	async deleteItem(id: string): Promise<void> {
		await deleteDoc(doc(this.db, 'items', id));
	}

	// --- customers ----------------------------------------------------------

	async listCustomers(): Promise<Customer[]> {
		return this.readAll<Customer>('customers');
	}

	async saveCustomer(customer: Customer): Promise<void> {
		const { id, ...rest } = customer;
		await setDoc(doc(this.db, 'customers', id), rest);
	}

	// --- appointments -------------------------------------------------------

	async listAppointments(): Promise<Appointment[]> {
		return this.readBranchScoped<Appointment>('appointments');
	}

	async saveAppointment(appointment: Appointment): Promise<void> {
		const { id, ...rest } = appointment;
		await setDoc(doc(this.db, 'appointments', id), rest);
	}

	async setAppointmentStatus(id: string, status: AppointmentStatus): Promise<void> {
		await setDoc(doc(this.db, 'appointments', id), { status }, { merge: true });
	}

	async deleteAppointment(id: string): Promise<void> {
		await deleteDoc(doc(this.db, 'appointments', id));
	}

	// --- sales & stock ------------------------------------------------------

	async listSales(): Promise<Sale[]> {
		return this.readBranchScoped<Sale>('sales');
	}

	async listStockMovements(): Promise<StockMovement[]> {
		return this.readBranchScoped<StockMovement>('stockMovements');
	}

	// --- settings -----------------------------------------------------------

	async getSettings(branchId: string): Promise<BranchSettings | undefined> {
		const snap = await getDoc(doc(this.db, 'settings', branchId));
		return snap.exists() ? ({ branchId, ...snap.data() } as BranchSettings) : undefined;
	}

	async saveSettings(settings: BranchSettings): Promise<void> {
		const { branchId, ...rest } = settings;
		await setDoc(doc(this.db, 'settings', branchId), rest);
	}

	// --- selling ------------------------------------------------------------

	/**
	 * Commit a sale straight to Firestore.
	 *
	 * Two transactions, in order:
	 *
	 *  1. the receipt counter and the sale document. The rules check every
	 *     line against the catalog, the total against the sum of the lines,
	 *     and the receipt number against the counter.
	 *  2. the stock movements and the item stock levels. The rules check each
	 *     movement against the sale it points at, which is why it has to run
	 *     after the sale is committed.
	 *
	 * The sale document id is derived from the client id, so retrying a sale
	 * that already went through finds the same document instead of creating a
	 * second one.
	 */
	async commitSale(input: CommitInput): Promise<Sale> {
		const user = this.auth.currentUser;
		if (!user) throw new Error('Belum masuk.');

		const saleId = `sale_${input.clientId}`;
		const saleRef = doc(this.db, 'sales', saleId);

		// Idempotency: a retry after a successful commit returns that sale.
		const existing = await getDoc(saleRef);
		if (existing.exists()) return { id: saleId, ...existing.data() } as Sale;

		const lines = await this.priceLines(input);
		const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
		const discount = lines.reduce((sum, l) => sum + l.discount, 0);
		const total = subtotal;

		const receiptDay = Number(businessDayStamp(input.soldAt));
		const counterDay = String(receiptDay);

		const branchSnap = await getDoc(doc(this.db, 'branches', input.branchId));
		const branchCode = (branchSnap.data() as { code?: string } | undefined)?.code ?? 'POS';

		const tendered =
			input.payment.method === 'cash' ? Math.max(input.payment.amountTendered, total) : total;

		let receiptSeq = 0;
		let receiptNo = '';

		// The counter for today may not exist yet. It is created at zero
		// first, so the rules can always read it — reading a document that
		// does not exist is an error in the rules engine, not a null.
		const counterRef = doc(this.db, 'counters', input.branchId, 'days', counterDay);
		const existingCounter = await getDoc(counterRef);
		if (!existingCounter.exists()) {
			try {
				// The counter carries the branch's receipt code, so the rules
				// can check the receipt number with a single read.
				await setDoc(counterRef, { seq: 0, code: branchCode });
			} catch {
				// Another device created it first — that is fine, the
				// transaction below reads whichever version is committed.
			}
		}

		await runTransaction(this.db, async (tx) => {
			const counterSnap = await tx.get(counterRef);
			receiptSeq = ((counterSnap.exists() ? (counterSnap.data()?.seq ?? 0) : 0) as number) + 1;
			receiptNo = `INV/${branchCode}/${receiptDay}/${String(receiptSeq).padStart(3, '0')}`;

			tx.set(counterRef, { seq: receiptSeq }, { merge: true });
			tx.set(saleRef, {
				clientId: input.clientId,
				receiptNo,
				provisionalReceiptNo: null,
				receiptDay,
				receiptSeq,
				branchId: input.branchId,
				cashierId: input.cashierId,
				soldAt: input.soldAt,
				customerName: input.customerName.trim(),
				customerPhone: input.customerPhone,
				customerId: null,
				lines,
				subtotal,
				discount,
				total,
				payment: {
					method: input.payment.method,
					amountTendered: tendered,
					change: input.payment.method === 'cash' ? tendered - total : 0,
					qrisRef: input.payment.qrisRef ?? null
				},
				syncState: 'synced',
				stockShortfall: false
			});
		});

		await this.applyStock(input.branchId, saleId, lines, user.uid, input.soldAt);

		return {
			id: saleId,
			clientId: input.clientId,
			receiptNo,
			provisionalReceiptNo: null,
			receiptDay,
			receiptSeq,
			branchId: input.branchId,
			cashierId: input.cashierId,
			soldAt: input.soldAt,
			customerName: input.customerName.trim(),
			customerPhone: input.customerPhone,
			customerId: null,
			lines,
			subtotal,
			discount,
			total,
			payment: {
				method: input.payment.method,
				amountTendered: tendered,
				change: input.payment.method === 'cash' ? tendered - total : 0,
				qrisRef: input.payment.qrisRef ?? null
			},
			syncState: 'synced',
			stockShortfall: false
		};
	}

	/**
	 * Re-prices the cart from the catalog.
	 *
	 * The rules check these numbers too — this is here so a stale cart gives
	 * a readable message instead of "permission denied".
	 */
	private async priceLines(input: CommitInput): Promise<SaleLine[]> {
		const itemIds = [...new Set(input.lines.map((l) => l.itemId))];
		const snaps = await Promise.all(
			itemIds.map((id) => getDoc(doc(this.db, 'items', id)))
		);
		const catalog = new Map<string, Item>(
			snaps
				.filter((snap) => snap.exists())
				.map((snap) => [snap.id, snap.data() as Item])
		);

		return input.lines.map((line) => {
			const item = catalog.get(line.itemId);
			if (!item) throw new Error(`Layanan ${line.name} sudah tidak ada di katalog.`);
			if (item.price !== line.unitPrice) {
				throw new Error(`Harga ${item.name} sudah berubah. Muat ulang halaman.`);
			}
			const lineTotal = line.qty * item.price - line.discount;
			return {
				itemId: line.itemId,
				type: item.type,
				name: item.name,
				qty: line.qty,
				unitPrice: item.price,
				discount: line.discount,
				lineTotal,
				...(item.type === 'service'
					? {
							barberId: line.barberId,
							commissionPct: item.commissionPct ?? 0,
							commissionAmount: commissionAmount(lineTotal, item.commissionPct ?? 0),
							durationMin: item.durationMin ?? 0
						}
					: {})
			};
		});
	}

	/**
	 * Moves stock and records the movement.
	 *
	 * The movement document id is derived from the sale and the item, so
	 * retrying does not double-count. The rules check each movement against
	 * the sale it references.
	 */
	private async applyStock(
		branchId: string,
		saleId: string,
		lines: SaleLine[],
		actorId: string,
		soldAt: string
	): Promise<void> {
		const products = lines.filter((l) => l.type === 'product');
		if (products.length === 0) return;

		const batch = writeBatch(this.db);
		for (const line of products) {
			const movementId = `mv_${saleId}_${line.itemId}`;
			batch.set(doc(this.db, 'stockMovements', movementId), {
				branchId,
				itemId: line.itemId,
				qtyDelta: -line.qty,
				type: 'sale',
				refId: saleId,
				actorId,
				note: '',
				createdAt: soldAt
			});
		}
		await batch.commit();

		// The item stock is a denormalised view of the movements. Barbers may
		// only lower it, so the rules reject any attempt to inflate stock.
		for (const line of products) {
			const itemRef = doc(this.db, 'items', line.itemId);
			await runTransaction(this.db, async (tx) => {
				const movementRef = doc(this.db, 'stockMovements', `mv_${saleId}_${line.itemId}`);
				const movementSnap = await tx.get(movementRef);
				if (!movementSnap.exists()) return; // already applied
				const itemSnap = await tx.get(itemRef);
				if (!itemSnap.exists()) return;
				const current = (itemSnap.data()?.stock ?? 0) as number;
				tx.set(itemRef, { stock: Math.max(0, current - line.qty) }, { merge: true });
			});
		}
	}

	async syncPendingSales(
		pending: PendingSale[]
	): Promise<Array<{ clientId: string; sale: Sale }>> {
		const results: Array<{ clientId: string; sale: Sale }> = [];
		for (const item of pending) {
			const sale = await this.commitSale(item);
			results.push({ clientId: item.clientId, sale });
		}
		return results;
	}

	// --- migration ----------------------------------------------------------

	/**
	 * The sample shop is imported by `scripts/seed-live.cjs`, which needs
	 * admin access to create the Firebase Auth accounts. A client cannot do
	 * that, so the button is gone and this explains where to go instead.
	 */
	async seedDemoData(_pin: string): Promise<Record<string, number>> {
		throw new Error(
			'Impor data contoh dijalankan dari komputer toko: node scripts/seed-live.cjs'
		);
	}
}

export const firebaseRepository = new FirebaseRepository();
