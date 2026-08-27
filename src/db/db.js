import { openDB } from 'idb';

// Single shared IndexedDB database for the whole app.
// One object store per concern — auth state, session state — rather than
// cramming everything into one blob, so each hook can read/write its own
// slice independently.
const DB_NAME = 'inspection-app-db';
const DB_VERSION = 1;

export const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('auth')) {
      db.createObjectStore('auth');
    }
    if (!db.objectStoreNames.contains('session')) {
      db.createObjectStore('session');
    }
  },
});