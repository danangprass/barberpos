import type { Rupiah } from '#lib/types/domain';
import { BUSINESS_TIME_ZONE, businessDayKey } from '#shared/time';

/** "Rp 75.000" — Indonesian grouping, no decimals. */
export function formatIDR(value: Rupiah): string {
	const negative = value < 0;
	const digits = Math.abs(Math.round(value)).toString();
	let grouped = '';
	for (let i = 0; i < digits.length; i++) {
		const fromEnd = digits.length - i;
		grouped += digits[i];
		if (fromEnd > 1 && fromEnd % 3 === 1) grouped += '.';
	}
	return `${negative ? '-' : ''}Rp ${grouped}`;
}

/** Compact form for dense tables: "75rb". */
export function formatIDRCompact(value: Rupiah): string {
	const abs = Math.abs(value);
	if (abs >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1).replace('.0', '')}jt`;
	if (abs >= 1_000) return `Rp ${Math.round(value / 1_000)}rb`;
	return formatIDR(value);
}

export function formatNumber(value: number, locale = 'id-ID'): string {
	return new Intl.NumberFormat(locale).format(value);
}

/**
 * Key used to bucket sales into shop calendar days: "2026-10-17".
 *
 * The shop runs on Jakarta time, so this follows the business timezone rather
 * than the device or the server clock — otherwise a sale made shortly after
 * midnight would land in yesterday's bucket and its receipt number would
 * disagree with the date printed on it.
 */
export function dayKey(iso: string): string {
	return businessDayKey(iso);
}

/** Placeholder for a timestamp that cannot be read. */
const EMPTY = '—';

export function formatDate(iso: string, locale = 'id-ID'): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return EMPTY;
	return new Intl.DateTimeFormat(locale, {
		timeZone: BUSINESS_TIME_ZONE,
		day: '2-digit',
		month: 'short',
		year: 'numeric'
	}).format(date);
}

export function formatTime(iso: string, locale = 'id-ID'): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return EMPTY;
	return new Intl.DateTimeFormat(locale, {
		timeZone: BUSINESS_TIME_ZONE,
		hour: '2-digit',
		minute: '2-digit'
	}).format(date);
}

export function formatDateTime(iso: string, locale = 'id-ID'): string {
	return `${formatDate(iso, locale)} ${formatTime(iso, locale)}`;
}

/** Compact duration for the queue board: 90 -> "1j 30m". */
export function formatDuration(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	if (h === 0) return `${m}m`;
	if (m === 0) return `${h}j`;
	return `${h}j ${m}m`;
}

/** Compact relative age for the outbox indicator: 4m, 2j. */
export function formatAge(ms: number): string {
	const minutes = Math.floor(ms / 60_000);
	if (minutes < 1) return 'now';
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}j`;
	return `${Math.floor(hours / 24)}d`;
}

/** Add minutes to an ISO timestamp. */
export function addMinutes(iso: string, minutes: number): string {
	return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

export function uid(prefix = ''): string {
	const rand =
		typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID().slice(0, 8)
			: Math.random().toString(36).slice(2, 10);
	return `${prefix}${Date.now().toString(36)}${rand}`;
}

export function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}