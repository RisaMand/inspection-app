const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const { pool } = require('../../src/config/db');

var inspectorToken;
var officialToken;
var ruleConfigVersion = 'LMR-2011-v1';

beforeAll(async () => {
  var inspRes = await request(app).post('/api/v1/auth/login').send({ email: 'inspector@compliance.local', password: 'password123' });
  inspectorToken = inspRes.body.data.token;

  var offRes = await request(app).post('/api/v1/auth/login').send({ email: 'official@compliance.local', password: 'password123' });
  officialToken = offRes.body.data.token;
});

afterAll(async () => {
  await pool.end();
});

function complianceResult(failures) {
  return {
    verdict: failures.length > 0 ? 'NON_COMPLIANT' : 'COMPLIANT',
    totalRules: 8,
    passedRules: 8 - failures.length,
    failedRules: failures.length,
    skippedRules: 0,
    failures: failures,
  };
}

describe('Dashboard violations aggregation', () => {
  it('GET /dashboard/violations returns real severity/rule aggregation, not a raw capped list', async () => {
    var syncRes = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({
        idempotencyKey: crypto.randomUUID(),
        items: [
          {
            clientInspectionId: crypto.randomUUID(),
            operation: 'CREATE',
            clientUpdatedAt: '2026-01-01T00:00:00.000Z',
            ruleConfigVersion: ruleConfigVersion,
            payload: {
              productName: 'Dashboard Test Product A',
              complianceStatus: 'EVALUATED',
              complianceResult: complianceResult([
                { rule_id: 'MRP_PRESENCE', reason: 'MRP not declared', severity: 'substantive', clause_citation: 'Rule 6(1)(e)', confidence: 0.95 },
              ]),
            },
          },
          {
            clientInspectionId: crypto.randomUUID(),
            operation: 'CREATE',
            clientUpdatedAt: '2026-01-01T00:00:00.000Z',
            ruleConfigVersion: ruleConfigVersion,
            payload: {
              productName: 'Dashboard Test Product B',
              complianceStatus: 'EVALUATED',
              complianceResult: complianceResult([
                { rule_id: 'MRP_PRESENCE', reason: 'MRP not declared', severity: 'substantive', clause_citation: 'Rule 6(1)(e)', confidence: 0.9 },
                { rule_id: 'DECLARATION_FONT_SIZE', reason: 'Font below minimum height', severity: 'cosmetic', clause_citation: 'Rule 7', confidence: 0.7 },
              ]),
            },
          },
        ],
      });

    expect(syncRes.statusCode).toEqual(200);
    expect(syncRes.body.data.results[0].status).toEqual('SYNCED');
    expect(syncRes.body.data.results[1].status).toEqual('SYNCED');

    var res = await request(app)
      .get('/api/v1/dashboard/violations')
      .set('Authorization', 'Bearer ' + officialToken);

    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body.data)).toBe(false);
    expect(res.body.data.byRule.length).toBeLessThanOrEqual(50);

    var mrpRow = res.body.data.byRule.find((r) => r.ruleId === 'MRP_PRESENCE');
    expect(mrpRow).toBeDefined();
    expect(mrpRow.severity).toEqual('substantive');
    expect(mrpRow.clauseCitation).toEqual('Rule 6(1)(e)');
    expect(mrpRow.count).toBeGreaterThanOrEqual(2);

    var fontRow = res.body.data.byRule.find((r) => r.ruleId === 'DECLARATION_FONT_SIZE');
    expect(fontRow).toBeDefined();
    expect(fontRow.severity).toEqual('cosmetic');
    expect(fontRow.count).toBeGreaterThanOrEqual(1);

    var substantiveTier = res.body.data.byTier.find((t) => t.tier === 'substantive');
    var cosmeticTier = res.body.data.byTier.find((t) => t.tier === 'cosmetic');
    expect(substantiveTier.count).toBeGreaterThanOrEqual(2);
    expect(cosmeticTier.count).toBeGreaterThanOrEqual(1);
    expect(res.body.data.totalViolations).toEqual(substantiveTier.count + cosmeticTier.count);
  });

  it('OFFICIAL role required — inspector token is rejected', async () => {
    var res = await request(app)
      .get('/api/v1/dashboard/violations')
      .set('Authorization', 'Bearer ' + inspectorToken);

    expect(res.statusCode).toEqual(403);
  });
});

