// Dexie/IndexedDB layer (chunk 2, ADR 0002): the append-only event log is the
// source of truth; "meta" holds the device id. localStorage remains a projected
// snapshot mirror written after every replay (fast boot + export + fallback).
// Every access is wrapped so the app degrades to localStorage-only mode when
// IndexedDB is unavailable (private browsing, quota errors).

import Dexie, { type EntityTable } from 'dexie';
import { DEVICE_KEY, type StoredEvent } from './types';

export interface MetaRow {
  key: string;
  value: string;
}

type LumioDb = Dexie & {
  events: EntityTable<StoredEvent, 'id'>;
  meta: EntityTable<MetaRow, 'key'>;
};

const db = (() => {
  try {
    if (typeof indexedDB === 'undefined') return null;
    const d = new Dexie('lumio-v2') as LumioDb;
    // Schema version 1 (chunk 2): events (append-only log + sync flag) and meta.
    d.version(1).stores({
      events: '++id, deviceId, clientTime, type, synced',
      meta: 'key',
    });
    return d;
  } catch {
    return null; // IndexedDB blocked — storage.ts falls back to localStorage
  }
})();

export const hasIndexedDb = db !== null;

function safe<T>(op: () => Promise<T>, fallback: T): Promise<T> {
  if (!db) return Promise.resolve(fallback);
  return op().catch(() => fallback);
}

export async function dbGetEvents(): Promise<StoredEvent[]> {
  return safe(async () => {
    if (!db) return [];
    return db.events.orderBy('id').toArray();
  }, []);
}

export async function dbAppendEvent(e: StoredEvent): Promise<void> {
  await safe(async () => {
    await db?.events.add(e);
  }, undefined);
}

export async function dbClearAll(): Promise<void> {
  await safe(async () => {
    if (!db) return;
    await db.transaction('rw', db.events, db.meta, async () => {
      await db.events.clear();
      await db.meta.clear();
    });
  }, undefined);
}

export async function dbMetaGet(key: string): Promise<string | null> {
  return safe(async () => {
    const row = await db?.meta.get(key);
    return row?.value ?? null;
  }, null);
}

export async function dbMetaSet(key: string, value: string): Promise<void> {
  await safe(async () => {
    await db?.meta.put({ key, value });
  }, undefined);
}

/** Stable per-device id (sync queue + future multi-device merge in chunk 5). */
export async function deviceId(): Promise<string> {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
  } catch {
    /* localStorage unavailable */
  }
  let id = '';
  const stored = await dbMetaGet(DEVICE_KEY);
  if (stored) {
    id = stored;
  } else {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
    await dbMetaSet(DEVICE_KEY, id);
  }
  try {
    localStorage.setItem(DEVICE_KEY, id);
  } catch {
    /* ignore */
  }
  return id;
}

/** Ask the browser to keep our data durable (gap table: storage persistence). */
export function requestPersistence(): void {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      void navigator.storage.persist();
    }
  } catch {
    /* not supported */
  }
}
