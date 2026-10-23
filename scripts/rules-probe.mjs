/**
 * Probes which condition breaks a sale rule. Temporary.
 */

import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getFirestore, setDoc } from 'firebase/firestore';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8081';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const { initializeApp: initializeAdminApp } = await import('firebase-admin/app');
const { getFirestore: getAdminFirestore } = await import('firebase-admin/firestore');

const app = initializeApp({
	apiKey: 'fake',
	authDomain: 'demo-danangprass.firebaseapp.com',
	projectId: 'demo-danangprass'
});
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8081);
const adminDb = getAdminFirestore(initializeAdminApp({ projectId: 'demo-danangprass' }));

await signInAnonymously(auth);
const uid = auth.currentUser.uid;
await adminDb.collection('staff').doc(uid).set({ role: 'owner', branchIds: ['b1'] });
await adminDb.collection('flatcounters').doc('exists_one').set({ seq: 1 });
await adminDb.collection('things').doc('other').set({ name: 'x' });
await adminDb.collection('items').doc('i_probe').set({ price: 100 });
await adminDb.collection('branches').doc('b1').set({ code: 'SDM' });
await adminDb.collection('staff').doc(uid).set({ role: 'owner', branchIds: ['b1'] });
await adminDb.collection('flatcounters').doc('exists_one').set({ seq: 1 });
await adminDb.collection('things').doc('other').set({ name: 'x' });

const payload = {
	branchId: 'b1',
	itemId: 'i_probe',
	day: '20261022',
	intDay: 20261022,
	no: 'INV/SDM/20261022/006',
	flatId: 'b1_20261022',
	branchId: 'b1',
	missingId: 'does_not_exist',
	branchId: 'b1',
	list: ['b1'],
	want: 'b1',
	no: 'INV/SDM/20261022/006',
	day: 20261022
};

for (const [name, id] of [
	['Y1 branchAllowed(myStaff(), id)', 'y1'],
	['Y2 diff().affectedKeys().hasOnly()', 'y2'],
	['Y3 resource.data.seq + 1', 'y3'],
	['Y4 list.hasAny()', 'y4'],
	['Y5 matches with a concatenated pattern', 'y5'],
	['Y6 get() on an existing document', 'y6']
]) {
	try {
		await setDoc(doc(db, id, 'x'), payload);
		console.log(`ALLOWED  ${name}`);
	} catch (error) {
		console.log(`DENIED   ${name} — ${String(error?.message).replace(/\s+/g, ' ').slice(0, 120)}`);
	}
}
process.exit(0);
