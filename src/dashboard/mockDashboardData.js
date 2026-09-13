// src/dashboard/mockDashboardData.js
//
// Single source of truth for all five official-dashboard screens (Phase 4).
// Every screen calls a named function below — nothing ever imports RAW_SESSIONS
// directly. When the real backend is ready, only the *insides* of these
// functions change (static array -> fetch() call); every screen consuming
// them keeps working unchanged.
//
// Session/item shape below is copied EXACTLY from src/session/useSession.js
// (the real IndexedDB record shape) — not invented. checkResult shape is
// copied EXACTLY from src/lib/rules/verdictEvaluator.js's real output.
// Rule IDs, clause citations, and severities are pulled from the real
// src/lib/rules/Ruleconfig.json — not invented.
//
// KNOWN GAP (flagged, not silently patched): shopNumber/visitNumber/gps exist
// here because useSession.js already stores them locally, but the real
// backend's `sessions` table (as merged today) does NOT have these columns —
// only id, inspector_id, start_time, end_time, status. That's a schema gap
// for Person 2 to close before this can swap to a real fetch(). See
// PHASE4_Dashboard_Plan.md Section 1.
//
// category is deliberately NOT included anywhere below — dropped as a
// filter dimension per decision, since it doesn't exist in any real schema.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysAgo(n, hour = 11, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

// Tiny inline SVG placeholder — avoids any network dependency for evidence
// photos in mock data (the real app stores actual base64 photo data URLs
// from the camera; these are visually distinct placeholders, same <img src>
// contract).
function mockPhoto(label, bg) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
    <rect width="200" height="200" fill="${bg}"/>
    <text x="100" y="105" font-family="sans-serif" font-size="16" fill="#fff" text-anchor="middle">${label}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// ---------------------------------------------------------------------------
// Inspectors (fixed fake identities — mirrors what Users table will provide)
// ---------------------------------------------------------------------------

export const MOCK_INSPECTORS = [
  { id: 'insp-001', name: 'Priya Sharma' },
  { id: 'insp-002', name: 'Arjun Verma' },
  { id: 'insp-003', name: 'Kavita Nair' },
  { id: 'insp-004', name: 'Rohan Das' },
];

function inspectorName(id) {
  return MOCK_INSPECTORS.find((i) => i.id === id)?.name ?? 'Unknown Inspector';
}

// ---------------------------------------------------------------------------
// Real rule metadata (from Ruleconfig.json — do not invent new rule_ids here)
// ---------------------------------------------------------------------------

const RULES = {
  MANUFACTURER_ADDRESS_PRESENCE: { citation: 'Rule 6(1)(a)', severity: 'substantive', reason: 'Manufacturer/responsible party name and address not found on label' },
  COMMODITY_NAME_PRESENCE: { citation: 'Rule 6(1)(b)', severity: 'substantive', reason: 'Common or generic name of the commodity not declared' },
  NET_QUANTITY_PRESENCE: { citation: 'Rule 6(1)(c)', severity: 'substantive', reason: 'Net quantity not declared' },
  MANUFACTURE_DATE_PRESENCE: { citation: 'Rule 6(1)(d)', severity: 'substantive', reason: 'Month and year of manufacture/packing not declared' },
  MRP_PRESENCE: { citation: 'Rule 6(1)(e)', severity: 'substantive', reason: 'Retail sale price not declared on package' },
  MRP_FORMAT: { citation: 'Rule 6(1)(e)', severity: 'substantive', reason: 'Declared MRP does not follow the prescribed format' },
  CONSUMER_CARE_PRESENCE: { citation: 'Rule 6(1)(f)', severity: 'substantive', reason: 'Consumer complaint contact information not declared' },
  COUNTRY_OF_ORIGIN: { citation: 'Rule 6(1)(f)', severity: 'substantive', reason: 'Country of origin not declared for imported package' },
  DECLARATION_FONT_SIZE: { citation: 'Rule 7', severity: 'cosmetic', reason: 'Mandatory declaration text below minimum character height' },
  DECLARATION_PLACEMENT: { citation: 'Rule 8', severity: 'cosmetic', reason: 'Required declaration not on principal display panel' },
};

function failure(ruleId, confidence = 0.9) {
  const r = RULES[ruleId];
  return { rule_id: ruleId, reason: r.reason, severity: r.severity, clause_citation: r.citation, confidence };
}

