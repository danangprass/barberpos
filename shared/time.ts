/**
 * Business-time helpers shared by the browser and the Cloud Functions.
 *
 * The shop keeps Jakarta time (WIB). Every day boundary — daily reports,
 * "today" filters, receipt numbering, appointment days — must follow the
 * shop's calendar, not whichever clock the host happens to run on. The
 * browser may sit in WIB while Cloud Functions run in UTC, and the two must
 * still agree on which day a sale belongs to.
 *
 * Everything here is instant-based: an ISO timestamp in, a shop-local wall
 * clock out. Nothing reads the host clock except the caller that passes the
 * instant in.
 */

/** The shop's timezone. Jakarta has no DST, so the offset is a flat +07:00. */
export const BUSINESS_TIME_ZONE = 'Asia/Jakarta';

const ZONE_PARTS = new Intl.DateTimeFormat('en-US', {
	timeZone: BUSINESS_TIME_ZONE,
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	hourCycle: 'h23'
});

function toDate(value: Date | string | number): Date {
	return value instanceof Date ? value : new Date(value);
}

function partsOf(date: Date): Record<string, string> {
	// An invalid date would make Intl throw, and a thrown formatter should
	// never be able to take a whole screen down.
	if (Number.isNaN(date.getTime())) return {};
	const out: Record<string, string> = {};
	for (const part of ZONE_PARTS.formatToParts(date)) out[part.type] = part.value;
	return out;
}

/** Offset of the business zone from UTC at that instant, in milliseconds. */
function zoneOffsetMs(at: Date): number {
	const p = partsOf(at);
	const asUtc = Date.UTC(
		Number(p.year),
		Number(p.month) - 1,
		Number(p.day),
		Number(p.hour) % 24,
		Number(p.minute),
		Number(p.second)
	);
	return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** The shop's calendar day for an instant: "2026-10-22". Empty if unusable. */
export function businessDayKey(value: Date | string | number): string {
	const p = partsOf(toDate(value));
	if (!p.year || !p.month || !p.day) return '';
	return `${p.year}-${p.month}-${p.day}`;
}

/** The shop's calendar day for an instant, compact: "20261022". Empty if unusable. */
export function businessDayStamp(value: Date | string | number): string {
	return businessDayKey(value).replaceAll('-', '');
}

/**
 * The shop's calendar day for an instant, shifted by whole days.
 *
 * Shifting happens on the calendar, not on the 24-hour instant, so a day
 * always stays a day across the offset boundary.
 */
export function businessDayOffset(value: Date | string | number, days: number): string {
	const p = partsOf(toDate(value));
	if (!p.year || !p.month || !p.day) return '';
	const base = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day));
	const shifted = new Date(base + days * 86_400_000);
	const sp = partsOf(shifted);
	return `${sp.year}-${sp.month}-${sp.day}`;
}

/**
 * The instant at which the shop's wall clock reads the given day and
 * time-of-day.
 *
 * Both seeds call this, so the browser and the Cloud Function produce
 * byte-identical timestamps for the same sample sale no matter which timezone
 * the host runs in.
 */
export function businessInstant(dayKey: string, minutesFromMidnight: number): Date {
	const [y, m, d] = dayKey.split('-').map(Number);
	const minutes = ((minutesFromMidnight % 1440) + 1440) % 1440;
	const wallAsUtc = Date.UTC(y!, m! - 1, d!, Math.floor(minutes / 60), minutes % 60);

	// Two passes settle the offset for zones whose offset shifts around the
	// target instant.
	let guess = new Date(wallAsUtc);
	for (let i = 0; i < 2; i++) guess = new Date(wallAsUtc - zoneOffsetMs(guess));
	return guess;
}

/** Minutes since shop midnight for an instant. 0 if the instant is unusable. */
export function businessMinutesOfDay(value: Date | string | number): number {
	const p = partsOf(toDate(value));
	if (!p.hour) return 0;
	return (Number(p.hour) % 24) * 60 + Number(p.minute);
}

/** "YYYY-MM-DDTHH:mm" in shop time — the shape a datetime-local input wants. */
export function toBusinessInputValue(value: Date | string | number): string {
	const date = toDate(value);
	const p = partsOf(date);
	if (!p.year || !p.day) return '';
	const minutes = businessMinutesOfDay(date);
	const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
	const mm = String(minutes % 60).padStart(2, '0');
	return `${p.year}-${p.month}-${p.day}T${hh}:${mm}`;
}

/** Parses a "YYYY-MM-DDTHH:mm" shop-time value back into an instant. */
export function fromBusinessInputValue(value: string): Date {
	const [dayKey = '', time = '00:00'] = value.split('T');
	const [hh = '0', mm = '0'] = time.split(':');
	return businessInstant(dayKey, Number(hh) * 60 + Number(mm));
}
