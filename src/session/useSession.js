import { useState } from 'react';

// In-memory for now — swap internals for IndexedDB when offline-save is built.
// Nothing outside this file should need to change when that happens.
export function useSession() {
  const [session, setSession] = useState(null); // { visitNumber, shopNumber, gps, startedAt }

  function startSession(visitNumber, shopNumber, gps) {
    setSession({
      visitNumber,
      shopNumber,
      gps, // { lat, lng } or null if denied/unavailable
      startedAt: new Date().toISOString(),
    });
  }

  function endSession() {
    setSession(null);
  }

  return { session, startSession, endSession };
}