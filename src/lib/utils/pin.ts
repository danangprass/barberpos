/**
 * PIN handling.
 *
 * PINs are salted + SHA-256 hashed and never persisted in plaintext. Web Crypto
 * requires a secure context, so this works on localhost and on Firebase Hosting
 * (https) but not over plain http on a LAN IP.
 */

const enc = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
	return Array.from(new Uint8Array(buffer))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export function generateSalt(): string {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return toHex(bytes.buffer);
}

export async function hashPin(pin: string, salt: string): Promise<string> {
	const data = enc.encode(`pos:${salt}:${pin}`);
	const digest = await crypto.subtle.digest('SHA-256', data);
	return toHex(digest);
}

export async function verifyPin(pin: string, salt: string, expectedHash: string): Promise<boolean> {
	const actual = await hashPin(pin, salt);
	// Constant-time-ish comparison; avoids leaking length or early mismatch.
	if (actual.length !== expectedHash.length) return false;
	let diff = 0;
	for (let i = 0; i < actual.length; i++) {
		diff |= actual.charCodeAt(i) ^ expectedHash.charCodeAt(i);
	}
	return diff === 0;
}

export function isValidPin(pin: string): boolean {
	return /^\d{4,6}$/.test(pin);
}