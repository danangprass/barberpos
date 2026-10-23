import { derived, get, writable } from 'svelte/store';
import { staff, staff as staffCollection, branches, refreshAll } from '#lib/data/cache';
import { AuthError, type AuthFailureKind } from '#lib/data/repository';
import { repo } from '#lib/data/index';
import { isBrowser } from '#lib/utils/env';
import type { Barber, Role, Staff } from '#lib/types/domain';
import type { AuthProfile } from '#lib/data/repository';

export const currentStaff = writable<Staff | null>(null);
export const activeBranchId = writable<string | null>(null);
export const sessionReady = writable(false);

/** Outcome of a sign-in attempt, so the UI can tell "wrong PIN" from "no server". */
export type SignInResult = { ok: true } | { ok: false; reason: AuthFailureKind };

/**
 * Multi-branch model: the active branch is a client-side context, not a
 * security boundary. Firestore rules enforce the real per-branch access.
 */
export const session = derived([currentStaff, activeBranchId], ([$staff, $branchId]) => ({
	staff: $staff,
	branchId: $branchId,
	role: $staff?.role ?? null,
	isAuthenticated: $staff !== null,
	roleRank: $staff ? rank($staff.role) : -1
}));

function rank(role: Role): number {
	return role === 'owner' ? 3 : role === 'manager' ? 2 : 1;
}

export const canManageCatalog = derived(session, ($s) => $s.roleRank >= 2);
export const canManageStaff = derived(session, ($s) => $s.roleRank >= 3);
export const canViewAllBranches = derived(session, ($s) => $s.roleRank >= 3);

/** Barbers available for the active branch. */
export function barbersForBranch(all: Barber[], branchId: string | null, allStaff: Staff[]): Barber[] {
	if (!branchId) return [];
	const permitted = new Set(
		allStaff.filter((s) => s.branchIds.includes(branchId)).map((s) => s.id)
	);
	return all.filter((b) => b.active && permitted.has(b.staffId));
}

/**
 * Turn an authenticated profile into the staff shape the UI uses.
 *
 * The Firebase `staff/{id}` document carries no PIN material — that lives in a
 * server-only collection — so `pinHash`/`pinSalt` are simply absent here.
 */
function toStaffRecord(profile: AuthProfile): Staff {
	return {
		id: profile.id,
		displayName: profile.displayName,
		role: profile.role,
		branchIds: profile.branchIds,
		phone: profile.phone,
		active: true
	};
}

/** Restore a previously authenticated session, if the backend still honours it. */
export async function restoreSession(): Promise<void> {
	try {
		const profile = await repo.restoreSession();
		if (profile) {
			currentStaff.set(toStaffRecord(profile));
			const branchId = profile.branchIds[0] ?? null;
			activeBranchId.set(branchId);
			// Reads are branch-scoped, so the data can only be fetched once the
			// session — and therefore the visible branches — is known.
			await refreshAll();
		}
	} catch {
		// A failed restore is not fatal — the user simply signs in again.
		currentStaff.set(null);
	} finally {
		sessionReady.set(true);
	}
}

export function setActiveBranch(branchId: string): void {
	// `$` is reserved in .svelte.ts modules — plain names here.
	const person = get(currentStaff);
	if (person && person.branchIds.includes(branchId)) {
		activeBranchId.set(branchId);
	}
}

/**
 * PIN sign-in. The staff member is picked explicitly on screen, so the PIN is
 * checked only against that record — no enumeration surface, and switching
 * users on a shared till is a two-step tap.
 *
 * On Firebase the PIN is verified by a Cloud Function; the client never
 * computes or compares a hash.
 */
export async function signIn(staffId: string, pin: string): Promise<SignInResult> {
	try {
		const profile = await repo.authenticate(staffId, pin);
		currentStaff.set(toStaffRecord(profile));
		const branch = get(activeBranchId);
		if (!branch || !profile.branchIds.includes(branch)) {
			activeBranchId.set(profile.branchIds[0] ?? null);
		}
		// The boot read happened before sign-in, when nothing was visible.
		await refreshAll();
		return { ok: true };
	} catch (error) {
		const kind = error instanceof AuthError ? error.kind : 'server';
		return { ok: false, reason: kind };
	}
}

export async function signOut(): Promise<void> {
	try {
		await repo.signOut();
	} finally {
		currentStaff.set(null);
		if (isBrowser) localStorage.removeItem('pos.session');
	}
}

/** Keep the cached staff record fresh after an edit (role change, PIN reset). */
export function syncStaffRecord(record: Staff): void {
	if (get(currentStaff)?.id === record.id) currentStaff.set(record);
}

export { branches };
