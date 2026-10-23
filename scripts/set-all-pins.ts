/**
 * Sets the PIN for every staff member in Firebase Authentication.
 *
 * The PIN is the account password, so this is a password change for each
 * account. It runs with admin access, which is why it is a script on the shop
 * owner's computer rather than a button in the app: a browser cannot change
 * somebody else's password.
 *
 *   node scripts/set-all-pins.ts
 *   node scripts/set-all-pins.ts 4321
 *
 * Run `firebase login` first. Existing accounts are updated; missing ones are
 * created.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initializeApp, type App } from 'firebase-admin/app';
import { applicationDefault, getApps } from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { SAMPLE_STAFF } from '../shared/sample-data.ts';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'danangprass-777';
const PIN = process.argv[2] ?? process.env.SEED_PIN ?? '123456';
const AUTH_EMAIL_DOMAIN = 'pos.example.com';

const CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

function readCliCredentials(): { refresh_token?: string } {
	const candidates = [
		path.join(os.homedir(), '.config/configstore/firebase-tools.json'),
		path.join(os.homedir(), 'Library/Application Support/configstore/firebase-tools.json')
	];
	for (const file of candidates) {
		if (fs.existsSync(file)) {
			return JSON.parse(fs.readFileSync(file, 'utf8')) as { refresh_token?: string };
		}
	}
	throw new Error(
		'Firebase CLI credentials not found. Run `firebase login` first, then re-run this script.'
	);
}

function useCliCredentials(): void {
	const refreshToken = readCliCredentials().refresh_token;
	if (!refreshToken) {
		throw new Error(
			'No refresh token in the Firebase CLI credential store. Run `firebase login` and retry.'
		);
	}
	const file = path.join(os.tmpdir(), `firebase-pins-${process.pid}-${Date.now()}.json`);
	fs.writeFileSync(
		file,
		JSON.stringify({
			type: 'authorized_user',
			client_id: CLI_CLIENT_ID,
			client_secret: CLI_CLIENT_SECRET,
			refresh_token: refreshToken
		}),
		{ mode: 0o600 }
	);
	process.env.GOOGLE_APPLICATION_CREDENTIALS = file;
	process.on('exit', () => fs.rmSync(file, { force: true }));
}

function adminApp(): App {
	if (getApps().length > 0) return getApps()[0]!;
	return initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
}

async function main(): Promise<void> {
	if (!/^\d{6,}$/.test(PIN)) {
		throw new Error('PIN harus minimal 6 digit (persyaratan Firebase Authentication).');
	}

	useCliCredentials();
	const auth = getAuth(adminApp());

	let created = 0;
	let updated = 0;
	for (const person of SAMPLE_STAFF) {
		const email = `${person.id}@${AUTH_EMAIL_DOMAIN}`;
		try {
			await auth.createUser({
				uid: person.id,
				email,
				password: PIN,
				emailVerified: true,
				displayName: person.displayName
			});
			created += 1;
		} catch (error) {
			const code = (error as { code?: string })?.code ?? '';
			if (!code.includes('EMAIL_EXISTS') && !code.includes('already exists')) throw error;
			await auth.updateUser(person.id, { password: PIN, emailVerified: true });
			updated += 1;
		}
	}

	console.log(`PIN ${PIN} disetel untuk ${SAMPLE_STAFF.length} staf di ${PROJECT_ID}`);
	console.log(`  ${created} akun dibuat, ${updated} diperbarui`);
}

main().then(
	() => process.exit(0),
	(error) => {
		console.error('Failed:', error?.message ?? error);
		process.exit(1);
	}
);
