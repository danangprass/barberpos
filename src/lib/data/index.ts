import { mockRepository } from './mock/repository';
import { firebaseRepository } from './firebase/repository';
import { useMock } from '#lib/firebase/config';
import type { PosRepository } from './repository';

/**
 * Storage seam.
 *
 * The one place that decides which backend the app talks to. The mock
 * (IndexedDB) and the live backend (Firestore + Cloud Functions) both satisfy
 * `PosRepository`, so every screen, store, and component works against either
 * one without change.
 *
 * Set `VITE_USE_MOCK=true` to run fully offline against IndexedDB.
 */
export const repo: PosRepository = useMock ? mockRepository : firebaseRepository;

/** Which backend is live — surfaced in Settings so it is never a mystery. */
export const backendName: 'mock' | 'firebase' = useMock ? 'mock' : 'firebase';

export type { PosRepository };
export { DEMO_PIN } from './mock/seed';
