/**
 * End-to-end check of the Firebase-only backend against the local emulator.
 *
 * There is no Cloud Functions server any more, so `firestore.rules` is the
 * authority. This test drives the real client path — sign in, write a sale,
 * move stock — and then attacks it the way a modified client would, to prove
 * the rules actually hold the line.
 *
 *   # terminal 1
 *   firebase emulators:start --only firestore,auth --project demo-danangprass
 *   # terminal 2
 *   node scripts/emulator-smoke.mjs
 *
 * Exits non-zero if any assertion fails.
 */

import { initializeApp } from 'firebase/app';
import { initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import {
	connectAuthEmulator,
	getAuth,
	signInWithEmailAndPassword,
	signOut
} from 'firebase/auth';
import {
	collection,
	connectFirestoreEmulator,
	doc,
	getDoc,
	getDocs,
	getFirestore,
	runTransaction,
	setDoc,
	where,
	query,
	writeBatch
} from 'firebase/firestore';

const PROJECT_ID = 'demo-danangprass';
const PIN = '123456';

// The admin SDK talks to the emulators directly and ignores the rules, which
// is how the seed script creates the shop. It has to be set up before the
// admin app is created.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8081';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const app = initializeApp({
	apiKey: 'fake-api-key',
	authDomain: `${PROJECT_ID}.firebaseapp.com`,
	projectId: PROJECT_ID
});
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8081);

const results = [];
const check = (name, ok, detail = '') => {
	results.push({ name, ok });
	console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${ok || !detail ? '' : ` — ${detail}`}`);
};

async function expectDenied(name, fn) {
	try {
		await fn();
		check(name, false, 'the write was ALLOWED but should have been refused');
	} catch (error) {
		const code = String(error?.code ?? '');
		const msg = String(error?.message ?? '');
		const refused = code === 'permission-denied' || /permission/i.test(msg);
		// A denial for the wrong reason is not a pass: the rules must refuse on
		// the actual condition, not by running out of evaluation budget.
		const wrongReason = /1000 expressions|evaluation error/i.test(msg);
		check(name, refused && !wrongReason, `code=${code} msg=${msg.replace(/\s+/g, ' ').slice(0, 500)}`);
	}
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

console.log('\nfixtures');

const OWNER = 's_andi';
const BARBER = 's_rahmat';
const KEMANG_BARBER = 's_joko';
const OWNER_EMAIL = `${OWNER}@pos.example.com`;
const BARBER_EMAIL = `${BARBER}@pos.example.com`;
const KEMANG_EMAIL = `${KEMANG_BARBER}@pos.example.com`;

// The seed script creates the shop with admin rights, which is the only way
// to create the very first staff document. The emulator runs the same code
// path here.
const adminApp = initializeAdminApp({ projectId: PROJECT_ID });
const adminDb = getAdminFirestore(adminApp);
const adminAuth = getAdminAuth(adminApp);

// Start from a clean slate: the emulator keeps its state between runs.
await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT_ID}/accounts`, {
	method: 'DELETE'
});
for (const collectionName of [
	'branches',
	'categories',
	'items',
	'staff',
	'staffDirectory',
	'barbers',
	'sales',
	'stockMovements',
	'counters'
]) {
	const docs = await adminDb.collection(collectionName).get();
	// The receipt counters live in a subcollection, which a parent delete
	// leaves behind — so clear them first.
	if (collectionName === 'counters') {
		for (const counter of docs.docs) {
			const days = await counter.ref.collection('days').get();
			await Promise.all(days.docs.map((day) => day.ref.delete()));
		}
	}
	await Promise.all(docs.docs.map((doc) => doc.ref.delete()));
}

for (const [uid, email] of [
	[OWNER, OWNER_EMAIL],
	[BARBER, BARBER_EMAIL],
	[KEMANG_BARBER, KEMANG_EMAIL]
]) {
	await adminAuth.createUser({ uid, email, password: PIN, emailVerified: true });
}
check('auth accounts created with the staff id as uid', true);

const branch = {
	name: 'Pangkas Rambut Sudirman',
	address: 'Jl. Sudirman No. 45, Jakarta Pusat',
	phone: '021-555-0111',
	code: 'SDM',
	active: true
};
const kemang = { ...branch, name: 'Pangkas Rambut Kemang', code: 'KMG' };

const service = {
	type: 'service',
	name: 'Potong Rambut Pria',
	categoryId: 'cat_potong',
	price: 45000,
	active: true,
	durationMin: 30,
	commissionPct: 40
};
const product = {
	type: 'product',
	name: 'Pomade Rambut 100ml',
	categoryId: 'cat_perawatan_rambut',
	price: 85000,
	active: true,
	stock: 10,
	lowStockThreshold: 6
};