function field(text, confidence = 0.9) {
  return { text, confidence };
}

// Builds a checkResult exactly like verdictEvaluator.js's real return shape.
function buildCheckResult(failures, extractedFields, totalRules = 8, skippedRules = 0) {
  const hasSubstantive = failures.some((f) => f.severity === 'substantive');
  const hasCosmetic = failures.some((f) => f.severity === 'cosmetic');
  const verdict = hasSubstantive ? 'NON_COMPLIANT' : hasCosmetic ? 'COMPLIANT_WITH_WARNINGS' : 'COMPLIANT';
  return {
    verdict,
    totalRules,
    passedRules: totalRules - failures.length - skippedRules,
    failedRules: failures.length,
    skippedRules,
    failures,
    extractedFields,
  };
}

// ---------------------------------------------------------------------------
// Raw sessions — 8 sessions, 1-2 items each, spread across ~30 days,
// 4 inspectors, 4 shops, mix of verdicts.
// ---------------------------------------------------------------------------

export const RAW_SESSIONS = [
  {
    id: 'sess-001',
    createdBy: 'insp-001',
    visitNumber: 'V-2026-0142',
    shopNumber: 'GN-14',
    gps: { lat: 22.5170, lng: 88.3670 },
    startedAt: daysAgo(2, 10, 15),
    endedAt: daysAgo(2, 11, 40),
    items: [
      {
        id: 'item-0011',
        photos: [mockPhoto('Front label', '#2d5a2d'), mockPhoto('Back label', '#2d5a2d')],
        ocrText: 'GoodDay Biscuits\nNet Wt 100g\nMRP Rs.20 (incl. of all taxes)\nMfd by ABC Foods Pvt Ltd, Kolkata\nCustomer Care: 1800-000-111',
        ocrRawText: 'GoodDay Biscuits\nNet Wt 100g\nMRP Rs.20 (incl. of all taxes)\nMfd by ABC Foods Pvt Ltd, Kolkata\nCustomer Care: 1800-000-111',
        confidence: 91,
        createdAt: daysAgo(2, 10, 20),
        checkResult: buildCheckResult(
          [],
          {
            MANUFACTURER_ADDRESS: field('Mfd by ABC Foods Pvt Ltd, Kolkata'),
            COMMODITY_NAME: field('GoodDay Biscuits'),
            NET_QUANTITY: field('Net Wt 100g'),
            MRP: field('MRP Rs.20 (incl. of all taxes)'),
            CONSUMER_CARE: field('Customer Care: 1800-000-111'),
            isImported: false,
          },
        ),
      },
    ],
  },
  {
    id: 'sess-002',
    createdBy: 'insp-002',
    visitNumber: 'V-2026-0143',
    shopNumber: 'NM-07',
    gps: { lat: 22.5726, lng: 88.3639 },
    startedAt: daysAgo(5, 14, 0),
    endedAt: daysAgo(5, 15, 20),
    items: [
      {
        id: 'item-0021',
        photos: [mockPhoto('Front label', '#7a2d2d')],
        ocrText: 'Sunrise Cooking Oil\n1 Litre',
        ocrRawText: 'Sunrise Cooking 0il\n1 Litre',
        confidence: 58,
        createdAt: daysAgo(5, 14, 5),
        checkResult: buildCheckResult(
          [failure('MRP_PRESENCE', 0.95), failure('CONSUMER_CARE_PRESENCE', 0.88), failure('MANUFACTURER_ADDRESS_PRESENCE', 0.8)],
          {
            COMMODITY_NAME: field('Sunrise Cooking Oil'),
            NET_QUANTITY: field('1 Litre'),
            isImported: false,
          },
        ),
      },
      {
        id: 'item-0022',
        photos: [mockPhoto('Front label', '#7a6a2d')],
        ocrText: 'Sunrise Cooking Oil 5L\nMRP Rs.850\nMfd by Sunrise Agro, Howrah',
        ocrRawText: 'Sunrise Cooking Oil 5L\nMRP Rs.850\nMfd by Sunrise Agro, Howrah',
        confidence: 84,
        createdAt: daysAgo(5, 14, 40),
        checkResult: buildCheckResult(
          [failure('DECLARATION_FONT_SIZE', 0.7)],
          {
            COMMODITY_NAME: field('Sunrise Cooking Oil 5L'),
            MANUFACTURER_ADDRESS: field('Mfd by Sunrise Agro, Howrah'),
            MRP: field('MRP Rs.850'),
            isImported: false,
          },
        ),
      },
    ],
  },
  {
    id: 'sess-003',
    createdBy: 'insp-003',
    visitNumber: 'V-2026-0144',
    shopNumber: 'LT-22',
    gps: { lat: 22.6100, lng: 88.4100 },
    startedAt: daysAgo(9, 9, 30),
    endedAt: daysAgo(9, 10, 45),
    items: [
      {
        id: 'item-0031',
        photos: [mockPhoto('Front label', '#7a2d2d')],
        ocrText: 'Imported Swiss Chocolate 100g',
        ocrRawText: 'Imported Swiss Chocolate 100g',
        confidence: 76,
        createdAt: daysAgo(9, 9, 35),
        checkResult: buildCheckResult(
          [failure('COUNTRY_OF_ORIGIN', 0.85), failure('MRP_PRESENCE', 0.92), failure('CONSUMER_CARE_PRESENCE', 0.7)],
          {
            COMMODITY_NAME: field('Imported Swiss Chocolate 100g'),
            isImported: true,
          },
        ),
      },
    ],
  },
  {
    id: 'sess-004',
    createdBy: 'insp-001',
    visitNumber: 'V-2026-0145',
    shopNumber: 'EP-03',
    gps: { lat: 22.5626, lng: 88.3512 },
    startedAt: daysAgo(14, 16, 0),
    endedAt: daysAgo(14, 17, 10),
    items: [
      {
        id: 'item-0041',
        photos: [mockPhoto('Front label', '#2d5a2d'), mockPhoto('Back label', '#2d5a2d')],
        ocrText: 'Fresh Bake Bread 400g\nMRP Rs.45 (incl. of all taxes)\nMfd by Fresh Bake Pvt Ltd\nMfg Date 08/2026\nCustomer Care: 1800-222-333',
        ocrRawText: 'Fresh Bake Bread 400g\nMRP Rs.45 (incl. of all taxes)\nMfd by Fresh Bake Pvt Ltd\nMfg Date 08/2026\nCustomer Care: 1800-222-333',
        confidence: 89,
        createdAt: daysAgo(14, 16, 5),
        checkResult: buildCheckResult(
          [],
          {
            MANUFACTURER_ADDRESS: field('Mfd by Fresh Bake Pvt Ltd'),
            COMMODITY_NAME: field('Fresh Bake Bread 400g'),
            NET_QUANTITY: field('400g'),
            MANUFACTURE_DATE: field('08/2026'),
            MRP: field('MRP Rs.45 (incl. of all taxes)'),
            CONSUMER_CARE: field('Customer Care: 1800-222-333'),
            isImported: false,
          },
        ),
      },
    ],
  },
  {
    id: 'sess-005',
    createdBy: 'insp-004',
    visitNumber: 'V-2026-0146',
    shopNumber: 'GN-14',
    gps: { lat: 22.5170, lng: 88.3670 },
    startedAt: daysAgo(18, 11, 0),
    endedAt: daysAgo(18, 12, 30),
    items: [
      {
        id: 'item-0051',
        photos: [mockPhoto('Front label', '#7a6a2d')],
        ocrText: 'Daily Fresh Milk 500ml\nMRP Rs.30\nMfd by Daily Fresh Dairy',
        ocrRawText: 'Daily Fresh Milk 500ml\nMRP Rs.30\nMfd by Daily Fresh Dairy',
        confidence: 80,
        createdAt: daysAgo(18, 11, 5),
        checkResult: buildCheckResult(
          [failure('DECLARATION_PLACEMENT', 0.6)],
          {
            COMMODITY_NAME: field('Daily Fresh Milk 500ml'),
            MANUFACTURER_ADDRESS: field('Mfd by Daily Fresh Dairy'),
            MRP: field('MRP Rs.30'),
            isImported: false,
          },
        ),
      },
      {
        id: 'item-0052',
        photos: [mockPhoto('Front label', '#7a2d2d')],
        ocrText: 'Curd 200g',
        ocrRawText: 'Curd 2OOg',
        confidence: 41,
        createdAt: daysAgo(18, 12, 0),
        checkResult: buildCheckResult(
          [failure('MRP_PRESENCE', 0.9), failure('MANUFACTURE_DATE_PRESENCE', 0.88), failure('MANUFACTURER_ADDRESS_PRESENCE', 0.85), failure('CONSUMER_CARE_PRESENCE', 0.8)],
          {
            COMMODITY_NAME: field('Curd 200g'),
            isImported: false,
          },
        ),
      },
    ],
  },
  {
    id: 'sess-006',
    createdBy: 'insp-002',
    visitNumber: 'V-2026-0147',
    shopNumber: 'NM-07',
    gps: { lat: 22.5726, lng: 88.3639 },
    startedAt: daysAgo(23, 13, 15),
    endedAt: daysAgo(23, 14, 0),
    items: [
      {
        id: 'item-0061',
        photos: [mockPhoto('Front label', '#2d5a2d')],
        ocrText: 'Tasty Namkeen 150g\nMRP Rs.40 (incl. of all taxes)\nMfd by Tasty Snacks Pvt Ltd\nMfg Date 07/2026\nCustomer Care: 1800-444-555',
        ocrRawText: 'Tasty Namkeen 150g\nMRP Rs.40 (incl. of all taxes)\nMfd by Tasty Snacks Pvt Ltd\nMfg Date 07/2026\nCustomer Care: 1800-444-555',
        confidence: 93,
        createdAt: daysAgo(23, 13, 20),
        checkResult: buildCheckResult(
          [],
          {
            MANUFACTURER_ADDRESS: field('Mfd by Tasty Snacks Pvt Ltd'),
            COMMODITY_NAME: field('Tasty Namkeen 150g'),
            NET_QUANTITY: field('150g'),
            MANUFACTURE_DATE: field('07/2026'),
            MRP: field('MRP Rs.40 (incl. of all taxes)'),
            CONSUMER_CARE: field('Customer Care: 1800-444-555'),
            isImported: false,
          },
        ),
      },
    ],
  },
  {
    id: 'sess-007',
    createdBy: 'insp-003',
    visitNumber: 'V-2026-0148',
    shopNumber: 'EP-03',
    gps: { lat: 22.5626, lng: 88.3512 },
    startedAt: daysAgo(27, 10, 0),
    endedAt: daysAgo(27, 11, 25),
    items: [
      {
        id: 'item-0071',
        photos: [mockPhoto('Front label', '#7a2d2d')],
        ocrText: 'Imported Olive Oil 500ml',
        ocrRawText: 'Imported Olive Oil 500ml',
        confidence: 70,
        createdAt: daysAgo(27, 10, 5),
        checkResult: buildCheckResult(
          [failure('COUNTRY_OF_ORIGIN', 0.9), failure('MRP_FORMAT', 0.75)],
          {
            COMMODITY_NAME: field('Imported Olive Oil 500ml'),
            NET_QUANTITY: field('500ml'),
            MRP: field('850'),
            isImported: true,
          },
        ),
      },
      {
        id: 'item-0072',
        photos: [mockPhoto('Front label', '#7a6a2d')],
        ocrText: 'Herbal Soap 100g\nMRP Rs.55\nMfd by Herbal Care Pvt Ltd',
        ocrRawText: 'Herbal Soap 100g\nMRP Rs.55\nMfd by Herbal Care Pvt Ltd',
        confidence: 87,
        createdAt: daysAgo(27, 10, 50),
        checkResult: buildCheckResult(
          [failure('DECLARATION_FONT_SIZE', 0.65), failure('DECLARATION_PLACEMENT', 0.6)],
          {
            COMMODITY_NAME: field('Herbal Soap 100g'),
            MANUFACTURER_ADDRESS: field('Mfd by Herbal Care Pvt Ltd'),
            MRP: field('MRP Rs.55'),
            isImported: false,
          },
        ),
      },
    ],
  },
  {
    id: 'sess-008',
    createdBy: 'insp-004',
    visitNumber: 'V-2026-0149',
    shopNumber: 'LT-22',
    gps: { lat: 22.6100, lng: 88.4100 },
    startedAt: daysAgo(29, 15, 30),
    endedAt: daysAgo(29, 16, 40),
    items: [
      {
        id: 'item-0081',
        photos: [mockPhoto('Front label', '#2d5a2d')],
        ocrText: 'Spice Mix Masala 50g\nMRP Rs.25 (incl. of all taxes)\nMfd by Spice King Pvt Ltd\nMfg Date 06/2026\nCustomer Care: 1800-666-777',
        ocrRawText: 'Spice Mix Masala 50g\nMRP Rs.25 (incl. of all taxes)\nMfd by Spice King Pvt Ltd\nMfg Date 06/2026\nCustomer Care: 1800-666-777',
        confidence: 90,
        createdAt: daysAgo(29, 15, 35),
        checkResult: buildCheckResult(
          [],
          {
            MANUFACTURER_ADDRESS: field('Mfd by Spice King Pvt Ltd'),
            COMMODITY_NAME: field('Spice Mix Masala 50g'),
            NET_QUANTITY: field('50g'),
            MANUFACTURE_DATE: field('06/2026'),
            MRP: field('MRP Rs.25 (incl. of all taxes)'),
            CONSUMER_CARE: field('Customer Care: 1800-666-777'),
            isImported: false,
          },
        ),
      },
      {
        id: 'item-0082',
        photos: [mockPhoto('Front label', '#7a2d2d')],
        ocrText: 'Detergent Powder 1kg',
        ocrRawText: 'Detergent Powder 1kg',
        confidence: 55,
        createdAt: daysAgo(29, 16, 10),
        checkResult: buildCheckResult(
          [failure('MRP_PRESENCE', 0.93), failure('CONSUMER_CARE_PRESENCE', 0.82), failure('MANUFACTURE_DATE_PRESENCE', 0.79), failure('MANUFACTURER_ADDRESS_PRESENCE', 0.77)],
          {
            COMMODITY_NAME: field('Detergent Powder 1kg'),
            NET_QUANTITY: field('1kg'),
            isImported: false,
          },
        ),
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Internal helpers (not exported — used by the query functions below)
// ---------------------------------------------------------------------------

// Every {item, session} pair, full objects — internal use only, for
// aggregation logic that needs the real checkResult, not the light row shape.
function allItemsFlat() {
  const rows = [];
  for (const session of RAW_SESSIONS) {
    for (const item of session.items) rows.push({ item, session });
  }
  return rows;
}

// ERROR is its own tier, matching ItemResult.jsx's own distinct treatment of
// the ERROR verdict — it must never be silently folded into NON_COMPLIANT or
// dropped, since useSession.js's catch path produces real ERROR items with
// no extractedFields and no totalRules at all.
function itemSeverityTier(item) {
  if (item.checkResult.verdict === 'ERROR') return 'errored';
  const failures = item.checkResult.failures || [];
  if (failures.some((f) => f.severity === 'substantive')) return 'substantive';
  if (failures.some((f) => f.severity === 'cosmetic')) return 'cosmetic';
  return 'compliant';
}

// Defensive: real ERROR items have no extractedFields at all.
function productName(item) {
  return item.checkResult?.extractedFields?.COMMODITY_NAME?.text || 'Unknown product';
}

// Public row shape shared by searchDashboard and getFilteredSessions.
export function toRow(item, session) {
  return {
    itemId: item.id,
    sessionId: session.id,
    visitNumber: session.visitNumber,
    shopNumber: session.shopNumber,
    inspectorId: session.createdBy,
    inspectorName: inspectorName(session.createdBy),
    verdict: item.checkResult.verdict,
    productName: productName(item),
    createdAt: item.createdAt,
  };
}

function flattenItems() {
  return allItemsFlat().map(({ item, session }) => toRow(item, session));
}

// ---------------------------------------------------------------------------
// Exported query functions — the only things any dashboard screen should
// ever call. Swapping to the real backend later means changing what's
// *inside* these, never how a screen calls them.
// ---------------------------------------------------------------------------

export function getDashboardSummary() {
  const rows = flattenItems();
  return {
    totalSessions: RAW_SESSIONS.length,
    totalItemsInspected: rows.length,
    compliant: rows.filter((r) => r.verdict === 'COMPLIANT').length,
    compliantWithWarnings: rows.filter((r) => r.verdict === 'COMPLIANT_WITH_WARNINGS').length,
    nonCompliant: rows.filter((r) => r.verdict === 'NON_COMPLIANT').length,
    errored: rows.filter((r) => r.verdict === 'ERROR').length,
    distinctShopsVisited: new Set(RAW_SESSIONS.map((s) => s.shopNumber)).size,
    activeInspectors: new Set(RAW_SESSIONS.map((s) => s.createdBy)).size,
  };
}

export function getViolationsByTier() {
  let substantive = 0;
  let cosmetic = 0;
  for (const { item } of allItemsFlat()) {
    for (const f of item.checkResult.failures || []) {
      if (f.severity === 'substantive') substantive++;
      else if (f.severity === 'cosmetic') cosmetic++;
    }
  }
  return [
    { tier: 'substantive', count: substantive },
    { tier: 'cosmetic', count: cosmetic },
  ];
}

export function getTrendingViolationTypes(windowDays = 30) {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const typeCounts = new Map();
  const dayBuckets = new Map();

  for (const { item } of allItemsFlat()) {
    const t = new Date(item.createdAt).getTime();
    if (t < cutoff) continue;

    const dateKey = item.createdAt.slice(0, 10);
    if (!dayBuckets.has(dateKey)) {
      dayBuckets.set(dateKey, { date: dateKey, totalInspections: 0, nonCompliant: 0 });
    }
    const bucket = dayBuckets.get(dateKey);
    bucket.totalInspections += 1;
    if (item.checkResult.verdict === 'NON_COMPLIANT') bucket.nonCompliant += 1;

    for (const f of item.checkResult.failures || []) {
      if (!typeCounts.has(f.rule_id)) {
        typeCounts.set(f.rule_id, { ruleId: f.rule_id, description: f.reason, severity: f.severity, count: 0 });
      }
      typeCounts.get(f.rule_id).count += 1;
    }
  }

  return {
    windowDays,
    byType: [...typeCounts.values()].sort((a, b) => b.count - a.count),
    byDay: [...dayBuckets.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export function searchDashboard(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  return flattenItems().filter(
    (row) =>
      row.visitNumber.toLowerCase().includes(q) ||
      row.shopNumber.toLowerCase().includes(q) ||
      row.inspectorName.toLowerCase().includes(q) ||
      row.productName.toLowerCase().includes(q),
  );
}

function applyFilters(pairs, { dateFrom, dateTo, inspectorId, shop, severity } = {}) {
  const fromTime = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
  const toTime = dateTo ? new Date(dateTo).getTime() : Infinity;

  return pairs
    .filter(({ session }) => {
      const t = new Date(session.startedAt).getTime();
      return t >= fromTime && t <= toTime;
    })
    .filter(({ session }) => !inspectorId || session.createdBy === inspectorId)
    .filter(({ session }) => !shop || session.shopNumber.toLowerCase().includes(shop.toLowerCase()))
    .filter(({ item }) => !severity || itemSeverityTier(item) === severity);
}

export function getFilteredSessions(filters = {}) {
  return applyFilters(allItemsFlat(), filters).map(({ item, session }) => toRow(item, session));
}

// Same filter logic as getFilteredSessions (via applyFilters, kept in one
// place so the two can't drift apart), but returns full {item, session}
// pairs instead of the light toRow() shape — needed for Step 4.8's export,
// which embeds evidence photos and violation lists that toRow() deliberately
// omits for the on-screen table.
export function getFilteredSessionsForExport(filters = {}) {
  return applyFilters(allItemsFlat(), filters);
}

export function getOfficerActivity() {
  return MOCK_INSPECTORS.map((insp) => {
    const sessions = RAW_SESSIONS.filter((s) => s.createdBy === insp.id);
    const items = sessions.flatMap((s) => s.items);
    let substantiveCount = 0;
    let cosmeticCount = 0;
    let erroredCount = 0;
    for (const item of items) {
      if (item.checkResult.verdict === 'ERROR') erroredCount++;
      for (const f of item.checkResult.failures || []) {
        if (f.severity === 'substantive') substantiveCount++;
        else if (f.severity === 'cosmetic') cosmeticCount++;
      }
    }
    return {
      inspectorId: insp.id,
      inspectorName: insp.name,
      sessionsCount: sessions.length,
      itemsInspected: items.length,
      violationsFound: substantiveCount + cosmeticCount,
      substantiveCount,
      cosmeticCount,
      erroredCount,
    };
  });
}

export function getSessionById(id) {
  return RAW_SESSIONS.find((s) => s.id === id) || null;
}

export function getInspectionById(id) {
  for (const session of RAW_SESSIONS) {
    const item = session.items.find((i) => i.id === id);
    if (item) return { item, session };
  }
  return null;
}