import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface EventRecord {
  id: string;
  session_id: string;
  type: string;
  url: string;
  domain: string;
  tab_id: number | null;
  metadata: Record<string, any> | null;
  occurred_at: string;
  synced: number; // 0 for unsynced, 1 for synced
}

export interface ScreenshotRecord {
  id: string;
  session_id: string;
  event_id: string | null;
  data_url: string;
  domain: string;
  url: string;
  captured_at: string;
  synced: number;
}

interface VisualAIAgentDB extends DBSchema {
  events_buffer: {
    key: string;
    value: EventRecord;
    indexes: {
      'by-synced': number;
      'by-occurred-at': string;
    };
  };
  screenshots_buffer: {
    key: string;
    value: ScreenshotRecord;
    indexes: {
      'by-synced': number;
      'by-captured-at': string;
    };
  };
}

const DB_NAME = 'VisualAIAgentDB';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<VisualAIAgentDB>> | null = null;

function getDB(): Promise<IDBPDatabase<VisualAIAgentDB>> {
  if (!dbPromise) {
    dbPromise = openDB<VisualAIAgentDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1 || !db.objectStoreNames.contains('events_buffer')) {
          const eventsStore = db.createObjectStore('events_buffer', { keyPath: 'id' });
          eventsStore.createIndex('by-synced', 'synced');
          eventsStore.createIndex('by-occurred-at', 'occurred_at');
        }
        if (oldVersion < 2 || !db.objectStoreNames.contains('screenshots_buffer')) {
          const screenshotsStore = db.createObjectStore('screenshots_buffer', { keyPath: 'id' });
          screenshotsStore.createIndex('by-synced', 'synced');
          screenshotsStore.createIndex('by-captured-at', 'captured_at');
        }
      },
    });
  }
  return dbPromise;
}

/* Event Buffer API */

export async function saveEventToBuffer(event: EventRecord): Promise<void> {
  const db = await getDB();
  await db.put('events_buffer', event);
}

export async function getUnsyncedEvents(limit = 50): Promise<EventRecord[]> {
  const db = await getDB();
  const tx = db.transaction('events_buffer', 'readonly');
  const index = tx.store.index('by-synced');
  const unsynced: EventRecord[] = [];
  let cursor = await index.openCursor(IDBKeyRange.only(0));

  while (cursor && unsynced.length < limit) {
    unsynced.push(cursor.value);
    cursor = await cursor.continue();
  }

  return unsynced;
}

export async function deleteEvents(ids: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('events_buffer', 'readwrite');
  await Promise.all(ids.map((id) => tx.store.delete(id)));
  await tx.done;
}

/* Screenshot Buffer API */

export async function saveScreenshotToBuffer(screenshot: ScreenshotRecord): Promise<void> {
  const db = await getDB();
  await db.put('screenshots_buffer', screenshot);
}

export async function getUnsyncedScreenshots(limit = 10): Promise<ScreenshotRecord[]> {
  const db = await getDB();
  const tx = db.transaction('screenshots_buffer', 'readonly');
  const index = tx.store.index('by-synced');
  const unsynced: ScreenshotRecord[] = [];
  let cursor = await index.openCursor(IDBKeyRange.only(0));

  while (cursor && unsynced.length < limit) {
    unsynced.push(cursor.value);
    cursor = await cursor.continue();
  }

  return unsynced;
}

export async function deleteScreenshots(ids: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('screenshots_buffer', 'readwrite');
  await Promise.all(ids.map((id) => tx.store.delete(id)));
  await tx.done;
}
