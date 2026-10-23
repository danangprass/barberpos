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
import { buildSeedData } from '#shared/seed-data';
import { generateSalt, hashPin } from '#lib/utils/pin';

/** Every seeded account uses this PIN so the demo is walkable. */
export const DEMO_PIN = '123456';

export interface SeedBundle {
	branches: Branch[];
	staff: Staff[];
	barbers: Barber[];
	categories: Category[];
	items: Item[];
	customers: Customer[];
	appointments: Appointment[];
	sales: Sale[];
	settings: BranchSettings[];
}

/**
 * Builds the sample shop for the mock repository.
 *
 * The business data comes from `shared/seed-data` — the same module the live
 * seed script uses — so both paths produce an identical shop.
 *
 * The one thing the mock adds is a local PIN hash: the mock keeps its own
 * credentials in IndexedDB. On Firebase the PIN is the Firebase Authentication
 * password and never touches Firestore.
 */
export async function buildSeed(now = new Date()): Promise<SeedBundle> {
	const seed = buildSeedData(now);

	const branches = seed.branches.map((doc) => doc.data as unknown as Branch);
	const categories = seed.categories.map((doc) => doc.data as unknown as Category);
	const items = seed.items.map((doc) => doc.data as unknown as Item);
	const customers = seed.customers.map((doc) => doc.data as unknown as Customer);
	const appointments = seed.appointments.map((doc) => doc.data as unknown as Appointment);
	const sales = seed.sales.map((doc) => doc.data as unknown as Sale);
	const settings = seed.settings.map((doc) => doc.data as unknown as BranchSettings);
	const barbers = seed.barbers.map((doc) => doc.data as unknown as Barber);

	const staff: Staff[] = [];
	for (const doc of seed.staff) {
		const pinSalt = generateSalt();
		staff.push({
			...(doc.data as unknown as Staff),
			pinSalt,
			pinHash: await hashPin(DEMO_PIN, pinSalt)
		});
	}

	return { branches, staff, barbers, categories, items, customers, appointments, sales, settings };
}