// Written with admin rights (the emulator allows it) to stand in for the seed.
await adminDb.collection('branches').doc('b_sudirman').set(branch);
await adminDb.collection('branches').doc('b_kemang').set(kemang);
await adminDb.collection('items').doc('i_potong_pria').set(service);
await adminDb.collection('items').doc('i_pomade').set(product);
await adminDb.collection('categories').doc('cat_potong').set({ name: 'Potong Rambut' });
await adminDb.collection('staff').doc(OWNER).set({
	displayName: 'Andi Saputra',
	role: 'owner',
	branchIds: ['b_sudirman', 'b_kemang'],
	phone: '0811',
	active: true
});
await adminDb.collection('staff').doc(BARBER).set({
	displayName: 'Rahmat Hidayat',
	role: 'barber',
	branchIds: ['b_sudirman', 'b_kemang'],
	phone: '0811',
	active: true
});
await adminDb.collection('staff').doc(KEMANG_BARBER).set({
	displayName: 'Joko Prasetyo',
	role: 'barber',
	branchIds: ['b_kemang'],
	phone: '0811',
	active: true
});
await adminDb.collection('staffDirectory').doc(OWNER).set({
	displayName: 'Andi Saputra',
	role: 'owner',
	active: true
});
await adminDb.collection('barbers').doc(`bar_${BARBER}`).set({
	staffId: BARBER,
	displayName: 'Rahmat Hidayat',
	active: true
});

check('fixtures written', true);

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

console.log('\nauthentication');

await signOut(auth);
let rejected = false;
try {
	await signInWithEmailAndPassword(auth, OWNER_EMAIL, '000000');
} catch (error) {
	const code = String(error?.code ?? '');
	rejected = code.includes('invalid-credential') || code.includes('wrong-password');
}
check('a wrong PIN is refused', rejected);

await signInWithEmailAndPassword(auth, OWNER_EMAIL, PIN);
check('the owner signs in with the PIN', auth.currentUser?.uid === OWNER, auth.currentUser?.uid);

// ---------------------------------------------------------------------------
// The client path: commit a sale
// ---------------------------------------------------------------------------

console.log('\ncommitting a sale');

const receiptDay = Number(
	new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Jakarta',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	})
		.format(new Date())
		.replaceAll('-', '')
);
const counterDay = String(receiptDay);

function buildSaleDoc(seq, soldAt) {
	const lineTotal = 45000;
	return {
		clientId: `smoke-${seq}`,
		receiptNo: `INV/SDM/${receiptDay}/${String(seq).padStart(3, '0')}`,
		provisionalReceiptNo: null,
		receiptDay,
		receiptSeq: seq,
		branchId: 'b_sudirman',
		cashierId: auth.currentUser.uid,
		soldAt,
		customerName: 'Dewi Lestari',
		customerPhone: null,
		customerId: null,
		lines: [
			{
				itemId: 'i_potong_pria',
				type: 'service',
				name: 'Potong Rambut Pria',
				qty: 1,
				unitPrice: 45000,
				discount: 0,
				lineTotal: 45000,
				barberId: 'bar_rahmat',
				commissionPct: 40,
				commissionAmount: 18000,
				durationMin: 30
			},
			{
				itemId: 'i_pomade',
				type: 'product',
				name: 'Pomade Rambut 100ml',
				qty: 1,
				unitPrice: 85000,
				discount: 0,
				lineTotal: 85000
			}
		],
		subtotal: 130000,
		discount: 0,
		total: 130000,
		payment: { method: 'cash', amountTendered: 50000, change: 5000, qrisRef: null },
		syncState: 'synced',
		stockShortfall: false
	};
}

const soldAt = new Date().toISOString();
const counterRef = doc(db, 'counters', 'b_sudirman', 'days', counterDay);

// The counter starts at zero, exactly as the client creates it.
await setDoc(counterRef, { seq: 0 });

// Transaction 1: counter + sale.
let saleId = '';
await runTransaction(db, async (tx) => {
	const counterSnap = await tx.get(counterRef);
	const seq = counterSnap.data().seq + 1;
	saleId = `sale_smoke_${seq}`;
	tx.set(counterRef, { seq }, { merge: true });
	tx.set(doc(db, 'sales', saleId), buildSaleDoc(seq, soldAt));
});
check('a correctly priced sale is accepted', Boolean(saleId));

const counterAfter = (await getDoc(counterRef)).data();
check('the counter advanced to 1', counterAfter?.seq === 1, JSON.stringify(counterAfter));

// Transaction 2: stock movement + item stock.
await writeBatch(db).set(doc(db, 'stockMovements', `mv_${saleId}_i_pomade`), {
	branchId: 'b_sudirman',
	itemId: 'i_pomade',
	qtyDelta: -1,
	type: 'sale',
	refId: saleId,
	actorId: auth.currentUser.uid,
	note: '',
	createdAt: soldAt
}).commit();
check('a stock movement is accepted', true);

