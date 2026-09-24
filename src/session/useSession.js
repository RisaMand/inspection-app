import { useEffect, useState } from 'react';
import { dbPromise } from '../db/db';
import { api } from '../lib/api/client';
import { uploadPhotos } from '../lib/api/photoUpload.js';
import { translateItemPayload } from '../lib/api/translateItemForSync.js';
import { mapFieldsToRules } from '../lib/mapFieldsToRules.js';
import { checkCompliance } from '../lib/rules/ruleInterpreter.js';
import evaluateVerdict from '../lib/rules/verdictEvaluator.js';
import { fetchAndCacheActiveRuleConfig, getActiveRuleConfig } from '../lib/ruleConfigCache.js';

// Placement and font-size checks are out of scope for this round — final,
// not pending (Person 4 decision, confirmed): legal panel identity cannot
// be derived from OCR box geometry and no DPI is measured, so these rules
// stay filtered out of live evaluation rather than faked. Applied to
// whichever config is actually active right now (Section 2.6 -- server's
// published version when reachable, bundled Ruleconfig.json otherwise),
// not just the bundled file.
function filterActiveRules(rules) {
  return (rules || []).filter(
    (r) => r.check_type !== 'font_size' && r.check_type !== 'placement'
  );
}

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

  // Section 2.6: refresh the cached rule config as soon as a token is
  // available (app launch / login), so an amendment published server-side
  // while this device was offline gets picked up without waiting for a
  // new session to start. Fire-and-forget: fetchAndCacheActiveRuleConfig()
  // never throws, and addItem() always re-reads whatever's cached (or
  // falls back to the bundled file) at capture time regardless of whether
  // this particular refresh landed in time.
  useEffect(() => {
    if (!token) return;
    fetchAndCacheActiveRuleConfig(token);
  }, [token]);

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

    // Session boundary is also a natural sync point (pipeline step 9.5) to
    // refresh the cached rule config -- awaited (unlike the mount-time
    // fetch above) so the very first item of this session already has the
    // freshest config this device can reach, not last session's.
    await fetchAndCacheActiveRuleConfig(token);

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

    // Section 2.6: read whatever's actually active right now (freshest
    // cached server config, or the bundled file if none has ever been
    // fetched successfully) fresh for THIS item, not a value captured once
    // at hook-mount -- a background refresh from another tab/session
    // boundary should be picked up by the very next item, not just the
    // next app launch.
    const { version: activeRuleConfigVersion, rules: activeRules } = await getActiveRuleConfig();
    const activeRulesFiltered = filterActiveRules(activeRules);

    let checkResult = null;
    try {
      const textToExtract = ocrRawText && ocrRawText !== ocrText
        ? `${ocrText}\n\n${ocrRawText}`
        : (ocrText || ocrRawText);
      const extractedFields = mapFieldsToRules(textToExtract, confidence, isImported);
      const ruleResults = checkCompliance(activeRulesFiltered, extractedFields);
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

    // Section 2.5: upload this item's photos now, at sync time -- not from
    // Capture.jsx, per photoUpload.js's own documented intent. Best-effort:
    // an offline/failed upload doesn't block the item from being saved
    // locally (pipeline step 9, local-first); it just means imageReferences
    // stays empty and this item stays PENDING for background sync (9.5)
    // to pick up later, same offline-fallback shape as startSession below.
    let imageReferences = [];
    try {
      imageReferences = await uploadPhotos(token, photos);
    } catch (err) {
      console.warn('Photo upload did not complete, item will sync without images for now:', err.message);
    }

    const newItem = {
      id: itemId,
      photos,
      ocrText,
      ocrRawText,
      confidence,
      checkResult,
      ruleConfigVersion: activeRuleConfigVersion,
      createdAt: new Date().toISOString(),
      imageReferences,
      serverId: null,
      syncStatus: 'PENDING',
    };

    // Section 2.4 + 2.5: thread session.serverId onto the item and push it
    // to the server. Every field the backend contract expects is present
    // on the payload, even where this FE can only supply null right now
    // (productName, barcodeValue, tamper signal, etc.) -- translateItemForSync.js
    // is the single place that contract is built, so it can't drift per call site.
    try {
      const syncItem = translateItemPayload(newItem, {
        imageReferences,
        sessionServerId: session.serverId,
        // The version actually used to compute this item's checkResult
        // above -- not just "whatever's active now", which could have
        // changed between capture and this sync call.
        ruleConfigVersion: activeRuleConfigVersion,
      });
      const { results } = await api.syncInspections(token, {
        idempotencyKey: crypto.randomUUID(),
        items: [syncItem],
      });
      const result = results?.[0];
      if (result?.status === 'SYNCED') {
        newItem.serverId = result.serverId;
        newItem.syncStatus = 'SYNCED';
      } else if (result) {
        // CONFLICT or ERROR from the server -- stays PENDING locally rather
        // than SYNCED; not treated as a thrown/offline case since the
        // server was reachable and gave a real, informative answer.
        newItem.syncStatus = result.status;
      }
    } catch (err) {
      console.warn('Item did not sync to server, continuing offline:', err.message);
    }

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