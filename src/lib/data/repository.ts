import type {
	Appointment,
	AppointmentStatus,
	Barber,
	Branch,
	BranchSettings,
	Category,
	Customer,
	Item,
	ItemType,
	Payment,
	PaymentMethod,
	Role,
	Sale,
	Staff,
	StockMovement
} from '#lib/types/domain';

/** Public profile of a staff member, safe to hold on the client. */
export interface AuthProfile {
	id: string;
	displayName: string;
	role: Role;
	branchIds: string[];
	phone: string;
}

/**
 * Why a sign-in attempt failed.
 *
 * `pin` means the PIN was rejected. `server` means the backend could not be
 * reached. `locked` means too many attempts. `account` means the account is
 * not (or no longer) a staff member. Each of those needs a different thing
 * said to the person in front of the till.
 */
export type AuthFailureKind = 'pin' | 'server' | 'locked' | 'account';

export class AuthError extends Error {
	readonly kind: AuthFailureKind;

	constructor(message: string, kind: AuthFailureKind = 'pin') {
		super(message);
		this.name = 'AuthError';
		this.kind = kind;
	}
}

/** Result of a backend health check. */
export interface BackendStatus {
	ok: boolean;
	staffCount: number;
}

/** Entry shown on the login picker before anyone is authenticated. */
export interface DirectoryEntry {
	id: string;
	displayName: string;
	role: Role;
	active: boolean;
}

/**
 * A cart line as it crosses the repository boundary.
 *
 * `unitPrice` is treated as a *hint*: the server re-prices every line from
 * the catalog, so a tampered client cannot sell a Rp 350.000 service for
 * Rp 1.000.
 */
export interface CommitLine {
	itemId: string;
	type: ItemType;
	name: string;
	qty: number;
	unitPrice: number;
	discount: number;
	barberId?: string;
	commissionPct?: number;
	durationMin?: number;
}

export interface CommitInput {
	branchId: string;
	cashierId: string;
	customerName: string;
	customerPhone: string | null;
	lines: CommitLine[];
	payment: Payment;
	/**
	 * Idempotency key minted on the client. The same key must never produce two
	 * sales — this is what makes retrying a queued offline sale safe.
	 */
	clientId: string;
	/** Original sale time, so a sale taken offline keeps its real timestamp. */
	soldAt: string;
	appointmentId?: string | null;
}

/**
 * A sale waiting to reach the server.
 *
 * `clientId` is the idempotency key: the server must never create two sales
 * for the same key, which is what makes retrying safe after a dropped
 * connection.
 */
export interface PendingSale {
	clientId: string;
	branchId: string;
	cashierId: string;
	customerName: string;
	customerPhone: string | null;
	lines: CommitLine[];
	payment: Payment;
	/** Original sale time, so a sale taken offline keeps its real timestamp. */
	soldAt: string;
	appointmentId?: string | null;
}

export interface PaymentInput {
	method: PaymentMethod;
	amountTendered: number;
	qrisRef?: string | null;
}

/**
 * The single seam between UI and storage.
 *
 * The mock implementation (IndexedDB) and the Firebase implementation
 * (Firestore + Auth + security rules) both satisfy this contract, so swapping
 * `repo` in `src/lib/data/index.ts` is the only change required to go live.
 */
export interface PosRepository {
	init(): Promise<void>;
	resetDemo(): Promise<void>;

	/**
	 * One-shot import of the sample shop.
	 *
	 * On a remote backend this is refused unless the database is still empty —
	 * it must never overwrite live shop data.
	 */
	seedDemoData(pin: string): Promise<Record<string, number>>;

	/**
	 * Health check for the backend.
	 *
	 * `null` means the backend has no server at all (the mock). Otherwise the
	 * result says whether the data is reachable and how much of it there is.
	 */
	backendStatus(): Promise<BackendStatus | null>;

	// --- auth ---------------------------------------------------------------

	/** Staff list for the login picker; readable before authentication. */
	listLoginDirectory(): Promise<DirectoryEntry[]>;
	/** Verify a PIN and establish an authenticated session. */
	authenticate(staffId: string, pin: string): Promise<AuthProfile>;
	/**
	 * Restore a previously authenticated session, if the backend still honours
	 * it. The mock reads localStorage; Firebase reads its persisted auth state.
	 */
	restoreSession(): Promise<AuthProfile | null>;
	signOut(): Promise<void>;
	/** Set or reset a staff member's PIN. */
	setStaffPin(staffId: string, pin: string): Promise<void>;

	// --- branching ----------------------------------------------------------

	listBranches(): Promise<Branch[]>;
	saveBranch(branch: Branch): Promise<void>;

	listStaff(): Promise<Staff[]>;
	saveStaff(staff: Staff): Promise<void>;
	deleteStaff(id: string): Promise<void>;

	listBarbers(): Promise<Barber[]>;
	saveBarber(barber: Barber): Promise<void>;

	listCategories(): Promise<Category[]>;
	saveCategory(category: Category): Promise<void>;

	listItems(): Promise<Item[]>;
	saveItem(item: Item): Promise<void>;
	deleteItem(id: string): Promise<void>;

	listCustomers(): Promise<Customer[]>;
	saveCustomer(customer: Customer): Promise<void>;

	listAppointments(): Promise<Appointment[]>;
	saveAppointment(appointment: Appointment): Promise<void>;
	setAppointmentStatus(id: string, status: AppointmentStatus): Promise<void>;
	deleteAppointment(id: string): Promise<void>;

	listSales(): Promise<Sale[]>;

	listStockMovements(): Promise<StockMovement[]>;

	getSettings(branchId: string): Promise<BranchSettings | undefined>;
	saveSettings(settings: BranchSettings): Promise<void>;

	// --- selling ------------------------------------------------------------

	/**
	 * Commit a sale. The server is authoritative: it prices the lines, assigns
	 * the receipt number, decrements stock, and returns the stored sale.
	 */
	commitSale(input: CommitInput): Promise<Sale>;
	/**
	 * Push queued offline sales to the server.
	 *
	 * Returns the authoritative sale for each one that was accepted, so the
	 * client can replace its provisional receipt with the real number.
	 */
	syncPendingSales(pending: PendingSale[]): Promise<Array<{ clientId: string; sale: Sale }>>;
}
