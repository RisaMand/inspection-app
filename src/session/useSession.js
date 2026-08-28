import { useEffect, useState } from 'react';
import { dbPromise } from '../db/db';

const SESSION_KEY = 'current';

export function useSession() {
  const [session, setSession] = useState(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  // Restore the saved session when the app loads.
  useEffect(() => {
    async function loadSession() {
      const db = await dbPromise;
      const stored = await db.get('session', SESSION_KEY);

      if (stored) {
        setSession(stored);
      }

      setSessionLoaded(true);
    }

    loadSession();
  }, []);

  // Persist session whenever it changes.
  useEffect(() => {
    if (!sessionLoaded) return;

    async function saveSession() {
      const db = await dbPromise;

      if (session) {
        await db.put('session', session, SESSION_KEY);
      } else {
        await db.delete('session', SESSION_KEY);
      }
    }

    saveSession();
  }, [session, sessionLoaded]);

  function startSession(visitNumber, shopNumber, gps) {
    setSession({
      visitNumber,
      shopNumber,
      gps,
      startedAt: new Date().toISOString(),
      items: [],
    });
  }

  function addItem(photos) {
    const itemId = crypto.randomUUID();

    setSession((prev) => {
      if (!prev) return prev;

      const newItem = {
        id: itemId,
        photos,
        checkResult: null,
      };

      return {
        ...prev,
        items: [...prev.items, newItem],
      };
    });

    return itemId;
  }

  function endSession() {
    setSession(null);
  }

  return {
    session,
    sessionLoaded,
    startSession,
    addItem,
    endSession,
  };
}