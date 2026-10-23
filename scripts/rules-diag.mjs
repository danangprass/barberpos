/**
 * Diagnostic — mirrors the real client flow exactly.
 * Temporary.
 */

import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
	connectFirestoreEmulator,
	doc,
	getDoc,
	getFirestore,
	runTransaction,
	setDoc,
	writeBatch
} from 'firebase/firestore';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8081';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const { initializeApp: initializeAdminApp } = await import('firebase-admin/app');
const { getFirestore: getAdminFirestore } = await import('firebase-admin/firestore');
const { getAuth: getAdminAuth } = await import('firebase-admin/auth');

const app = initializeApp({
	apiKey: 'fake',
	authDomain: 'demo-danangprass.firebaseapp.com',
	projectId: 'demo-danangprass'
});
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8081);
const adminApp = initializeAdminApp({ projectId: 'demo-danangprass' });
const adminDb = getAdminFirestore(adminApp);
const adminAuth = getAdminAuth(adminApp);

const OWNER = 's_andi';
const BARBER = 's_rahmat';
const CODE = 'SDM';
const DAY = '20261023';

for (const uid of [OWNER, BARBER]) {
	try {
		await adminAuth.createUser({ uid, email: `${uid}@pos.example.com`, password: '123456' });
	} catch {
		/* exists */
	}
}
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
	branchIds: ['b_sudirman'],
	phone: '0812',
	active: true
});
await adminDb.collection('branches').doc('b_sudirman').set({ code: CODE, active: true });
await adminDb.collection('items').doc('i_svc').set({
	type: 'service',
	name: 'Svc',
	price: 45000,
	active: true,
	durationMin: 30,
	commissionPct: 40
});
await adminDb.collection('items').doc('i_pom').set({
	type: 'product',
	name: 'Pom',
	price: 85000,
	active: true,
	stock: 10
});

async function step(label, fn) {
	console.log(`\n>>> ${label}`);
	await new Promise((r) => setTimeout(r, 300));
	try {
		await fn();
		console.log('    OK (allowed)');
	} catch (error) {
		console.log(`    DENIED — ${String(error?.message).replace(/\s+/g, ' ').slice(0, 190)}`);
	}
}

await signInWithEmailAndPassword(auth, `${OWNER}@pos.example.com`, '123456');

// --- exactly what the client does -------------------------------------------------
const counterRef = doc(db, 'counters', 'b_sudirman', 'days', DAY);
const receiptDay = Number(DAY);

await step('client creates the counter at zero', async () => {
	const existing = await getDoc(counterRef);
	if (!existing.exists()) await setDoc(counterRef, { seq: 0, code: CODE });
});

let saleId = '';
let receiptNo = '';
await step('client transaction: counter + sale', async () => {
	await runTransaction(db, async (tx) => {
		const snap = await tx.get(counterRef);
		const seq = snap.data().seq + 1;
		saleId = `sale_client_${seq}`;
		receiptNo = `INV/${CODE}/${DAY}/${String(seq).padStart(3, '0')}`;
		tx.set(counterRef, { seq }, { merge: true });
		tx.set(doc(db, 'sales', saleId), {
			clientId: 'client-1',
			receiptNo,
			provisionalReceiptNo: null,
			receiptDay,
			receiptSeq: seq,
			branchId: 'b_sudirman',
			cashierId: OWNER,
			soldAt: new Date().toISOString(),
			customerName: 'Dewi',
			customerPhone: null,
			customerId: null,
			lines: [
				{
					itemId: 'i_svc',
					type: 'service',
					name: 'Svc',
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
					itemId: 'i_pom',
					type: 'product',
					name: 'Pom',
					qty: 1,
					unitPrice: 85000,
					discount: 0,
					lineTotal: 85000
				}
			],
			subtotal: 130000,
			discount: 0,
			total: 130000,
			payment: { method: 'cash', amountTendered: 200000, change: 70000, qrisRef: null },
			syncState: 'synced',
			stockShortfall: false
		});
	});
});

await step('client stock movement + item stock', async () => {
	await writeBatch(db)
		.set(doc(db, 'stockMovements', `mv_${saleId}_i_pom`), {
			branchId: 'b_sudirman',
			itemId: 'i_pom',
			qtyDelta: -1,
			type: 'sale',
			refId: saleId,
			actorId: OWNER,
			note: '',
			createdAt: new Date().toISOString()
		})
		.commit();
	await runTransaction(db, async (tx) => {
		const itemRef = doc(db, 'items', 'i_pom');
		const snap = await tx.get(itemRef);
		tx.set(itemRef, { stock: snap.data().stock - 1 }, { merge: true });
	});
});

await step('owner updates a staff member', async () => {
	await setDoc(doc(db, 'staff', BARBER), {
		displayName: 'Rahmat Hidayat',
		role: 'manager',
		branchIds: ['b_sudirman'],
		phone: '0812',
		active: true
	});
});

await step('owner adds a new staff member', async () => {
	await setDoc(doc(db, 'staff', 's_new'), {
		displayName: 'Baru',
		role: 'barber',
		branchIds: ['b_sudirman'],
		phone: '0899',
		active: true
	});
});

console.log(`\nsale id: ${saleId}  receipt: ${receiptNo}`);
process.exit(0);
