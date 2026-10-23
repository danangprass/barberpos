/**
 * Canonical sample dataset — the single source of truth for the demo shop.
 *
 * Imported by BOTH the client-side mock repository and the Cloud Function that
 * seeds Firestore, so the two never drift. The only import is `./time`, which
 * is equally dependency-free: the client build (ESM) and the functions build
 * (CommonJS) both compile this same file.
 *
 * The PIN is NOT stored here. Callers pass it in so no plaintext credential
 * ever lives in a module that ships to the browser.
 */

import { businessDayOffset, businessInstant, businessMinutesOfDay } from './time.ts';

export type SampleRole = 'owner' | 'manager' | 'barber';
export type SampleItemType = 'service' | 'product';

export interface SampleBranch {
	id: string;
	name: string;
	address: string;
	phone: string;
}

export interface SampleStaff {
	id: string;
	displayName: string;
	role: SampleRole;
	phone: string;
	branchIds: string[];
}

export interface SampleCategory {
	id: string;
	name: string;
	kind: SampleItemType;
	sortOrder: number;
}

export interface SampleItem {
	id: string;
	type: SampleItemType;
	name: string;
	categoryId: string | null;
	price: number;
	durationMin?: number;
	commissionPct?: number;
	sku?: string;
	barcode?: string;
	costPrice?: number;
	stock?: number;
	lowStockThreshold?: number;
}

export interface SampleCustomer {
	id: string;
	name: string;
	phone: string | null;
	notes: string;
	visitCount: number;
	totalSpent: number;
}

export interface SampleAppointment {
	id: string;
	branchId: string;
	customerName: string;
	customerPhone: string | null;
	barberId: string;
	serviceIds: string[];
	/** Minutes from midnight on the seed day. */
	offsetMin: number;
	durationMin: number;
	status: 'booked' | 'arrived' | 'queued' | 'in_service';
	notes: string;
}

export interface SampleSettings {
	branchId: string;
	receiptHeader: string;
	receiptFooter: string;
	lowStockDefault: number;
}

export interface SampleSaleLine {
	itemId: string;
	type: SampleItemType;
	name: string;
	qty: number;
	unitPrice: number;
	discount: number;
	barberId?: string;
	commissionPct?: number;
	commissionAmount?: number;
	durationMin?: number;
}

export interface SampleSale {
	clientId: string;
	branchId: string;
	cashierId: string;
	customerId: string | null;
	customerName: string;
	customerPhone: string | null;
	/** How many days before the seed day this sale happened. */
	daysAgo: number;
	/** Minutes from midnight on that shop day. */
	offsetMin: number;
	lines: SampleSaleLine[];
	discount: number;
	paymentMethod: 'cash' | 'qris';
	amountTendered: number;
	change: number;
	qrisRef: string | null;
}

/** Branch code used in receipt numbers: `INV/SDM/20261020/001`. */
export const BRANCH_CODES: Record<string, string> = {
	b_sudirman: 'SDM',
	b_kemang: 'KMG'
};

export const SAMPLE_BRANCHES: SampleBranch[] = [
	{
		id: 'b_sudirman',
		name: 'Pangkas Rambut Sudirman',
		address: 'Jl. Sudirman No. 45, Jakarta Pusat',
		phone: '021-555-0111'
	},
	{
		id: 'b_kemang',
		name: 'Pangkas Rambut Kemang',
		address: 'Jl. Kemang Raya No. 12, Jakarta Selatan',
		phone: '021-555-0222'
	}
];

export const SAMPLE_STAFF: SampleStaff[] = [
	{
		id: 's_andi',
		displayName: 'Andi Saputra',
		role: 'owner',
		phone: '0811-1001-0001',
		branchIds: ['b_sudirman', 'b_kemang']
	},
	{
		id: 's_sari',
		displayName: 'Sari Wijaya',
		role: 'manager',
		phone: '0811-1001-0002',
		branchIds: ['b_sudirman']
	},
	{
		id: 's_rahmat',
		displayName: 'Rahmat Hidayat',
		role: 'barber',
		phone: '0811-1001-0003',
		branchIds: ['b_sudirman', 'b_kemang']
	},
	{
		id: 's_bayu',
		displayName: 'Bayu Nugroho',
		role: 'barber',
		phone: '0811-1001-0004',
		branchIds: ['b_sudirman']
	},
	{
		id: 's_joko',
		displayName: 'Joko Prasetyo',
		role: 'barber',
		phone: '0811-1001-0005',
		branchIds: ['b_kemang']
	}
];

