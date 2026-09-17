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