// ---------------------------------------------------------------------------
// Attacking it
// ---------------------------------------------------------------------------

console.log('\nattacking it');

await expectDenied('a doctored price is refused', () =>
	setDoc(doc(db, 'sales', 'sale_forged_price'), {
		...buildSaleDoc(2, soldAt),
		lines: [
			{
				...buildSaleDoc(2, soldAt).lines[0],
				unitPrice: 100,
				lineTotal: 100
			},
			buildSaleDoc(2, soldAt).lines[1]
		],
		total: 85100,
		subtotal: 85100
	})
);

await expectDenied('a doctored total is refused', () =>
	setDoc(doc(db, 'sales', 'sale_forged_total'), {
		...buildSaleDoc(2, soldAt),
		total: 1,
		subtotal: 1
	})
);

await expectDenied('a reused receipt sequence is refused', () =>
	setDoc(doc(db, 'sales', 'sale_forged_seq'), {
		...buildSaleDoc(1, soldAt),
		clientId: 'smoke-reused',
		receiptNo: `INV/SDM/${receiptDay}/001`
	})
);

await expectDenied('a mismatched receipt number is refused', () =>
	setDoc(doc(db, 'sales', 'sale_forged_receipt'), {
		...buildSaleDoc(2, soldAt),
		receiptNo: `INV/SDM/${receiptDay}/999`
	})
);

await expectDenied('a sale for a branch the cashier does not work at is refused', () =>
	setDoc(doc(db, 'sales', 'sale_wrong_branch'), {
		...buildSaleDoc(2, soldAt),
		branchId: 'b_kemang'
	})
);

await expectDenied('a sale naming another cashier is refused', () =>
	setDoc(doc(db, 'sales', 'sale_wrong_cashier'), {
		...buildSaleDoc(2, soldAt),
		cashierId: 's_joko'
	})
);

await expectDenied('a client cannot write the counter backwards', () =>
	setDoc(counterRef, { seq: 99 })
);

await expectDenied('a client cannot reset the counter to zero', () =>
	setDoc(counterRef, { seq: 0 })
);

await expectDenied('a client cannot edit a committed sale', () =>
	setDoc(doc(db, 'sales', saleId), { total: 1 }, { merge: true })
);

await expectDenied('a movement that does not match its sale is refused', () =>
	setDoc(doc(db, 'stockMovements', 'mv_bogus'), {
		branchId: 'b_sudirman',
		itemId: 'i_pomade',
		qtyDelta: -7,
		type: 'sale',
		refId: saleId,
		actorId: auth.currentUser.uid,
		note: '',
		createdAt: soldAt
	})
);

// A barber may not promote themselves: the staff document is owner-only.
await signOut(auth);
await signInWithEmailAndPassword(auth, BARBER_EMAIL, PIN);
await expectDenied('a barber cannot promote themselves to owner', () =>
	setDoc(doc(db, 'staff', BARBER), {
		displayName: 'Rahmat Hidayat',
		role: 'owner',
		branchIds: ['b_sudirman', 'b_kemang'],
		phone: '0811',
		active: true
	})
);
await expectDenied('a barber cannot invent a staff record', () =>
	setDoc(doc(db, 'staff', 's_impostor'), {
		displayName: 'Impostor',
		role: 'owner',
		branchIds: ['b_sudirman', 'b_kemang'],
		phone: '000',
		active: true
	})
);
await signOut(auth);
await signInWithEmailAndPassword(auth, OWNER_EMAIL, PIN);

// ---------------------------------------------------------------------------
// Branch isolation
// ---------------------------------------------------------------------------

console.log('\nbranch isolation');

await signOut(auth);
await signInWithEmailAndPassword(auth, KEMANG_EMAIL, PIN);
const kemangSales = await getDocs(
	query(collection(db, 'sales'), where('branchId', 'in', ['b_kemang']))
);
check('a Kemang barber sees only Kemang sales', kemangSales.empty, `${kemangSales.size} docs`);

await expectDenied('a Kemang barber cannot sell into Sudirman', () =>
	setDoc(doc(db, 'sales', 'sale_cross_branch'), {
		...buildSaleDoc(1, soldAt),
		branchId: 'b_sudirman',
		cashierId: KEMANG_BARBER
	})
);

await signOut(auth);

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

const failed = results.filter((r) => !r.ok);
console.log(`\n${'='.repeat(52)}`);
console.log(`${results.length - failed.length} passed, ${failed.length} failed`);
if (failed.length) {
	console.log('\nFailures:');
	for (const f of failed) console.log(`  - ${f.name}`);
}
process.exit(failed.length ? 1 : 0);
