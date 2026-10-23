import type { Sale, Rupiah } from '#lib/types/domain';
import { dayKey } from './format';

/**
 * Receipt numbering is server-authoritative: `INV/{YYYYMMDD}/{seq}` scoped per
 * branch. While offline the client can only mint a provisional local number,
 * and `assignReceiptNo` replaces it once sync succeeds.
 */
export function buildReceiptNo(branchCode: string, dateIso: string, seq: number): string {
	const ymd = dayKey(dateIso).replaceAll('-', '');
	return `INV/${branchCode}/${ymd}/${String(seq).padStart(3, '0')}`;
}

export function buildProvisionalReceiptNo(deviceId: string, seq: number): string {
	return `OFFLINE/${deviceId}/${String(seq).padStart(4, '0')}`;
}

/** Next sequential receipt number for a branch/day, given existing sales. */
export function nextReceiptSeq(sales: Sale[], branchId: string, dateIso: string): number {
	const sameDay = sales.filter((s) => s.branchId === branchId && dayKey(s.soldAt) === dayKey(dateIso));
	return sameDay.length + 1;
}

export function saleSubtotal(lines: { qty: number; unitPrice: number; discount: number }[]): Rupiah {
	return lines.reduce((sum, l) => sum + l.qty * l.unitPrice - l.discount, 0);
}

/** Commission on a service line, rounded down to whole rupiah. */
export function commissionAmount(lineTotal: Rupiah, pct: number): Rupiah {
	return Math.floor((lineTotal * pct) / 100);
}

export function countServices(lines: { type: string }[]): number {
	return lines.filter((l) => l.type === 'service').length;
}