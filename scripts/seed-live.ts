/**
 * Seeds the live Firebase project with the sample shop.
 *
 * There is no Cloud Functions server, so this script does the work that a
 * `seedDemoData` callable would do — and additionally creates the Firebase
 * Authentication accounts, because a browser cannot create accounts for other
 * people.
 *
 *   node scripts/seed-live.ts
 *   SEED_PIN=4321 node scripts/seed-live.ts
 *
 * It uses the credentials the Firebase CLI already holds, so no service
 * account key has to be downloaded. Run `firebase login` first.
 *
 * It refuses to run when the database already holds staff, so it can never
 * overwrite a live shop.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initializeApp, type App } from 'firebase-admin/app';
import { applicationDefault, getApps } from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { buildSeedData, type SeedData, type SeedDoc } from '../shared/seed-data.ts';
import { SAMPLE_STAFF } from '../shared/sample-data.ts';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'danangprass-777';
const PIN = process.env.SEED_PIN ?? '123456';
const AUTH_EMAIL_DOMAIN = 'pos.example.com';

/** The Firebase CLI's public OAuth client — the same one every install uses. */
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

/**
 * The admin SDK only accepts a certificate or Application Default Credentials,
 * so the CLI's refresh token is written out in the authorized-user shape that
 * ADC understands. The file holds a live credential: it is written with
 * owner-only permissions and deleted as soon as the seed finishes.
 */
function useCliCredentials(): void {
	const refreshToken = readCliCredentials().refresh_token;
	if (!refreshToken) {
		throw new Error(
			'No refresh token in the Firebase CLI credential store. Run `firebase login` and retry.'
		);
	}
	const file = path.join(os.tmpdir(), `firebase-seed-${process.pid}-${Date.now()}.json`);
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

function authEmailFor(staffId: string): string {
	return `${staffId}@${AUTH_EMAIL_DOMAIN}`;
}

/** Writes a list of documents to one collection. */
async function writeCollection(
	db: ReturnType<typeof getFirestore>,
	collection: string,
	docs: SeedDoc[]
): Promise<void> {
	if (docs.length === 0) return;
	const batch = db.batch();
	for (const doc of docs) {
		batch.set(db.collection(collection).doc(doc.id), doc.data);
	}
	await batch.commit();
}

async function main(): Promise<void> {
	if (!/^\d{6,}$/.test(PIN)) {
		throw new Error('PIN harus minimal 6 digit (persyaratan Firebase Authentication).');
	}

	useCliCredentials();
	const app = adminApp();
	const db = getFirestore(app);
	const auth = getAuth(app);

	const existing = await db.collection('staff').limit(1).get();
	if (!existing.empty) {
		throw new Error(
			'Database sudah berisi data staf. Hapus data secara manual bila ingin mengimpor ulang.'
		);
	}

	const seed: SeedData = buildSeedData(new Date());

	// --- Firebase Authentication accounts ------------------------------------
	// The PIN is the password: Firebase stores a salted hash, so the PIN
	// itself never reaches Firestore.
	let created = 0;
	let updated = 0;
	for (const person of SAMPLE_STAFF) {
		const email = authEmailFor(person.id);
		try {
			await auth.createUser({
				uid: person.id,
				email,
				password: PIN,
				emailVerified: true,
				displayName: person.displayName,
				disabled: false
			});
			created += 1;
		} catch (error) {
			const code = (error as { code?: string })?.code ?? '';
			if (!code.includes('EMAIL_EXISTS') && !code.includes('already exists')) throw error;
			await auth.updateUser(person.id, { password: PIN, emailVerified: true });
			updated += 1;
		}
	}

	// --- Firestore ----------------------------------------------------------
	await writeCollection(db, 'branches', seed.branches);
	await writeCollection(db, 'categories', seed.categories);
	await writeCollection(db, 'items', seed.items);
	await writeCollection(db, 'settings', seed.settings);
	await writeCollection(db, 'staff', seed.staff);
	await writeCollection(db, 'staffDirectory', seed.staffDirectory);
	await writeCollection(db, 'barbers', seed.barbers);
	await writeCollection(db, 'customers', seed.customers);
	await writeCollection(db, 'appointments', seed.appointments);
	await writeCollection(db, 'sales', seed.sales);

	const counterBatch = db.batch();
	for (const [key, value] of Object.entries(seed.counters)) {
		// The key is `branchId_yyyymmdd`; the counter lives in a subcollection
		// so the branch is the parent and never has to be parsed out of an id.
		const separator = key.lastIndexOf('_');
		const branchId = key.slice(0, separator);
		const day = key.slice(separator + 1);
		counterBatch.set(
			db.collection('counters').doc(branchId).collection('days').doc(day),
			{ seq: value.seq, code: value.code }
		);
	}
	await counterBatch.commit();

	console.log(`Seeded ${PROJECT_ID}`);
	console.log(
		`  ${seed.counts.branches} cabang · ${seed.counts.staff} staf · ${seed.counts.items} item · ` +
			`${seed.counts.customers} pelanggan · ${seed.counts.appointments} janji temu · ` +
			`${seed.counts.sales} transaksi`
	);
	console.log(`  Auth: ${created} akun dibuat, ${updated} diperbarui (PIN ${PIN})`);
}

main().then(
	() => process.exit(0),
	(error) => {
		console.error('Seed failed:', error?.message ?? error);
		process.exit(1);
	}
);
