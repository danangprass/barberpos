/**
 * Firebase client configuration.
 *
 * The values here are the *web* config for the Firebase project. They are not
 * secrets — a Firebase web API key is designed to be shipped to browsers and
 * is protected by the security rules, not by secrecy. Environment variables
 * override them so the same build can target a different project.
 */
export interface FirebaseOptions {
	apiKey: string;
	authDomain: string;
	projectId: string;
	storageBucket: string;
	messagingSenderId: string;
	appId: string;
	measurementId?: string;
}

const env = import.meta.env;

export const firebaseConfig: FirebaseOptions = {
	apiKey: env.VITE_FIREBASE_API_KEY ?? 'AIzaSyAOAZC149QpIQr0BqGWIMZ9Fw0YPe2xPsk',
	authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? 'danangprass-777.firebaseapp.com',
	projectId: env.VITE_FIREBASE_PROJECT_ID ?? 'danangprass-777',
	storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? 'danangprass-777.firebasestorage.app',
	messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '263029861172',
	appId: env.VITE_FIREBASE_APP_ID ?? '1:263029861172:web:e437ebc2677d7961a5d361',
	measurementId: env.VITE_FIREBASE_MEASUREMENT_ID ?? 'G-9EEWYKEKC4'
};

/**
 * Switch the app between the live backend and the offline mock.
 *
 * `VITE_USE_MOCK=true` runs entirely on IndexedDB, which is handy for UI work
 * with no cloud dependency. Anything else uses Firebase.
 */
export const useMock = env.VITE_USE_MOCK === 'true';