export const SAMPLE_CATEGORIES: SampleCategory[] = [
	{ id: 'cat_potong', name: 'Potong Rambut', kind: 'service', sortOrder: 1 },
	{ id: 'cat_perawatan', name: 'Perawatan', kind: 'service', sortOrder: 2 },
	{ id: 'cat_warna', name: 'Warna & Styling', kind: 'service', sortOrder: 3 },
	{ id: 'cat_treatment', name: 'Treatment', kind: 'service', sortOrder: 4 },
	{ id: 'cat_perawatan_rambut', name: 'Perawatan Rambut', kind: 'product', sortOrder: 1 },
	{ id: 'cat_alat', name: 'Alat Cukur', kind: 'product', sortOrder: 2 }
];

export const SAMPLE_ITEMS: SampleItem[] = [
	{ id: 'i_potong_pria', type: 'service', name: 'Potong Rambut Pria', categoryId: 'cat_potong', price: 45000, durationMin: 30, commissionPct: 40 },
	{ id: 'i_potong_wanita', type: 'service', name: 'Potong Rambut Wanita', categoryId: 'cat_potong', price: 65000, durationMin: 45, commissionPct: 40 },
	{ id: 'i_kerok', type: 'service', name: 'Kerok / Facial', categoryId: 'cat_perawatan', price: 55000, durationMin: 30, commissionPct: 45 },
	{ id: 'i_cuci', type: 'service', name: 'Cuci Rambut', categoryId: 'cat_perawatan', price: 20000, durationMin: 15, commissionPct: 30 },
	{ id: 'i_creambath', type: 'service', name: 'Creambath', categoryId: 'cat_treatment', price: 85000, durationMin: 40, commissionPct: 45 },
	{ id: 'i_coloring', type: 'service', name: 'Coloring Rambut', categoryId: 'cat_warna', price: 180000, durationMin: 90, commissionPct: 50 },
	{ id: 'i_smoothing', type: 'service', name: 'Smoothing Rambut', categoryId: 'cat_warna', price: 350000, durationMin: 120, commissionPct: 50 },

	{ id: 'i_pomade', type: 'product', name: 'Pomade Rambut 100ml', categoryId: 'cat_perawatan_rambut', price: 85000, sku: 'POM-100', barcode: '8991002101017', costPrice: 58000, stock: 24, lowStockThreshold: 6 },
	{ id: 'i_shampoo', type: 'product', name: 'Shampoo Anti Ketombe 250ml', categoryId: 'cat_perawatan_rambut', price: 52000, sku: 'SHM-250', barcode: '8991002101024', costPrice: 35000, stock: 18, lowStockThreshold: 6 },
	{ id: 'i_lilin', type: 'product', name: 'Lilin Rambut 80ml', categoryId: 'cat_perawatan_rambut', price: 35000, sku: 'LIL-080', barcode: '8991002101031', costPrice: 21000, stock: 4, lowStockThreshold: 6 },
	{ id: 'i_pisau', type: 'product', name: 'Pisau Cukur Lukisan', categoryId: 'cat_alat', price: 45000, sku: 'PIS-LK1', barcode: '8991002101048', costPrice: 27000, stock: 31, lowStockThreshold: 10 },
	{ id: 'i_karbon', type: 'product', name: 'Karbon Cukur (5 pcs)', categoryId: 'cat_alat', price: 28000, sku: 'KRB-05', barcode: '8991002101055', costPrice: 17000, stock: 2, lowStockThreshold: 8 }
];