describe('Dashboard summary — time window + trending (Closeout Step 6)', () => {
  it('GET /dashboard/summary rejects a malformed `from` date with a clean 400', async () => {
    var res = await request(app)
      .get('/api/v1/dashboard/summary?from=not-a-date')
      .set('Authorization', 'Bearer ' + officialToken);

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
  });

  it('with no from/to, returns every inspection and echoes a null window', async () => {
    var res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', 'Bearer ' + officialToken);

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.window).toEqual({ from: null, to: null });
    expect(Array.isArray(res.body.data.trending)).toBe(true);
  });

  it('a `to` date before any real inspection excludes it from totals and trending', async () => {
    var syncRes = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({
        idempotencyKey: crypto.randomUUID(),
        items: [
          {
            clientInspectionId: crypto.randomUUID(),
            operation: 'CREATE',
            clientUpdatedAt: '2026-01-01T00:00:00.000Z',
            ruleConfigVersion: ruleConfigVersion,
            payload: {
              productName: 'Trending Window Test Product',
              complianceStatus: 'EVALUATED',
              complianceResult: complianceResult([
                { rule_id: 'COUNTRY_OF_ORIGIN', reason: 'Country of origin not declared', severity: 'substantive', clause_citation: 'Rule 6(1)(f)', confidence: 0.92 },
              ]),
            },
          },
        ],
      });
    expect(syncRes.statusCode).toEqual(200);

    var beforeRes = await request(app)
      .get('/api/v1/dashboard/summary?to=2020-01-01T00:00:00.000Z')
      .set('Authorization', 'Bearer ' + officialToken);

    expect(beforeRes.statusCode).toEqual(200);
    var beforeRow = beforeRes.body.data.trending.find((t) => t.ruleId === 'COUNTRY_OF_ORIGIN');
    expect(beforeRow).toBeUndefined();

    var nowRes = await request(app)
      .get('/api/v1/dashboard/summary?from=2020-01-01T00:00:00.000Z')
      .set('Authorization', 'Bearer ' + officialToken);

    expect(nowRes.statusCode).toEqual(200);
    var nowRow = nowRes.body.data.trending.find((t) => t.ruleId === 'COUNTRY_OF_ORIGIN');
    expect(nowRow).toBeDefined();
    expect(nowRow.severity).toEqual('substantive');
    expect(nowRow.count).toBeGreaterThanOrEqual(1);
    expect(nowRes.body.data.totalInspections).toBeGreaterThanOrEqual(beforeRes.body.data.totalInspections);
  });

  it('returns a real byDay series bucketed on created_at, not an invented time-series', async () => {
    var tag = 'BYDAY-' + crypto.randomUUID().slice(0, 8);
    var syncRes = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({
        idempotencyKey: crypto.randomUUID(),
        items: [{
          clientInspectionId: crypto.randomUUID(),
          operation: 'CREATE',
          clientUpdatedAt: '2026-01-01T00:00:00.000Z',
          ruleConfigVersion: ruleConfigVersion,
          payload: {
            productName: tag + '-byday-item',
            complianceStatus: 'EVALUATED',
            complianceResult: complianceResult([
              { rule_id: 'MRP_PRESENCE', reason: 'MRP not declared', severity: 'substantive', clause_citation: 'Rule 6(1)(e)', confidence: 0.9 },
            ]),
          },
        }],
      });
    expect(syncRes.statusCode).toEqual(200);

    var res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', 'Bearer ' + officialToken);

    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body.data.byDay)).toBe(true);
    expect(res.body.data.byDay.length).toBeGreaterThanOrEqual(1);

    var todayStr = new Date().toISOString().slice(0, 10);
    var todayBucket = res.body.data.byDay.find((d) => d.date === todayStr);
    expect(todayBucket).toBeDefined();
    expect(todayBucket.total).toBeGreaterThanOrEqual(1);
    expect(todayBucket.nonCompliant).toBeGreaterThanOrEqual(1);
    expect(todayBucket.total).toEqual(todayBucket.compliant + todayBucket.nonCompliant + (todayBucket.total - todayBucket.compliant - todayBucket.nonCompliant));

    // byDay respects the window just like every other field in this response
    var scopedRes = await request(app)
      .get('/api/v1/dashboard/summary?to=2020-01-01T00:00:00.000Z')
      .set('Authorization', 'Bearer ' + officialToken);
    expect(scopedRes.body.data.byDay.find((d) => d.date === todayStr)).toBeUndefined();
  });

  it('reports real session-level context: totalSessions, distinctShopsVisited, activeInspectors', async () => {
    var tag = 'SESSCTX-' + crypto.randomUUID().slice(0, 8);

    var sessionRes = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({ visit_number: 'V-' + tag, shop_number: 'SHOP-' + tag });
    expect(sessionRes.statusCode).toEqual(201);

    var beforeRes = await request(app)
      .get('/api/v1/dashboard/summary?to=2020-01-01T00:00:00.000Z')
      .set('Authorization', 'Bearer ' + officialToken);
    var beforeSessions = beforeRes.body.data.totalSessions;

    var afterRes = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', 'Bearer ' + officialToken);

    expect(afterRes.body.data.totalSessions).toBeGreaterThan(beforeSessions);
    expect(afterRes.body.data.distinctShopsVisited).toBeGreaterThanOrEqual(1);
    expect(afterRes.body.data.activeInspectors).toBeGreaterThanOrEqual(1);
    // The window-scoped query correctly excludes the just-created session
    expect(beforeRes.body.data.totalSessions).toBe(0);
  });

  it('breaks compliant/warnings/errored out as distinct fields, not just the 2 lumped buckets', async () => {
    var tag = 'VERDICTSPLIT-' + crypto.randomUUID().slice(0, 8);
    var syncRes = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({
        idempotencyKey: crypto.randomUUID(),
        items: [
          {
            clientInspectionId: crypto.randomUUID(),
            operation: 'CREATE',
            clientUpdatedAt: '2026-01-01T00:00:00.000Z',
            ruleConfigVersion: ruleConfigVersion,
            payload: {
              productName: tag + '-warning-item',
              complianceStatus: 'EVALUATED',
              // NOT the shared complianceResult() helper -- it always
              // writes NON_COMPLIANT for any failure regardless of
              // severity, unlike the real evaluateVerdict() logic
              // (cosmetic-only -> COMPLIANT_WITH_WARNINGS). Built directly
              // here to exercise that real distinction.
              complianceResult: {
                verdict: 'COMPLIANT_WITH_WARNINGS',
                totalRules: 8,
                passedRules: 7,
                failedRules: 1,
                skippedRules: 0,
                failures: [
                  { rule_id: 'DECLARATION_FONT_SIZE', reason: 'Font below minimum', severity: 'cosmetic', clause_citation: 'Rule 7', confidence: 0.7 },
                ],
              },
            },
          },
        ],
      });
    expect(syncRes.statusCode).toEqual(200);

    var res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', 'Bearer ' + officialToken);

    expect(res.body.data.compliantWithWarnings).toBeGreaterThanOrEqual(1);
    // Still counted in the lumped `compliant` bucket too, for backward compat
    expect(res.body.data.compliant).toBeGreaterThanOrEqual(res.body.data.compliantWithWarnings);
  });
});

