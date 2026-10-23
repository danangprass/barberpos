/**
 * Firebase Auth account details for a staff member.
 *
 * There is no server to mint a token, so the PIN *is* the password: Firebase
 * Authentication does the hashing, the salting and the brute-force
 * protection. Nothing about the PIN is ever written to Firestore.
 *
 * The address is derived from the staff id so the client never has to read a
 * credential from the database before signing in.
 */

/** Reserved documentation domain — never resolves, never sends mail. */
export const AUTH_EMAIL_DOMAIN = 'pos.example.com';

export function authEmailFor(staffId: string): string {
	return `${staffId}@${AUTH_EMAIL_DOMAIN}`;
}

/**
 * Firebase Authentication refuses passwords shorter than six characters, so a
 * PIN has to be at least six digits.
 */
export const MIN_PIN_LENGTH = 6;
export const MAX_PIN_LENGTH = 12;
