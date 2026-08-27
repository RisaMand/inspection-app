import { useState } from 'react';

// In-memory for now — swap internals for IndexedDB when offline-save is built.
export function useSession() {
  const [session, setSession] = useState(null); // { visitNumber, shopNumber, gps, startedAt, items: [] }

  function startSession(visitNumber, shopNumber, gps) {
    setSession({
      visitNumber,
      shopNumber,
      gps,
      startedAt: new Date().toISOString(),
      items: [], // each item: { id, photos: [dataUrl, ...], checkResult: null }
    });
  }

  function addItem(photos) {
    setSession((prev) => {
      if (!prev) return prev;
      const newItem = {
        id: crypto.randomUUID(),
        photos,
        checkResult: null, // filled in later by Rule Engine step
      };
      return { ...prev, items: [...prev.items, newItem] };
    });
  }

  function endSession() {
    setSession(null);
  }

  return { session, startSession, addItem, endSession };
}