export const SAMPLE_CUSTOMERS: SampleCustomer[] = [
	{ id: 'c_1', name: 'Budi Santoso', phone: '0812-3456-7890', notes: '', visitCount: 12, totalSpent: 1_180_000 },
	{ id: 'c_2', name: 'Rina Kusuma', phone: '0813-9876-5432', notes: '', visitCount: 7, totalSpent: 645_000 },
	{ id: 'c_3', name: 'Agus Salim', phone: '0857-1122-3344', notes: '', visitCount: 4, totalSpent: 310_000 },
	{ id: 'c_4', name: 'Dewi Lestari', phone: null, notes: '', visitCount: 1, totalSpent: 45_000 },
	{ id: 'c_5', name: 'Hendra Gunawan', phone: '0819-5566-7788', notes: '', visitCount: 9, totalSpent: 1_420_000 },
	{ id: 'c_6', name: 'Maya Anggraini', phone: null, notes: '', visitCount: 2, totalSpent: 130_000 },
	{ id: 'c_7', name: 'Fajar Nugroho', phone: '0856-4433-2211', notes: '', visitCount: 3, totalSpent: 275_000 },
	{ id: 'c_8', name: 'Rizky Pratama', phone: null, notes: '', visitCount: 1, totalSpent: 65_000 }
];

export const SAMPLE_APPOINTMENTS: SampleAppointment[] = [
	{ id: 'apt_1', branchId: 'b_sudirman', customerName: 'Budi Santoso', customerPhone: '0812-3456-7890', barberId: 'bar_rahmat', serviceIds: ['i_potong_pria', 'i_cuci'], offsetMin: 15 * 60, durationMin: 45, status: 'booked', notes: 'Potong pendek, jangan terlalu tipis' },
	{ id: 'apt_2', branchId: 'b_sudirman', customerName: 'Hendra Gunawan', customerPhone: '0819-5566-7788', barberId: 'bar_bayu', serviceIds: ['i_coloring'], offsetMin: 16 * 60 + 30, durationMin: 90, status: 'arrived', notes: 'Warna Hitam-doang' },
	{ id: 'apt_3', branchId: 'b_sudirman', customerName: 'Rina Kusuma', customerPhone: '0813-9876-5432', barberId: 'bar_rahmat', serviceIds: ['i_potong_wanita'], offsetMin: 17 * 60, durationMin: 45, status: 'queued', notes: '' },
	{ id: 'apt_4', branchId: 'b_sudirman', customerName: 'Agus Salim', customerPhone: '0857-1122-3344', barberId: 'bar_bayu', serviceIds: ['i_kerok', 'i_creambath'], offsetMin: 14 * 60, durationMin: 70, status: 'in_service', notes: '' },
	{ id: 'apt_5', branchId: 'b_kemang', customerName: 'Fajar Nugroho', customerPhone: '0856-4433-2211', barberId: 'bar_joko', serviceIds: ['i_smoothing'], offsetMin: 11 * 60, durationMin: 120, status: 'booked', notes: 'Datang sore kalau bisa' }
];

export const SAMPLE_SETTINGS: SampleSettings[] = [
	{
		branchId: 'b_sudirman',
		receiptHeader: 'PANGKAS RAMBUT SUDIRMAN\nJl. Sudirman No. 45, Jakarta Pusat\nTelp 021-555-0111',
		receiptFooter: 'Terima kasih sudah mampir!\nBarang yang sudah dibeli tidak dapat ditukar',
		lowStockDefault: 5
	},
	{
		branchId: 'b_kemang',
		receiptHeader: 'PANGKAS RAMBUT KEMANG\nJl. Kemang Raya No. 12, Jakarta Selatan\nTelp 021-555-0222',
		receiptFooter: 'Terima kasih sudah mampir!',
		lowStockDefault: 5
	}
];

/** Barber id derived from the staff id, so both sides stay in sync. */
export function barberIdFor(staffId: string): string {
	return `bar_${staffId.slice(2)}`;
}

/**
 * The instant a sample sale happened.
 *
 * `daysAgo` counts back from the seed day in shop-calendar days, so the
 * dataset spans a week of history no matter where the seed runs. Sales dated
 * today are capped at "now" so the seed never writes a future sale.
 */
