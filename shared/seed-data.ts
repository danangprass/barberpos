/**
 * The canonical sample shop.
 *
 * One builder, two consumers: the mock repository (IndexedDB) and the live
 * seed script (Firestore + Firebase Authentication). Both produce the same
 * shop, which is what keeps the demo identical in either mode.
 *
 * Deliberately dependency-free and free of any Firebase import, so it runs
 * unchanged in the browser build, in Node, and in the emulator.
 */

import {
	BRANCH_CODES,
	SAMPLE_APPOINTMENTS,
	SAMPLE_BRANCHES,
	SAMPLE_CATEGORIES,
	SAMPLE_CUSTOMERS,
	SAMPLE_ITEMS,
	SAMPLE_SETTINGS,
	SAMPLE_STAFF,
	barberIdFor,
	buildSampleSales,
	sampleSaleInstant
} from './sample-data.ts';
import { businessDayKey, businessDayStamp, businessInstant } from './time.ts';

export interface SeedDoc {
	id: string;
	data: Record<string, unknown>;
}

export interface SeedData {
	branches: SeedDoc[];
	categories: SeedDoc[];
	items: SeedDoc[];
	staff: SeedDoc[];
	staffDirectory: SeedDoc[];
	barbers: SeedDoc[];
	customers: SeedDoc[];
	appointments: SeedDoc[];
	sales: SeedDoc[];
	settings: SeedDoc[];
	/** Receipt counters, keyed `branchId_yyyymmdd`: the sequence and the code. */
	counters: Record<string, { seq: number; code: string }>;
	counts: {
		branches: number;
		staff: number;
		items: number;
		customers: number;
		appointments: number;
		sales: number;
	};
}

/**
 * Builds the sample shop.
 *
 * `now` decides which shop day the sample appointments and the most recent
 * sales land on, so the demo always looks alive.
 */
export function buildSeedData(now = new Date()): SeedData {
	const branches: SeedDoc[] = SAMPLE_BRANCHES.map((branch) => ({
		id: branch.id,
		data: { ...branch, code: BRANCH_CODES[branch.id]!, active: true }
	}));

	const categories: SeedDoc[] = SAMPLE_CATEGORIES.map((category) => ({
		id: category.id,
		data: { ...category }
	}));

	const items: SeedDoc[] = SAMPLE_ITEMS.map((item) => ({
		id: item.id,
		data: { ...item, active: true }
	}));

	const settings: SeedDoc[] = SAMPLE_SETTINGS.map((setting) => ({
		id: setting.branchId,
		data: { ...setting }
	}));

	// --- staff -------------------------------------------------------------
	const staff: SeedDoc[] = [];
	const staffDirectory: SeedDoc[] = [];
	const barbers: SeedDoc[] = [];

	for (const person of SAMPLE_STAFF) {
		// The public half: profile and access, no secrets. The PIN itself lives
		// in Firebase Authentication, never in Firestore.
		staff.push({
			id: person.id,
			data: {
				displayName: person.displayName,
				role: person.role,
				branchIds: person.branchIds,
				phone: person.phone,
				active: true
			}
		});

		// Readable before authentication so the login picker can list staff.
		staffDirectory.push({
			id: person.id,
			data: {
				displayName: person.displayName,
				role: person.role,
				active: true
			}
		});

		if (person.role === 'barber') {
			barbers.push({
				id: barberIdFor(person.id),
				data: {
					staffId: person.id,
					displayName: person.displayName,
					active: true
				}
			});
		}
	}

	// --- customers ---------------------------------------------------------
	const customers: SeedDoc[] = SAMPLE_CUSTOMERS.map((customer) => ({
		id: customer.id,
		data: {
			name: customer.name,
			phone: customer.phone,
			notes: customer.notes,
			visitCount: customer.visitCount,
			totalSpent: customer.totalSpent,
			lastVisitAt: null,
			createdAt: now.toISOString()
		}
	}));

	// --- appointments ------------------------------------------------------
	const appointments: SeedDoc[] = SAMPLE_APPOINTMENTS.map((appointment) => {
		const scheduled = businessInstant(businessDayKey(now), appointment.offsetMin);
		return {
			id: appointment.id,
			data: {
				branchId: appointment.branchId,
				customerName: appointment.customerName,
				customerPhone: appointment.customerPhone,
				barberId: appointment.barberId,
				serviceIds: appointment.serviceIds,
				scheduledAt: scheduled.toISOString(),
				durationMin: appointment.durationMin,
				status: appointment.status,
				notes: appointment.notes,
				createdBy: 's_andi',
				createdAt: now.toISOString()
			}
		};
	});

	// --- sample sales ------------------------------------------------------
	const sampleSales = buildSampleSales(now);
	/** Receipt sequences restart every shop day, so they are keyed per branch+day. */
	const perBranchSeq: Record<string, { seq: number; code: string }> = {};
	const sales: SeedDoc[] = [];

	for (const sample of sampleSales) {
		const soldAtIso = sampleSaleInstant(now, sample.daysAgo, sample.offsetMin).toISOString();
		const dayStamp = businessDayStamp(soldAtIso);

		const seqKey = `${sample.branchId}_${dayStamp}`;
		const branchCode = BRANCH_CODES[sample.branchId] ?? 'XXX';
		const seq = (perBranchSeq[seqKey]?.seq ?? 0) + 1;
		perBranchSeq[seqKey] = { seq, code: branchCode };
		const receiptNo = `INV/${branchCode}/${dayStamp}/${String(seq).padStart(3, '0')}`;

		const lines = sample.lines.map((line) => {
			const lineTotal = line.qty * line.unitPrice - line.discount;
			return {
				itemId: line.itemId,
				type: line.type,
				name: line.name,
				qty: line.qty,
				unitPrice: line.unitPrice,
				discount: line.discount,
				lineTotal,
				...(line.barberId
					? {
							barberId: line.barberId,
							commissionPct: line.commissionPct ?? 0,
							commissionAmount:
								line.commissionAmount ?? Math.floor((lineTotal * (line.commissionPct ?? 0)) / 100),
							durationMin: line.durationMin ?? 0
						}
					: {})
			};
		});

		const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);

		sales.push({
			id: `seed_${sample.clientId}`,
			data: {
				clientId: sample.clientId,
				receiptNo,
				provisionalReceiptNo: null,
				receiptDay: Number(dayStamp),
				receiptSeq: seq,
				branchId: sample.branchId,
				cashierId: sample.cashierId,
				soldAt: soldAtIso,
				customerName: sample.customerName,
				customerPhone: sample.customerPhone,
				customerId: sample.customerId,
				lines,
				subtotal,
				discount: sample.discount,
				total: subtotal - sample.discount,
				payment: {
					method: sample.paymentMethod,
					amountTendered: sample.amountTendered,
					change: sample.change,
					qrisRef: sample.qrisRef
				},
				syncState: 'synced',
				stockShortfall: false
			}
		});
	}

	return {
		branches,
		categories,
		items,
		staff,
		staffDirectory,
		barbers,
		customers,
		appointments,
		sales,
		settings,
		counters: perBranchSeq,
		counts: {
			branches: branches.length,
			staff: staff.length,
			items: items.length,
			customers: customers.length,
			appointments: appointments.length,
			sales: sales.length
		}
	};
}
