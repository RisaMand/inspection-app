import { openDB } from 'idb';

// Single shared IndexedDB database for the whole app.
// One object store per concern — auth state, session scratch data, and
// (from v2) a real persisted list of sessions — rather than cramming
// everything into one blob, so each hook can read/write its own slice
// independently.
const DB_NAME = 'inspection-app-db';
const DB_VERSION = 2;

export const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db, oldVersion) {
    if (!db.objectStoreNames.contains('auth')) {
      db.createObjectStore('auth');
    }
    if (!db.objectStoreNames.contains('session')) {
      // Legacy/scratch store — still used for in-progress draft photos
      // (see Capture.jsx's getDraftPhotosKey). The old single-slot
      // 'current' session record it used to hold is superseded by the
      // 'sessions' store below (v2) and is no longer written.
      db.createObjectStore('session');
    }
    if (!db.objectStoreNames.contains('sessions')) {
      // v2 — real, permanent session records. Each record is keyed by its
      // own generated id (keyPath: 'id'), so this store holds every
      // session ever created (active or archived), for every user on this
      // device, not a single overwritable slot.
      db.createObjectStore('sessions', { keyPath: 'id' });
    }
  },
});