import { useEffect, useState } from 'react';
import { dbPromise } from '../db/db';
import { api } from '../lib/api/client';
import { mapFieldsToRules } from '../lib/mapFieldsToRules.js';
import { checkCompliance } from '../lib/rules/ruleInterpreter.js';
import evaluateVerdict from '../lib/rules/verdictEvaluator.js';
import ruleConfig from '../lib/rules/Ruleconfig.json';

// Placement and font-size checks are out of scope for this round — final,
// not pending (Person 4 decision, confirmed): legal panel identity cannot
// be derived from OCR box geometry and no DPI is measured, so these rules
// stay filtered out of live evaluation rather than faked.
const r1ActiveRules = (ruleConfig.rules || []).filter(
  (r) => r.check_type !== 'font_size' && r.check_type !== 'placement'
);

export function useSession(userId, token) {
  const [allSessions, setAllSessions] = useState([]);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  useEffect(() => {
    async function loadSessions() {
      const db = await dbPromise;
      const stored = await db.getAll('sessions');
      setAllSessions(stored);
      setSessionLoaded(true);
    }
    loadSessions();
  }, []);

  const session = userId
    ? allSessions.find((s) => s.createdBy === userId && s.endedAt === null) ?? null
    : null;

  const sessionHistory = userId
    ? allSessions.filter((s) => s.createdBy === userId && s.endedAt !== null)
    : [];

  async function startSession(visitNumber, shopNumber, gps) {
    if (!userId) return;

    const db = await dbPromise;

    if (session) {
      const archivedPrevious = { ...session, endedAt: new Date().toISOString() };
      await db.put('sessions', archivedPrevious);
      setAllSessions((prev) =>
        prev.map((s) => (s.id === archivedPrevious.id ? archivedPrevious : s))
      );
    }

    let serverId = null;
    let syncStatus = 'PENDING';
    try {
      const serverSession = await api.createSession(token, {
        visit_number: visitNumber || undefined,
        shop_number: shopNumber || undefined,
        gps_lat: gps?.lat,
        gps_lng: gps?.lng,
      });
      serverId = serverSession.id;
      syncStatus = 'SYNCED';
    } catch (err) {
      console.warn('Session did not sync to server, continuing offline:', err.message);
    }

    const newSession = {
      id: crypto.randomUUID(),
      serverId,
      syncStatus,
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

  async function addItem(payload) {
    if (!session) return null;

    let photos = [];
    let ocrText = '';
    let ocrRawText = '';
    let confidence = 0;
    let isImported = false;

    if (Array.isArray(payload)) {
      photos = payload;
    } else if (payload && typeof payload === 'object') {
      photos = payload.photos || [];
      ocrText = payload.ocrText || '';
      ocrRawText = payload.ocrRawText || '';
      confidence = payload.confidence || 0;
      isImported = Boolean(payload.isImported);
    }

    let checkResult = null;
    try {
      const textToExtract = ocrRawText && ocrRawText !== ocrText
        ? `${ocrText}\n\n${ocrRawText}`
        : (ocrText || ocrRawText);
      const extractedFields = mapFieldsToRules(textToExtract, confidence, isImported);
      const ruleResults = checkCompliance(r1ActiveRules, extractedFields);
      checkResult = evaluateVerdict(ruleResults);
      checkResult.extractedFields = extractedFields;
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
      ocrRawText,
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

    if (archivedSession.serverId) {
      try {
        await api.closeSession(token, archivedSession.serverId);
      } catch (err) {
        console.warn('Failed to close session on server:', err.message);
      }
    }
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