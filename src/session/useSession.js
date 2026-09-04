import { useEffect, useState } from 'react';
import { dbPromise } from '../db/db';
import { mapFieldsToRules } from '../lib/mapFieldsToRules.js';
import { checkCompliance } from '../lib/rules/ruleInterpreter.js';
import evaluateVerdict from '../lib/rules/verdictEvaluator.js';
import ruleConfig from '../lib/rules/Ruleconfig.json';

// Active rules for R1: filter out checks requiring bounding boxes
const r1ActiveRules = (ruleConfig.rules || []).filter(
  (r) => r.check_type !== 'font_size' && r.check_type !== 'placement'
);

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

  // Accepts either an array of photos (legacy) or an object { photos, ocrText, confidence, isImported }
  async function addItem(payload) {
    if (!session) return null;

    let photos = [];
    let ocrText = '';
    let confidence = 0;
    let isImported = false;

    if (Array.isArray(payload)) {
      photos = payload;
    } else if (payload && typeof payload === 'object') {
      photos = payload.photos || [];
      ocrText = payload.ocrText || '';
      confidence = payload.confidence || 0;
      isImported = Boolean(payload.isImported);
    }

    // Run field extraction and compliance evaluation
    let checkResult = null;
    try {
      const extractedFields = mapFieldsToRules(ocrText, confidence, isImported);
      const ruleResults = checkCompliance(r1ActiveRules, extractedFields);
      checkResult = evaluateVerdict(ruleResults);
      checkResult.extractedFields = extractedFields; // attach extracted fields for display in UI
    } catch (err) {
      console.error('Compliance check failed during addItem:', err);
      checkResult = {
        verdict: 'ERROR',
        error: err.message,
        passedRules: 0,
        failedRules: 0,
        skippedRules: 0,
        failures: [],
      };
    }

    const itemId = crypto.randomUUID();
    const newItem = {
      id: itemId,
      photos,
      ocrText,
      confidence,
      checkResult,
      createdAt: new Date().toISOString(),
    };
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