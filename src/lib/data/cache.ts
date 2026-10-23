import { get, writable, type Readable } from 'svelte/store';
import { repo } from './index';
import { locale, translate } from '#lib/i18n';
import type {
	Appointment,
	Barber,
	Branch,
	BranchSettings,
	Category,
	Customer,
	Item,
	Sale,
	Staff
} from '#lib/types/domain';

/**
 * Reactive mirror of the repository.
 *
 * Reads are served from these stores rather than hitting storage per component,
 * so a sale committed anywhere updates the dashboard, queue board, and reports
 * simultaneously without explicit refresh plumbing.
 */

function collection<T>(loader: () => Promise<T[]>) {
	const store = writable<T[]>([]);
	return {
		...store,
		subscribe: store.subscribe,
		async refresh() {
			store.set(await loader());
		}
	};
}

export const branches = collection<Branch>(() => repo.listBranches());
export const staff = collection<Staff>(() => repo.listStaff());
export const barbers = collection<Barber>(() => repo.listBarbers());
export const categories = collection<Category>(() => repo.listCategories());
export const items = collection<Item>(() => repo.listItems());
export const customers = collection<Customer>(() => repo.listCustomers());
export const appointments = collection<Appointment>(() => repo.listAppointments());
export const sales = collection<Sale>(() => repo.listSales());
/**
 * The outbox is device-local (IndexedDB), not a repository concern, so it is
 * exposed here from its own module rather than through the backend.
 */
export { queuedSales as outbox, refreshQueue } from './local/outbox';
import { refreshQueue } from './local/outbox';

export const branchSettings = writable<BranchSettings | null>(null);

export const loading = writable(true);
export const bootError = writable<string | null>(null);

export async function refreshAll(): Promise<void> {
	await Promise.all([
		branches.refresh(),
		staff.refresh(),
		barbers.refresh(),
		categories.refresh(),
		items.refresh(),
		customers.refresh(),
		appointments.refresh(),
		sales.refresh()
	]);
	await refreshQueue();
}

/**
 * How long the app waits for the backend before admitting defeat.
 *
 * The Firestore SDK retries a missing or unreachable database forever instead
 * of rejecting, so without this the app would sit on "Memuat…" indefinitely
 * rather than telling the operator what is actually wrong.
 */
const BOOT_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(message)), ms);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error) => {
				clearTimeout(timer);
				reject(error);
			}
		);
	});
}

export async function boot(): Promise<void> {
	loading.set(true);
	bootError.set(null);
	try {
		await withTimeout(repo.init(), BOOT_TIMEOUT_MS, bootTimeoutMessage());
		await withTimeout(refreshAll(), BOOT_TIMEOUT_MS, bootTimeoutMessage());
	} catch (error) {
		bootError.set(error instanceof Error ? error.message : String(error));
	} finally {
		loading.set(false);
	}
}

function bootTimeoutMessage(): string {
	return translate(get(locale), 'boot.timeout');
}

export async function loadSettings(branchId: string): Promise<void> {
	branchSettings.set((await repo.getSettings(branchId)) ?? null);
}

export async function resetDemoData(): Promise<void> {
	await repo.resetDemo();
	await refreshAll();
}

/** Readable helper types re-exported so screens import from one place. */
export type { Appointment, Barber, Branch, Customer, Item, Sale, Staff } from '#lib/types/domain';
export type { Readable } from 'svelte/store';