import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
	initializeFirestore,
	persistentLocalCache,
	persistentMultipleTabManager,
	type Firestore
} from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';
import { firebaseConfig } from './config';

let app: FirebaseApp | undefined;
let firestore: Firestore | undefined;
let auth: Auth | undefined;

/**
 * Firebase client bootstrap.
 *
 * Firestore runs with a persistent local cache, so the catalog, staff list and
 * appointments stay readable offline — the same offline story the mock had,
 * but now backed by the real database.
 */
export function getFirebase() {
	if (app) return { app, firestore: firestore!, auth: auth! };

	app = getApps()[0] ?? initializeApp(firebaseConfig);

	firestore = initializeFirestore(app, {
		localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
	});
	auth = getAuth(app);

	return { app, firestore, auth };
}

export { firebaseConfig };
