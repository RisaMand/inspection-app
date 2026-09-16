const request = require('supertest');
const app = require('../../src/app');
const { pool } = require('../../src/config/db');

let adminToken;

beforeAll(async () => {
  const res = await request(app).post('/api/v1/auth/login').send({ email: 'admin@compliance.local', password: 'password123' });
  adminToken = res.body.data.token;
});

afterAll(async () => {
  await pool.end();
});

describe('rule-config create -> activate (A3)', () => {

  it('create returns no id (documenting the old dead end is gone by not needing one)', async () => {
    const version = 'A3-TEST-' + Date.now();
    const res = await request(app)
      .post('/api/v1/rules')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ version, rules: { schemaVersion: '1.0', rules: [] } });

    expect(res.status).toBe(201);
    expect(res.body.data.version).toEqual(version);
    expect(res.body.data.status).toEqual('DRAFT');
  });

  it('activates the created version using version, not id, and it becomes ACTIVE', async () => {
    const version = 'A3-TEST-ACTIVATE-' + Date.now();
    await request(app)
      .post('/api/v1/rules')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ version, rules: { schemaVersion: '1.0', rules: [] } });

    const activateRes = await request(app)
      .post('/api/v1/rules/' + version + '/activate')
      .set('Authorization', 'Bearer ' + adminToken);

    expect(activateRes.status).toBe(200);
    expect(activateRes.body.data.version).toEqual(version);
    expect(activateRes.body.data.status).toEqual('ACTIVE');

    const checkRow = await pool.query('SELECT status FROM rule_configs WHERE version = $1', [version]);
    expect(checkRow.rows[0].status).toEqual('ACTIVE');
  });

  it('activating an unknown version returns a clean 404, not a raw Postgres error', async () => {
    const res = await request(app)
      .post('/api/v1/rules/NOPE-DOES-NOT-EXIST/activate')
      .set('Authorization', 'Bearer ' + adminToken);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toEqual('NOT_FOUND');
  });

});