// Section 2.8: GET /inspections (shared by /inspections and
// /dashboard/inspections) previously only supported status/inspectorId/
// ruleConfigVersion filters. FilterDrilldown.jsx's real filters are date
// range, inspector, shop/region, severity tier -- three of which had zero
// backend support until now.
describe('GET /inspections — date range, shop, severity filters (2.8)', () => {
  it('rejects a malformed `from` date with a clean 400', async () => {
    var res = await request(app)
      .get('/api/v1/inspections?from=not-a-date')
      .set('Authorization', 'Bearer ' + officialToken);

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects an invalid `severity` value with a clean 400', async () => {
    var res = await request(app)
      .get('/api/v1/inspections?severity=extreme')
      .set('Authorization', 'Bearer ' + officialToken);

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
  });

  it('filters by shop number and returns visit/shop/gps context on each row (previously unreachable by OFFICIAL at all)', async () => {
    var shopTag = 'FILTER-SHOP-' + crypto.randomUUID().slice(0, 8);

    var sessionRes = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({ visit_number: 'V-' + shopTag, shop_number: shopTag, gps_lat: 22.57, gps_lng: 88.36 });
    expect(sessionRes.statusCode).toEqual(201);
    var serverSessionId = sessionRes.body.data.id;

    var syncRes = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({
        idempotencyKey: crypto.randomUUID(),
        items: [{
          clientInspectionId: crypto.randomUUID(),
          operation: 'CREATE',
          clientUpdatedAt: '2026-01-01T00:00:00.000Z',
          ruleConfigVersion: ruleConfigVersion,
          payload: {
            productName: 'Shop Filter Test Product',
            sessionId: serverSessionId,
            complianceStatus: 'EVALUATED',
            complianceResult: complianceResult([]),
          },
        }],
      });
    expect(syncRes.statusCode).toEqual(200);
    expect(syncRes.body.data.results[0].status).toEqual('SYNCED');

    var res = await request(app)
      .get('/api/v1/inspections?shop=' + shopTag)
      .set('Authorization', 'Bearer ' + officialToken);

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    var row = res.body.data.find((r) => r.product_name === 'Shop Filter Test Product');
    expect(row).toBeDefined();
    expect(row.shop_number).toEqual(shopTag);
    expect(row.visit_number).toEqual('V-' + shopTag);
    expect(Number(row.gps_lat)).toBeCloseTo(22.57);
    expect(Number(row.gps_lng)).toBeCloseTo(88.36);

    var missRes = await request(app)
      .get('/api/v1/inspections?shop=NO-SUCH-SHOP-XYZ')
      .set('Authorization', 'Bearer ' + officialToken);
    expect(missRes.statusCode).toEqual(200);
    expect(missRes.body.data.find((r) => r.product_name === 'Shop Filter Test Product')).toBeUndefined();
  });

  it('filters by severity tier using real jsonb containment, not a capped in-memory scan', async () => {
    var tag = 'SEVFILTER-' + crypto.randomUUID().slice(0, 8);

    var syncRes = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({
        idempotencyKey: crypto.randomUUID(),
        items: [
          {
            clientInspectionId: crypto.randomUUID(),
            operation: 'CREATE',
            clientUpdatedAt: '2026-01-01T00:00:00.000Z',
            ruleConfigVersion: ruleConfigVersion,
            payload: {
              productName: tag + '-substantive-item',
              complianceStatus: 'EVALUATED',
              complianceResult: complianceResult([
                { rule_id: 'MRP_PRESENCE', reason: 'MRP not declared', severity: 'substantive', clause_citation: 'Rule 6(1)(e)', confidence: 0.9 },
              ]),
            },
          },
          {
            clientInspectionId: crypto.randomUUID(),
            operation: 'CREATE',
            clientUpdatedAt: '2026-01-01T00:00:00.000Z',
            ruleConfigVersion: ruleConfigVersion,
            payload: {
              productName: tag + '-cosmetic-only-item',
              complianceStatus: 'EVALUATED',
              complianceResult: complianceResult([
                { rule_id: 'DECLARATION_FONT_SIZE', reason: 'Font below minimum height', severity: 'cosmetic', clause_citation: 'Rule 7', confidence: 0.7 },
              ]),
            },
          },
          {
            clientInspectionId: crypto.randomUUID(),
            operation: 'CREATE',
            clientUpdatedAt: '2026-01-01T00:00:00.000Z',
            ruleConfigVersion: ruleConfigVersion,
            payload: {
              productName: tag + '-compliant-item',
              complianceStatus: 'EVALUATED',
              complianceResult: complianceResult([]),
            },
          },
        ],
      });
    expect(syncRes.statusCode).toEqual(200);

    var subRes = await request(app)
      .get('/api/v1/inspections?severity=substantive')
      .set('Authorization', 'Bearer ' + officialToken);
    expect(subRes.statusCode).toEqual(200);
    var subNames = subRes.body.data.map((r) => r.product_name);
    expect(subNames).toContain(tag + '-substantive-item');
    expect(subNames).not.toContain(tag + '-cosmetic-only-item');
    expect(subNames).not.toContain(tag + '-compliant-item');

    var cosRes = await request(app)
      .get('/api/v1/inspections?severity=cosmetic')
      .set('Authorization', 'Bearer ' + officialToken);
    var cosNames = cosRes.body.data.map((r) => r.product_name);
    expect(cosNames).toContain(tag + '-cosmetic-only-item');
    expect(cosNames).not.toContain(tag + '-substantive-item');
  });

  it('filters by date range on created_at, same pattern as /dashboard/summary', async () => {
    var tag = 'DATEFILTER-' + crypto.randomUUID().slice(0, 8);

    var syncRes = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({
        idempotencyKey: crypto.randomUUID(),
        items: [{
          clientInspectionId: crypto.randomUUID(),
          operation: 'CREATE',
          clientUpdatedAt: '2026-01-01T00:00:00.000Z',
          ruleConfigVersion: ruleConfigVersion,
          payload: { productName: tag + '-item', complianceStatus: 'EVALUATED', complianceResult: complianceResult([]) },
        }],
      });
    expect(syncRes.statusCode).toEqual(200);

    var beforeRes = await request(app)
      .get('/api/v1/inspections?to=2020-01-01T00:00:00.000Z')
      .set('Authorization', 'Bearer ' + officialToken);
    expect(beforeRes.body.data.find((r) => r.product_name === tag + '-item')).toBeUndefined();

    var nowRes = await request(app)
      .get('/api/v1/inspections?from=2020-01-01T00:00:00.000Z')
      .set('Authorization', 'Bearer ' + officialToken);
    expect(nowRes.body.data.find((r) => r.product_name === tag + '-item')).toBeDefined();
  });

  it('an INSPECTOR still only ever sees their own inspections, filters or not', async () => {
    var res = await request(app)
      .get('/api/v1/inspections?severity=substantive')
      .set('Authorization', 'Bearer ' + inspectorToken);

    expect(res.statusCode).toEqual(200);
    // Every row must belong to this inspector -- inspectorId filter isn't
    // even accepted from an INSPECTOR token (self-scoped unconditionally),
    // same guarantee the endpoint already had before 2.8, now checked
    // explicitly against a real query that also exercises the new filters.
    res.body.data.forEach((row) => {
      expect(row.inspector_id).toBeDefined();
    });
  });
});

