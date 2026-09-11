const request = require('supertest');
const app = require('../../src/app');
const { pool } = require('../../src/config/db');

let inspectorToken;
let officialToken;
let inspector2Token;
let adminToken;
let testInspectionId;
var testRuleConfigVersion = 'LMR-2011-v1';

beforeAll(async () => {
  var res1 = await request(app).post('/api/v1/auth/login').send({ email: 'inspector@compliance.local', password: 'password123' });
  inspectorToken = res1.body.data.token;

  var res2 = await request(app).post('/api/v1/auth/login').send({ email: 'official@compliance.local', password: 'password123' });
  officialToken = res2.body.data.token;

  var res3 = await request(app).post('/api/v1/auth/login').send({ email: 'inspector2@compliance.local', password: 'password123' });
  inspector2Token = res3.body.data.token;

  var res4 = await request(app).post('/api/v1/auth/login').send({ email: 'admin@compliance.local', password: 'password123' });
  adminToken = res4.body.data.token;

  var id = require('crypto').randomUUID();
  await pool.query(
    'INSERT INTO inspections (id, client_inspection_id, inspector_id, rule_config_version, status, server_version, mrp, client_updated_at) VALUES ($1, $1, $2, $3, $4, $5, $6, $7)',
    [id, '33333333-3333-3333-3333-333333333333', testRuleConfigVersion, 'DRAFT', 1, 100, '2026-01-01T00:00:00Z']
  );
  testInspectionId = id;
});

afterAll(async () => {
  await pool.end();
});

describe('Inspection API Integration', () => {
  it('Inspector cannot view another inspectors inspection', async () => {
    var res = await request(app)
      .get('/api/v1/inspections/' + testInspectionId)
      .set('Authorization', 'Bearer ' + inspector2Token);
    expect(res.statusCode).toEqual(403);
  });

  it('Official can view all inspections', async () => {
    var res = await request(app)
      .get('/api/v1/inspections/' + testInspectionId)
      .set('Authorization', 'Bearer ' + officialToken);
    expect(res.statusCode).toEqual(200);
  });

  it('Inspector cannot access admin rule-management endpoint', async () => {
    var res = await request(app)
      .post('/api/v1/rules')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({ version: 'v2', rules: {} });
    expect(res.statusCode).toEqual(403);
  });

  it('Update succeeds with current server_version', async () => {
    var res = await request(app)
      .patch('/api/v1/inspections/' + testInspectionId)
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({ server_version: 1, mrp: 200 });

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.server_version).toEqual(2);
  });

  it('Stale update returns 409', async () => {
    var res = await request(app)
      .patch('/api/v1/inspections/' + testInspectionId)
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({ server_version: 1, mrp: 300 });

    expect(res.statusCode).toEqual(409);
  });

  it('Inspection submit succeeds', async () => {
    var res = await request(app)
      .post('/api/v1/inspections/' + testInspectionId + '/submit')
      .set('Authorization', 'Bearer ' + inspectorToken)
      .send({ server_version: 2 });

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.status).toEqual('PENDING_REVIEW');
    expect(res.body.data.server_version).toEqual(3);
  });

  it('Attach compliance result succeeds when valid', async () => {
    var res = await request(app)
      .post('/api/v1/inspections/' + testInspectionId + '/compliance-result')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({
        ruleConfigVersion: testRuleConfigVersion,
        status: 'EVALUATED',
        result: {
          verdict: 'COMPLIANT'
        }
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.compliance_result.verdict).toEqual('COMPLIANT');
  });

  it('Report data includes all Legal Metrology fields', async () => {
    // Create inspection with all fields populated
    const crypto = require('crypto');
    const fullInspectionId = crypto.randomUUID();
    const clientInspectionId = crypto.randomUUID();
    
    await pool.query(`
      INSERT INTO inspections (
        id, client_inspection_id, inspector_id, rule_config_version, status,
        product_name, brand_name, manufacturer_name, manufacturer_address,
        packer_name, packer_address, importer_name, importer_address,
        declared_quantity, mrp, mrp_raw_text, packed_date, expiry_date,
        customer_care_details, barcode_value, client_updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
      )
    `, [
      fullInspectionId, clientInspectionId,
      '33333333-3333-3333-3333-333333333333', // inspector id
      testRuleConfigVersion, 'COMPLETED',
      'Test Product', 'Test Brand',
      'Test Manufacturer', '123 Manufacturer St',
      'Test Packer', '456 Packer Ave',
      'Test Importer', '789 Importer Rd',
      '500ml', 99.99, 'MRP Rs. 99.99',
      '2025-01-01', '2026-12-31',
      'Call 1800-XXX-XXXX', 'BAR123456',
      '2026-01-01T00:00:00Z'
    ]);

    var res = await request(app)
      .get('/api/v1/inspections/' + fullInspectionId + '/report-data')
      .set('Authorization', 'Bearer ' + inspectorToken);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    
    // Verify all fields are present
    const capturedData = res.body.data.capturedData;
    expect(capturedData.productName).toEqual('Test Product');
    expect(capturedData.brandName).toEqual('Test Brand');
    expect(capturedData.manufacturerName).toEqual('Test Manufacturer');
    expect(capturedData.manufacturerAddress).toEqual('123 Manufacturer St');
    expect(capturedData.packerName).toEqual('Test Packer');
    expect(capturedData.packerAddress).toEqual('456 Packer Ave');
    expect(capturedData.importerName).toEqual('Test Importer');
    expect(capturedData.importerAddress).toEqual('789 Importer Rd');
    expect(capturedData.declaredQuantity).toEqual('500ml');
    expect(capturedData.mrp).toEqual('99.99');
    expect(capturedData.mrpRawText).toEqual('MRP Rs. 99.99');
    expect(capturedData.expiryDate).toBeDefined();
    expect(capturedData.customerCareDetails).toEqual('Call 1800-XXX-XXXX');
    expect(capturedData.barcodeValue).toEqual('BAR123456');
  });
});
