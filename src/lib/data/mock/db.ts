import { openDB, type DBSchema, type IDBPDatabase, type StoreNames } from 'idb';
import type {
	Appointment,
	Barber,
	Branch,
	BranchSettings,
	Category,
	Customer,
	Item,
	OutboxEntry,
	Sale,
	Staff,
	StockMovement
} from '#lib/types/domain';

/**
 * Local persistence for the mock repository.
 *
 * Stands in for Firestore's local cache so the offline story is real from day
 * one: the same shapes, the same async API, the same "write locally now, sync
 * later" semantics.
 */
export interface PosDB extends DBSchema {
	branches: { key: string; value: Branch };
	staff: { key: string; value: Staff };
	barbers: { key: string; value: Barber };
	categories: { key: string; value: Category };
	items: { key: string; value: Item };
	customers: { key: string; value: Customer };
	appointments: { key: string; value: Appointment };
	sales: { key: string; value: Sale };
	stockMovements: { key: string; value: StockMovement };
	settings: { key: string; value: BranchSettings };
	outbox: { key: string; value: OutboxEntry };
	meta: { key: string; value: unknown };
}

const STORES = [
	'branches',
	'staff',
	'barbers',
	'categories',
	'items',
	'customers',
	'appointments',
	'sales',
	'stockMovements',
	'settings',
	'outbox',
	'meta'
] as const;

const DB_NAME = 'barber-pos';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<PosDB>> | null = null;

export function db(): Promise<IDBPDatabase<PosDB>> {
	if (dbPromise) return dbPromise;
	dbPromise = openDB<PosDB>(DB_NAME, DB_VERSION, {
		upgrade(database) {
			for (const name of STORES) {
				if (!database.objectStoreNames.contains(name)) {
					database.createObjectStore(name);
				}
			}
		}
	});
	return dbPromise;
}

export async function readAll<T>(store: StoreNames<PosDB>): Promise<T[]> {
	const database = await db();
	return (await database.getAll(store)) as T[];
}

export async function readOne<T>(store: StoreNames<PosDB>, key: string): Promise<T | undefined> {
	const database = await db();
	return (await database.get(store, key)) as T | undefined;
}

export async function putOne<T>(store: StoreNames<PosDB>, value: T, key: string): Promise<void> {
	const database = await db();
	await database.put(store, value, key);
}

export async function putMany<T>(
	store: StoreNames<PosDB>,
	values: T[],
	keyOf: (value: T) => string
): Promise<void> {
	const database = await db();
	const tx = database.transaction(store, 'readwrite');
	await Promise.all([...values.map((value) => tx.store.put(value, keyOf(value))), tx.done]);
}

export async function removeOne(store: StoreNames<PosDB>, key: string): Promise<void> {
	const database = await db();
	await database.delete(store, key);
}

export async function clearStore(store: StoreNames<PosDB>): Promise<void> {
	const database = await db();
	await database.clear(store);
}

export async function wipeAll(): Promise<void> {
	await Promise.all(STORES.map((store) => clearStore(store)));
}