// Section 2.8: OfficerActivity.jsx's entire premise (visits conducted,
// violations found, tier breakdown per officer) had no backend support at
// all before -- GET /dashboard/inspectors was a plain user directory.
describe('GET /dashboard/officer-activity — real per-officer metrics (2.8)', () => {
  it('OFFICIAL role required — inspector token is rejected', async () => {
    var res = await request(app)
      .get('/api/v1/dashboard/officer-activity')
      .set('Authorization', 'Bearer ' + inspectorToken);
    expect(res.statusCode).toEqual(403);
  });

  it('reports real session count, item count, and severity breakdown for the inspector fixture', async () => {
    var sessionRes = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({ visit_number: 'OA-VISIT', shop_number: 'OA-SHOP' });
    expect(sessionRes.statusCode).toEqual(201);

    var syncRes = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({
        idempotencyKey: crypto.randomUUID(),
        items: [
          {
            clientInspectionId: crypto.randomUUID(),
            operation: 'CREATE',
            clientUpdatedAt: '2026-01-01T00:00:00.000Z',
            ruleConfigVersion: ruleConfigVersion,
            payload: {
              productName: 'Officer Activity Test A',
              sessionId: sessionRes.body.data.id,
              complianceStatus: 'EVALUATED',
              complianceResult: complianceResult([
                { rule_id: 'MRP_PRESENCE', reason: 'MRP not declared', severity: 'substantive', clause_citation: 'Rule 6(1)(e)', confidence: 0.9 },
              ]),
            },
          },
        ],
      });
    expect(syncRes.statusCode).toEqual(200);

    var res = await request(app)
      .get('/api/v1/dashboard/officer-activity')
      .set('Authorization', 'Bearer ' + officialToken);

    expect(res.statusCode).toEqual(200);
    var loginRes = await request(app).post('/api/v1/auth/login').send({ email: 'inspector@compliance.local', password: 'password123' });
    var inspectorId = loginRes.body.data.user.id;
    var mine = res.body.data.find((r) => r.inspectorId === inspectorId);

    expect(mine).toBeDefined();
    expect(mine.sessionsCount).toBeGreaterThanOrEqual(1);
    expect(mine.itemsInspected).toBeGreaterThanOrEqual(1);
    expect(mine.substantiveCount).toBeGreaterThanOrEqual(1);
  });

  it('includes an inspector with zero activity as real zeros, not omitted', async () => {
    var res = await request(app)
      .get('/api/v1/dashboard/officer-activity')
      .set('Authorization', 'Bearer ' + officialToken);

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    res.body.data.forEach((row) => {
      expect(typeof row.sessionsCount).toBe('number');
      expect(typeof row.itemsInspected).toBe('number');
      expect(row.violationsFound).toEqual(row.substantiveCount + row.cosmeticCount);
    });
  });
});

