import type { Barber, Item, PaymentMethod, Rupiah, Sale } from '#lib/types/domain';
import { dayKey } from '#lib/utils/format';

export interface SalesFilter {
	/** Empty means all branches the viewer can see. */
	branchIds: string[];
	/** Local calendar day, "YYYY-MM-DD". */
	day?: string;
}

export function filterSales(all: Sale[], filter: SalesFilter): Sale[] {
	return all.filter((s) => {
		if (filter.branchIds.length > 0 && !filter.branchIds.includes(s.branchId)) return false;
		if (filter.day && dayKey(s.soldAt) !== filter.day) return false;
		return true;
	});
}

export interface SalesSummary {
	gross: Rupiah;
	discount: Rupiah;
	count: number;
	avgTicket: Rupiah;
	serviceCount: number;
	productCount: number;
	byMethod: Record<PaymentMethod, { count: number; total: Rupiah }>;
}

export function summarize(sales: Sale[]): SalesSummary {
	const summary: SalesSummary = {
		gross: 0,
		discount: 0,
		count: sales.length,
		avgTicket: 0,
		serviceCount: 0,
		productCount: 0,
		byMethod: {
			cash: { count: 0, total: 0 },
			qris: { count: 0, total: 0 }
		}
	};

	for (const sale of sales) {
		summary.gross += sale.total;
		summary.discount += sale.discount;
		summary.byMethod[sale.payment.method].count += 1;
		summary.byMethod[sale.payment.method].total += sale.total;
		for (const line of sale.lines) {
			if (line.type === 'service') summary.serviceCount += line.qty;
			else summary.productCount += line.qty;
		}
	}

	summary.avgTicket = sales.length === 0 ? 0 : Math.round(summary.gross / sales.length);
	return summary;
}

export interface BarberStat {
	barberId: string;
	name: string;
	jobs: number;
	revenue: Rupiah;
	commission: Rupiah;
}

/**
 * Earnings are summed per *line*, which is what allows one sale to pay two
 * barbers. Percentages are averaged from the lines themselves, not from the
 * sale totals, so a discounted line pays commission on what was actually charged.
 */
export function barberPerformance(sales: Sale[], barbers: Barber[]): BarberStat[] {
	const map = new Map<string, BarberStat>();
	const nameOf = new Map(barbers.map((b) => [b.id, b.displayName]));

	for (const sale of sales) {
		for (const line of sale.lines) {
			if (line.type !== 'service' || !line.barberId) continue;
			const stat =
				map.get(line.barberId) ??
				({ barberId: line.barberId, name: nameOf.get(line.barberId) ?? '—', jobs: 0, revenue: 0, commission: 0 });
			stat.jobs += line.qty;
			stat.revenue += line.lineTotal;
			stat.commission += line.commissionAmount ?? 0;
			map.set(line.barberId, stat);
		}
	}

	return [...map.values()].sort((a, b) => b.commission - a.commission);
}

export interface ItemStat {
	itemId: string;
	name: string;
	type: 'service' | 'product';
	qty: number;
	revenue: Rupiah;
}

export function topItems(sales: Sale[], type: 'service' | 'product', limit = 10): ItemStat[] {
	const map = new Map<string, ItemStat>();

	for (const sale of sales) {
		for (const line of sale.lines) {
			if (line.type !== type) continue;
			const stat =
				map.get(line.itemId) ??
				({ itemId: line.itemId, name: line.name, type, qty: 0, revenue: 0 });
			stat.qty += line.qty;
			stat.revenue += line.lineTotal;
			map.set(line.itemId, stat);
		}
	}

	return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, limit);
}

export interface BranchStat {
	branchId: string;
	name: string;
	count: number;
	gross: Rupiah;
	avgTicket: Rupiah;
}

/** Multi-branch rollup — owner only. */
export function byBranch(sales: Sale[], branchNames: Map<string, string>): BranchStat[] {
	const map = new Map<string, BranchStat>();

	for (const sale of sales) {
		const stat =
			map.get(sale.branchId) ??
			({
				branchId: sale.branchId,
				name: branchNames.get(sale.branchId) ?? sale.branchId,
				count: 0,
				gross: 0,
				avgTicket: 0
			});
		stat.count += 1;
		stat.gross += sale.total;
		map.set(sale.branchId, stat);
	}

	return [...map.values()]
		.map((s) => ({ ...s, avgTicket: s.count === 0 ? 0 : Math.round(s.gross / s.count) }))
		.sort((a, b) => b.gross - a.gross);
}

export function lowStockItems(items: Item[], defaultThreshold = 5): Item[] {
	return items.filter(
		(i) => i.type === 'product' && i.active && (i.stock ?? 0) <= (i.lowStockThreshold ?? defaultThreshold)
	);
}

/** Rows shaped for CSV export, already escaped. */
export function salesCsv(sales: Sale[], branchNames: Map<string, string>): string {
	const header = ['receipt_no', 'date', 'branch', 'cashier', 'customer', 'payment', 'total', 'items'];
	const rows = sales.map((s) => [
		s.receiptNo,
		s.soldAt,
		branchNames.get(s.branchId) ?? s.branchId,
		s.cashierId,
		s.customerName,
		s.payment.method,
		String(s.total),
		s.lines.map((l) => `${l.qty}x ${l.name}`).join(' | ')
	]);
	return toCsv([header, ...rows]);
}

export function toCsv(rows: string[][]): string {
	return rows
		.map((row) => row.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell)).join(','))
		.join('\n');
}

export function downloadCsv(filename: string, content: string): void {
	// BOM keeps Excel from mangling UTF-8 shop names on open.
	const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}