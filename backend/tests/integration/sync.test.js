const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const { pool } = require('../../src/config/db');

var inspectorToken;
var ruleConfigVersion = 'LMR-2011-v1';

beforeAll(async () => {
  var res = await request(app).post('/api/v1/auth/login').send({ email: 'inspector@compliance.local', password: 'password123' });
  inspectorToken = res.body.data.token;
});

afterAll(async () => {
  await pool.end();
});

describe('Sync API Integration', () => {
  var clientInspectionId = crypto.randomUUID();
  var idempotencyKey = crypto.randomUUID();
  var fixedTimestamp = '2026-01-01T00:00:00.000Z';

  // Build the payload once so the hash is identical on replay
  var syncPayload = {
    idempotencyKey: idempotencyKey,
    items: [{
      clientInspectionId: clientInspectionId,
      baseServerVersion: 1,
      operation: 'CREATE',
      clientUpdatedAt: fixedTimestamp,
      ruleConfigVersion: ruleConfigVersion,
      payload: { productName: 'Sync Test Product' }
    }]
  };

  it('Sync create succeeds', async () => {
    var res = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send(syncPayload);

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.results[0].status).toEqual('SYNCED');
    expect(res.body.data.results[0].serverId).toBeDefined();
  });

  it('CREATE without baseServerVersion succeeds', async () => {
    var newClientId = crypto.randomUUID();
    var newKey = crypto.randomUUID();
    
    var res = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({
        idempotencyKey: newKey,
        items: [{
          clientInspectionId: newClientId,
          operation: 'CREATE',
          clientUpdatedAt: fixedTimestamp,
          ruleConfigVersion: ruleConfigVersion,
          payload: { productName: 'CREATE without version' }
        }]
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.results[0].status).toEqual('SYNCED');
    expect(res.body.data.results[0].serverId).toBeDefined();
  });

  it('CREATE persists marketedByName/Address, and UPDATE can change them (BE Item 2)', async () => {
    var clientId = crypto.randomUUID();

    var createRes = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({
        idempotencyKey: crypto.randomUUID(),
        items: [{
          clientInspectionId: clientId,
          operation: 'CREATE',
          clientUpdatedAt: fixedTimestamp,
          ruleConfigVersion: ruleConfigVersion,
          payload: {
            productName: 'Marketed-By Test Product',
            marketedByName: 'Acme Marketing Co',
            marketedByAddress: '1 Marketing Plaza, Mumbai'
          }
        }]
      });

    expect(createRes.statusCode).toEqual(200);
    expect(createRes.body.data.results[0].status).toEqual('SYNCED');
    var serverId = createRes.body.data.results[0].serverId;

    var afterCreate = await pool.query('SELECT marketed_by_name, marketed_by_address, server_version FROM inspections WHERE id = $1', [serverId]);
    expect(afterCreate.rows[0].marketed_by_name).toEqual('Acme Marketing Co');
    expect(afterCreate.rows[0].marketed_by_address).toEqual('1 Marketing Plaza, Mumbai');

    var updateRes = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({
        idempotencyKey: crypto.randomUUID(),
        items: [{
          clientInspectionId: clientId,
          serverId: serverId,
          baseServerVersion: afterCreate.rows[0].server_version,
          operation: 'UPDATE',
          clientUpdatedAt: fixedTimestamp,
          ruleConfigVersion: ruleConfigVersion,
          payload: { marketedByName: 'Beta Marketing LLP' }
        }]
      });

    expect(updateRes.statusCode).toEqual(200);
    expect(updateRes.body.data.results[0].status).toEqual('SYNCED');

    var afterUpdate = await pool.query('SELECT marketed_by_name, marketed_by_address FROM inspections WHERE id = $1', [serverId]);
    expect(afterUpdate.rows[0].marketed_by_name).toEqual('Beta Marketing LLP');
    // Address wasn't in the UPDATE payload -- confirms partial-update preserves
    // the untouched field rather than nulling it out.
    expect(afterUpdate.rows[0].marketed_by_address).toEqual('1 Marketing Plaza, Mumbai');
  });

  it('UPDATE without baseServerVersion fails validation', async () => {
    var res = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({
        idempotencyKey: crypto.randomUUID(),
        items: [{
          clientInspectionId: clientInspectionId,
          operation: 'UPDATE',
          clientUpdatedAt: fixedTimestamp,
          ruleConfigVersion: ruleConfigVersion,
          payload: { productName: 'Should Fail' }
        }]
      });

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toEqual('VALIDATION_ERROR');
  });

  it('UPDATE with valid baseServerVersion succeeds', async () => {
    var updateKey = crypto.randomUUID();
    var res = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({
        idempotencyKey: updateKey,
        items: [{
          clientInspectionId: clientInspectionId,
          baseServerVersion: 1,
          operation: 'UPDATE',
          clientUpdatedAt: fixedTimestamp,
          ruleConfigVersion: ruleConfigVersion,
          payload: { productName: 'Updated Product' }
        }]
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.results[0].status).toEqual('SYNCED');
  });

  it('Stale UPDATE returns CONFLICT', async () => {
    var staleKey = crypto.randomUUID();
    var res = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({
        idempotencyKey: staleKey,
        items: [{
          clientInspectionId: clientInspectionId,
          baseServerVersion: 1,
          operation: 'UPDATE',
          clientUpdatedAt: fixedTimestamp,
          ruleConfigVersion: ruleConfigVersion,
          payload: { productName: 'Should Not Overwrite' }
        }]
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.results[0].status).toEqual('CONFLICT');
    expect(res.body.data.results[0].serverVersion).toBeGreaterThan(1);
  });

  it('Replayed sync request returns original result (idempotency)', async () => {
    var res = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send(syncPayload);

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.results[0].status).toEqual('SYNCED');
  });

  it('Same idempotency key with different request payload returns 409', async () => {
    var differentPayload = {
      idempotencyKey: idempotencyKey,
      items: [{
        clientInspectionId: crypto.randomUUID(),
        baseServerVersion: 1,
        operation: 'CREATE',
        clientUpdatedAt: fixedTimestamp,
        ruleConfigVersion: ruleConfigVersion,
        payload: { productName: 'Different Product' }
      }]
    };

    var res = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send(differentPayload);

    expect(res.statusCode).toEqual(409);
  });

  it('Sync conflict does not overwrite server data', async () => {
    // First update the inspection to bump server_version to 2
    var updateKey = crypto.randomUUID();
    await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({
        idempotencyKey: updateKey,
        items: [{
          clientInspectionId: clientInspectionId,
          baseServerVersion: 1,
          operation: 'UPDATE',
          clientUpdatedAt: fixedTimestamp,
          ruleConfigVersion: ruleConfigVersion,
          payload: { productName: 'Updated Product' }
        }]
      });

    // Now send a stale update with baseServerVersion: 1 (should be 2)
    var staleKey = crypto.randomUUID();
    var res = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({
        idempotencyKey: staleKey,
        items: [{
          clientInspectionId: clientInspectionId,
          baseServerVersion: 1,
          operation: 'UPDATE',
          clientUpdatedAt: fixedTimestamp,
          ruleConfigVersion: ruleConfigVersion,
          payload: { productName: 'Should Not Overwrite' }
        }]
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.results[0].status).toEqual('CONFLICT');
    expect(res.body.data.results[0].serverVersion).toBeGreaterThan(1);
  });

  it('One bad item in a batch does not roll back the other items (A2)', async () => {
    var goodId1 = crypto.randomUUID();
    var badId = crypto.randomUUID();
    var goodId2 = crypto.randomUUID();

    var res = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({
        idempotencyKey: crypto.randomUUID(),
        items: [
          {
            clientInspectionId: goodId1,
            operation: 'CREATE',
            clientUpdatedAt: fixedTimestamp,
            ruleConfigVersion: ruleConfigVersion,
            payload: { productName: 'Good Item Before Bad One' }
          },
          {
            // product_name is VARCHAR(255) in the DB but the request
            // validator only checks z.string() with no max length, so a
            // 300-char value passes validation and only fails once it
            // actually hits Postgres -- a real mid-transaction DB error,
            // exactly the case A2 is meant to isolate.
            clientInspectionId: badId,
            operation: 'CREATE',
            clientUpdatedAt: fixedTimestamp,
            ruleConfigVersion: ruleConfigVersion,
            payload: { productName: 'x'.repeat(300) }
          },
          {
            clientInspectionId: goodId2,
            operation: 'CREATE',
            clientUpdatedAt: fixedTimestamp,
            ruleConfigVersion: ruleConfigVersion,
            payload: { productName: 'Good Item After Bad One' }
          }
        ]
      });

    expect(res.statusCode).toEqual(200);
    var results = res.body.data.results;
    var byId = {};
    results.forEach(function (r) { byId[r.clientInspectionId] = r; });

    expect(byId[goodId1].status).toEqual('SYNCED');
    expect(byId[goodId1].serverId).toBeDefined();
    expect(byId[badId].status).toEqual('ERROR');
    expect(byId[goodId2].status).toEqual('SYNCED');
    expect(byId[goodId2].serverId).toBeDefined();

    // Prove the good items actually persisted (not just reported SYNCED
    // before an outer rollback silently discarded them) by re-fetching them
    // via a completely separate request.
    var check1 = await request(app)
      .get('/api/v1/inspections/' + byId[goodId1].serverId)
      .set('Authorization', 'Bearer ' + inspectorToken);
    expect(check1.statusCode).toEqual(200);
    expect(check1.body.data.product_name).toEqual('Good Item Before Bad One');

    var check2 = await request(app)
      .get('/api/v1/inspections/' + byId[goodId2].serverId)
      .set('Authorization', 'Bearer ' + inspectorToken);
    expect(check2.statusCode).toEqual(200);
    expect(check2.body.data.product_name).toEqual('Good Item After Bad One');
  });

  // F1 -- sync accepts an already-computed Rule Engine verdict directly on
  // the item, instead of requiring a separate ADMIN-only attach call.
  var realComplianceResult = {
    verdict: 'NON_COMPLIANT',
    totalRules: 6,
    passedRules: 4,
    failedRules: 2,
    skippedRules: 0,
    failures: [{
      rule_id: 'MRP_FORMAT',
      reason: 'Missing "inclusive of all taxes" phrasing',
      severity: 'substantive',
      clause_citation: 'Rule 6(1)(e)',
      confidence: 0.91
    }]
  };

  it('CREATE with a synced complianceResult persists it (F1)', async () => {
    var clientId = crypto.randomUUID();

    var res = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({
        idempotencyKey: crypto.randomUUID(),
        items: [{
          clientInspectionId: clientId,
          operation: 'CREATE',
          clientUpdatedAt: fixedTimestamp,
          ruleConfigVersion: ruleConfigVersion,
          payload: {
            productName: 'F1 Create Test Product',
            complianceResult: realComplianceResult
          }
        }]
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.results[0].status).toEqual('SYNCED');
    var serverId = res.body.data.results[0].serverId;

    var check = await request(app)
      .get('/api/v1/inspections/' + serverId)
      .set('Authorization', 'Bearer ' + inspectorToken);
    expect(check.statusCode).toEqual(200);
    expect(check.body.data.rule_engine_status).toEqual('EVALUATED');
    expect(check.body.data.compliance_result.verdict).toEqual('NON_COMPLIANT');
    expect(check.body.data.compliance_result.failures[0].rule_id).toEqual('MRP_FORMAT');
  });

  it('CREATE without a complianceResult still defaults to NOT_EVALUATED (F1, no regression)', async () => {
    var clientId = crypto.randomUUID();

    var res = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({
        idempotencyKey: crypto.randomUUID(),
        items: [{
          clientInspectionId: clientId,
          operation: 'CREATE',
          clientUpdatedAt: fixedTimestamp,
          ruleConfigVersion: ruleConfigVersion,
          payload: { productName: 'F1 No-Verdict Product' }
        }]
      });

    expect(res.statusCode).toEqual(200);
    var serverId = res.body.data.results[0].serverId;

    var check = await request(app)
      .get('/api/v1/inspections/' + serverId)
      .set('Authorization', 'Bearer ' + inspectorToken);
    expect(check.body.data.rule_engine_status).toEqual('NOT_EVALUATED');
    expect(check.body.data.compliance_result).toBeNull();
  });

  it('UPDATE with a synced complianceResult persists it, and leaves an existing one untouched when omitted (F1)', async () => {
    var clientId = crypto.randomUUID();

    var createRes = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({
        idempotencyKey: crypto.randomUUID(),
        items: [{
          clientInspectionId: clientId,
          operation: 'CREATE',
          clientUpdatedAt: fixedTimestamp,
          ruleConfigVersion: ruleConfigVersion,
          payload: { productName: 'F1 Update Test Product' }
        }]
      });
    var serverVersion = createRes.body.data.results[0].serverVersion;
    var serverId = createRes.body.data.results[0].serverId;

    var updateRes = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({
        idempotencyKey: crypto.randomUUID(),
        items: [{
          clientInspectionId: clientId,
          baseServerVersion: serverVersion,
          operation: 'UPDATE',
          clientUpdatedAt: fixedTimestamp,
          ruleConfigVersion: ruleConfigVersion,
          payload: { complianceResult: realComplianceResult }
        }]
      });
    expect(updateRes.body.data.results[0].status).toEqual('SYNCED');
    var newServerVersion = updateRes.body.data.results[0].serverVersion;

    var check1 = await request(app)
      .get('/api/v1/inspections/' + serverId)
      .set('Authorization', 'Bearer ' + inspectorToken);
    expect(check1.body.data.rule_engine_status).toEqual('EVALUATED');
    expect(check1.body.data.compliance_result.verdict).toEqual('NON_COMPLIANT');

    // A second UPDATE that doesn't mention complianceResult at all must not
    // wipe the verdict that's already there -- same "only touch what's
    // provided" contract every other field on this endpoint already honors.
    var secondUpdate = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({
        idempotencyKey: crypto.randomUUID(),
        items: [{
          clientInspectionId: clientId,
          baseServerVersion: newServerVersion,
          operation: 'UPDATE',
          clientUpdatedAt: fixedTimestamp,
          ruleConfigVersion: ruleConfigVersion,
          payload: { productName: 'F1 Update Test Product Renamed' }
        }]
      });
    expect(secondUpdate.body.data.results[0].status).toEqual('SYNCED');

    var check2 = await request(app)
      .get('/api/v1/inspections/' + serverId)
      .set('Authorization', 'Bearer ' + inspectorToken);
        expect(check2.body.data.product_name).toEqual('F1 Update Test Product Renamed');
    expect(check2.body.data.rule_engine_status).toEqual('EVALUATED');
    expect(check2.body.data.compliance_result.verdict).toEqual('NON_COMPLIANT');
  });

  // F2 (architecture B): imageReferences must be real storage paths from
  // POST /photos/upload-url -- never raw bytes, never a URL.
  it('F2: accepts a real storage path in imageReferences and stores it', async () => {
    var uploadUrlRes = await request(app)
      .post('/api/v1/photos/upload-url')
      .set('Authorization', 'Bearer ' + inspectorToken);
    var realPath = uploadUrlRes.body.data.path;

    var res = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({
        idempotencyKey: crypto.randomUUID(),
        items: [{
          clientInspectionId: crypto.randomUUID(),
          operation: 'CREATE',
          clientUpdatedAt: fixedTimestamp,
          ruleConfigVersion: ruleConfigVersion,
          payload: { productName: 'F2 Real Path Test Product', imageReferences: [realPath] }
        }]
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.results[0].status).toEqual('SYNCED');

    var check = await request(app)
      .get('/api/v1/inspections/' + res.body.data.results[0].serverId)
      .set('Authorization', 'Bearer ' + inspectorToken);
    expect(check.body.data.image_references).toEqual([realPath]);
  });

  it('F2: rejects raw base64 image data in imageReferences with a clean 400', async () => {
    var res = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({
        idempotencyKey: crypto.randomUUID(),
        items: [{
          clientInspectionId: crypto.randomUUID(),
          operation: 'CREATE',
          clientUpdatedAt: fixedTimestamp,
          ruleConfigVersion: ruleConfigVersion,
          payload: { imageReferences: ['data:image/jpeg;base64,AAAA'] }
        }]
      });

    expect(res.statusCode).toEqual(400);
  });

  it('F2: rejects the old {url, type} reference shape with a clean 400', async () => {
    var res = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({
        idempotencyKey: crypto.randomUUID(),
        items: [{
          clientInspectionId: crypto.randomUUID(),
          operation: 'CREATE',
          clientUpdatedAt: fixedTimestamp,
          ruleConfigVersion: ruleConfigVersion,
          payload: { imageReferences: [{ url: 'https://example.com/photo.jpg', type: 'front_panel' }] }
        }]
      });

    expect(res.statusCode).toEqual(400);
  });

  it('F2: rejects more than 20 images on one item with a clean 400', async () => {
    var tooMany = Array(21).fill('33333333-3333-3333-3333-333333333333/44444444-4444-4444-4444-444444444444.jpg');

    var res = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({
        idempotencyKey: crypto.randomUUID(),
        items: [{
          clientInspectionId: crypto.randomUUID(),
          operation: 'CREATE',
          clientUpdatedAt: fixedTimestamp,
          ruleConfigVersion: ruleConfigVersion,
          payload: { imageReferences: tooMany }
        }]
      });

    expect(res.statusCode).toEqual(400);
  });

  it('F2: report-data returns signed download URLs, never the raw stored path', async () => {
    var uploadUrlRes = await request(app)
      .post('/api/v1/photos/upload-url')
      .set('Authorization', 'Bearer ' + inspectorToken);
    var realPath = uploadUrlRes.body.data.path;

    var createRes = await request(app)
      .post('/api/v1/sync/inspections')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({
        idempotencyKey: crypto.randomUUID(),
        items: [{
          clientInspectionId: crypto.randomUUID(),
          operation: 'CREATE',
          clientUpdatedAt: fixedTimestamp,
          ruleConfigVersion: ruleConfigVersion,
          payload: { productName: 'F2 Report Data Test', imageReferences: [realPath] }
        }]
      });
    var serverId = createRes.body.data.results[0].serverId;

    var report = await request(app)
      .get('/api/v1/inspections/' + serverId + '/report-data')
      .set('Authorization', 'Bearer ' + inspectorToken);

    expect(report.statusCode).toEqual(200);
    expect(report.body.data.imageReferences).toHaveLength(1);
    expect(report.body.data.imageReferences[0]).not.toEqual(realPath);
    expect(report.body.data.imageReferences[0]).toEqual(expect.stringContaining('mock.supabase.co'));
    expect(report.body.data.imageReferences[0]).toEqual(expect.stringContaining(realPath));
  });
});