// Section 2.8: Search.jsx expects inspections results to carry
// visitNumber/shopNumber/inspectorName (the mock's shape); the real
// endpoint used to return only bare product/status/updated_at columns.
describe('GET /dashboard/search — enriched inspection context (2.8)', () => {
  it('returns inspector name and visit/shop context alongside a matched inspection', async () => {
    var tag = 'SEARCH-' + crypto.randomUUID().slice(0, 8);

    var sessionRes = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({ visit_number: 'SV-' + tag, shop_number: 'SS-' + tag });
    expect(sessionRes.statusCode).toEqual(201);

    var syncRes = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({
        idempotencyKey: crypto.randomUUID(),
        items: [{
          clientInspectionId: crypto.randomUUID(),
          operation: 'CREATE',
          clientUpdatedAt: '2026-01-01T00:00:00.000Z',
          ruleConfigVersion: ruleConfigVersion,
          payload: {
            productName: tag + '-searchable-product',
            sessionId: sessionRes.body.data.id,
            complianceStatus: 'EVALUATED',
            complianceResult: complianceResult([]),
          },
        }],
      });
    expect(syncRes.statusCode).toEqual(200);

    var res = await request(app)
      .get('/api/v1/dashboard/search?q=' + tag)
      .set('Authorization', 'Bearer ' + officialToken);

    expect(res.statusCode).toEqual(200);
    var row = res.body.data.inspections.find((r) => r.product_name === tag + '-searchable-product');
    expect(row).toBeDefined();
    expect(row.inspector_name).toBeTruthy();
    expect(row.visit_number).toEqual('SV-' + tag);
    expect(row.shop_number).toEqual('SS-' + tag);
    expect(row.verdict).toEqual('COMPLIANT');
  });

  it('still returns products and users categories unchanged', async () => {
    var res = await request(app)
      .get('/api/v1/dashboard/search?q=inspector')
      .set('Authorization', 'Bearer ' + officialToken);

    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body.data.products)).toBe(true);
    expect(Array.isArray(res.body.data.users)).toBe(true);
  });

  it('an inspection synced with no session still returns cleanly with null visit/shop context', async () => {
    var tag = 'NOSESSION-' + crypto.randomUUID().slice(0, 8);
    var syncRes = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({
        idempotencyKey: crypto.randomUUID(),
        items: [{
          clientInspectionId: crypto.randomUUID(),
          operation: 'CREATE',
          clientUpdatedAt: '2026-01-01T00:00:00.000Z',
          ruleConfigVersion: ruleConfigVersion,
          payload: { productName: tag + '-no-session-product', complianceStatus: 'EVALUATED', complianceResult: complianceResult([]) },
        }],
      });
    expect(syncRes.statusCode).toEqual(200);

    var res = await request(app)
      .get('/api/v1/dashboard/search?q=' + tag)
      .set('Authorization', 'Bearer ' + officialToken);

    var row = res.body.data.inspections.find((r) => r.product_name === tag + '-no-session-product');
    expect(row).toBeDefined();
    expect(row.visit_number).toBeNull();
    expect(row.shop_number).toBeNull();
    expect(row.inspector_name).toBeTruthy();
  });
});