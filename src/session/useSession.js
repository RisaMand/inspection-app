import { useEffect, useState } from 'react';
import { dbPromise } from '../db/db';

// Sessions are now a real, permanent list — each record tagged with the
// userId of whoever created it. This replaces the old single-slot 'current'
// key entirely. A given user has at most one ACTIVE session (endedAt ===
// null) at a time; ending a session archives it (sets endedAt) rather than
// deleting it, so it remains real, retrievable history.

export function useSession(userId) {
  const [allSessions, setAllSessions] = useState([]);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  // Load every session record on mount. We load all records (not just this
  // user's) so the hook stays simple and correct even if userId arrives
  // late (e.g. before auth has finished loading) — filtering happens below,
  // not at the query level.
  useEffect(() => {
    async function loadSessions() {
      const db = await dbPromise;
      const stored = await db.getAll('sessions');
      setAllSessions(stored);
      setSessionLoaded(true);
    }
    loadSessions();
  }, []);

  // This user's own active session (endedAt === null), or null if they
  // don't have one. This is what every existing screen reads as `session`
  // — same shape as before, just now correctly scoped to the right person.
  const session = userId
    ? allSessions.find((s) => s.createdBy === userId && s.endedAt === null) ?? null
    : null;

  // This user's own finished sessions — real, permanent history.
  const sessionHistory = userId
    ? allSessions.filter((s) => s.createdBy === userId && s.endedAt !== null)
    : [];

  async function startSession(visitNumber, shopNumber, gps) {
    if (!userId) return; // no logged-in user to attribute this session to

    const db = await dbPromise;

    // If this user already has an active session (e.g. they explicitly
    // chose to override the warning in StartSession.jsx), archive it
    // first — never leave two sessions simultaneously active for the same
    // user, since that makes which one is "current" ambiguous.
    if (session) {
      const archivedPrevious = { ...session, endedAt: new Date().toISOString() };
      await db.put('sessions', archivedPrevious);
      setAllSessions((prev) =>
        prev.map((s) => (s.id === archivedPrevious.id ? archivedPrevious : s))
      );
    }

    const newSession = {
      id: crypto.randomUUID(),
      createdBy: userId,
      visitNumber,
      shopNumber,
      gps,
      startedAt: new Date().toISOString(),
      endedAt: null,
      items: [],
    };

    await db.put('sessions', newSession);
    setAllSessions((prev) => [...prev, newSession]);
  }

  async function addItem(photos) {
    if (!session) return null;

    const itemId = crypto.randomUUID();
    const newItem = { id: itemId, photos, checkResult: null };
    const updatedSession = { ...session, items: [...session.items, newItem] };

    const db = await dbPromise;
    await db.put('sessions', updatedSession);
    setAllSessions((prev) =>
      prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
    );

    return itemId;
  }

  async function endSession() {
    if (!session) return;

    const archivedSession = { ...session, endedAt: new Date().toISOString() };

    const db = await dbPromise;
    await db.put('sessions', archivedSession);
    setAllSessions((prev) =>
      prev.map((s) => (s.id === archivedSession.id ? archivedSession : s))
    );
  }

  return {
    session,
    sessionLoaded,
    sessionHistory,
    startSession,
    addItem,
    endSession,
  };
}