export function sampleSaleInstant(now: Date, daysAgo: number, minutesFromMidnight: number): Date {
	const day = businessDayOffset(now, -daysAgo);
	const minutes =
		daysAgo === 0 ? Math.min(minutesFromMidnight, businessMinutesOfDay(now)) : minutesFromMidnight;
	return businessInstant(day, minutes);
}
export function barberIds(): string[] {
	return SAMPLE_STAFF.filter((s) => s.role === 'barber').map((s) => barberIdFor(s.id));
}

/**
 * Deterministic sample sales for the past 7 days.
 *
 * A fixed-seed LCG keeps the dataset identical between the mock seed and the
 * Firestore seed, so reports look the same whichever path populated the data.
 * `now` is passed in rather than read from the clock so callers stay in control.
 */
export function buildSampleSales(now: Date): SampleSale[] {
	let seed = 20261017;
	const rand = () => {
		seed = (seed * 1103515245 + 12345) % 2147483648;
		return seed / 2147483648;
	};
	const pick = <T>(list: T[]): T => list[Math.floor(rand() * list.length)]!;

	const services = SAMPLE_ITEMS.filter((i) => i.type === 'service');
	const products = SAMPLE_ITEMS.filter((i) => i.type === 'product');
	const barbers = barberIds();

	const barberFor = (branchId: string): string => {
		const eligible = barbers.filter((b) => {
			const owner = SAMPLE_STAFF.find((s) => barberIdFor(s.id) === b);
			return owner?.branchIds.includes(branchId);
		});
		return pick(eligible.length > 0 ? eligible : barbers);
	};

	const cashierFor: Record<string, string> = { b_sudirman: 's_sari', b_kemang: 's_andi' };

	const sales: SampleSale[] = [];

	for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
		for (const branch of SAMPLE_BRANCHES) {
			const count = 3 + Math.floor(rand() * 4);

			for (let n = 0; n < count; n++) {
				const day = new Date(now);
				day.setDate(day.getDate() - daysAgo);

				const lines: SampleSaleLine[] = [];
				const primary = pick(services);
				const barber = barberFor(branch.id);
				const pct = primary.commissionPct ?? 40;
				lines.push({
					itemId: primary.id,
					type: 'service',
					name: primary.name,
					qty: 1,
					unitPrice: primary.price,
					discount: 0,
					barberId: barber,
					commissionPct: pct,
					commissionAmount: Math.floor((primary.price * pct) / 100),
					durationMin: primary.durationMin
				});

				if (rand() > 0.55) {
					const extra = pick(services.filter((s) => s.id !== primary.id));
					const second = rand() > 0.7 ? barber : barberFor(branch.id);
					const p2 = extra.commissionPct ?? 40;
					lines.push({
						itemId: extra.id,
						type: 'service',
						name: extra.name,
						qty: 1,
						unitPrice: extra.price,
						discount: 0,
						barberId: second,
						commissionPct: p2,
						commissionAmount: Math.floor((extra.price * p2) / 100),
						durationMin: extra.durationMin
					});
				}

				if (rand() > 0.6) {
					const product = pick(products);
					lines.push({
						itemId: product.id,
						type: 'product',
						name: product.name,
						qty: 1,
						unitPrice: product.price,
						discount: 0
					});
				}

				const subtotal = lines.reduce((sum, l) => sum + l.qty * l.unitPrice - l.discount, 0);
				const method: 'cash' | 'qris' = rand() > 0.45 ? 'cash' : 'qris';
				const tendered = method === 'cash' ? Math.ceil(subtotal / 50000) * 50000 : subtotal;
				const customer = pick(SAMPLE_CUSTOMERS);
				const hour = 10 + Math.floor(rand() * 9);
				const minute = Math.floor(rand() * 60);

				sales.push({
					clientId: `seed_${branch.id}_${daysAgo}_${n}`,
					branchId: branch.id,
					cashierId: cashierFor[branch.id]!,
					customerId: customer.id,
					customerName: customer.name,
					customerPhone: customer.phone,
					daysAgo,
					offsetMin: hour * 60 + minute,
					lines,
					discount: 0,
					paymentMethod: method,
					amountTendered: tendered,
					change: method === 'cash' ? tendered - subtotal : 0,
					qrisRef: method === 'qris' ? `QR${100000 + Math.floor(rand() * 899999)}` : null
				});
			}
		}
	}

	return sales;
}
