const request = require('supertest');
const app = require('../../src/app');
const { pool } = require('../../src/config/db');

let inspectorToken;

beforeAll(async () => {
  // Get inspector auth token
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'inspector@compliance.local', password: 'password123' });
  inspectorToken = loginRes.body.data.token;
});

afterAll(async () => {
  await pool.end();
});

describe('Session API Integration', () => {
  describe('POST /api/v1/sessions - Create Session', () => {
    it('Creates session without optional fields', async () => {
      const res = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({});
      
      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.status).toEqual('OPEN');
      expect(res.body.data.start_time).toBeDefined();
      expect(res.body.data.visit_number).toBeNull();
      expect(res.body.data.shop_number).toBeNull();
      expect(res.body.data.gps_lat).toBeNull();
      expect(res.body.data.gps_lng).toBeNull();
    });

    it('Creates session with all visit data fields', async () => {
      const res = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({
          visit_number: 'VIS-2026-001',
          shop_number: 'SHOP-123',
          gps_lat: 28.6139,
          gps_lng: 77.2090
        });
      
      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.visit_number).toEqual('VIS-2026-001');
      expect(res.body.data.shop_number).toEqual('SHOP-123');
      expect(res.body.data.gps_lat).toBeCloseTo(28.6139, 4);
      expect(res.body.data.gps_lng).toBeCloseTo(77.2090, 4);
    });

    it('Creates session with only visit_number', async () => {
      const res = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({
          visit_number: 'VIS-2026-002'
        });
      
      expect(res.statusCode).toEqual(201);
      expect(res.body.data.visit_number).toEqual('VIS-2026-002');
      expect(res.body.data.shop_number).toBeNull();
    });

    it('Creates session with only GPS coordinates', async () => {
      const res = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({
          gps_lat: -33.8688,
          gps_lng: 151.2093
        });
      
      expect(res.statusCode).toEqual(201);
      expect(res.body.data.gps_lat).toBeCloseTo(-33.8688, 4);
      expect(res.body.data.gps_lng).toBeCloseTo(151.2093, 4);
    });

    it('Rejects visit_number exceeding 50 characters', async () => {
      const res = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({
          visit_number: 'A'.repeat(51)
        });
      
      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toEqual('VALIDATION_ERROR');
    });

    it('Rejects shop_number exceeding 50 characters', async () => {
      const res = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({
          shop_number: 'B'.repeat(51)
        });
      
      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toEqual('VALIDATION_ERROR');
    });

    it('Rejects invalid gps_lat below -90', async () => {
      const res = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({
          gps_lat: -91,
          gps_lng: 0
        });
      
      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toEqual('VALIDATION_ERROR');
    });

    it('Rejects invalid gps_lat above 90', async () => {
      const res = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({
          gps_lat: 91,
          gps_lng: 0
        });
      
      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toEqual('VALIDATION_ERROR');
    });

    it('Rejects invalid gps_lng below -180', async () => {
      const res = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({
          gps_lat: 0,
          gps_lng: -181
        });
      
      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toEqual('VALIDATION_ERROR');
    });

    it('Rejects invalid gps_lng above 180', async () => {
      const res = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({
          gps_lat: 0,
          gps_lng: 181
        });
      
      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toEqual('VALIDATION_ERROR');
    });

    it('Accepts boundary GPS values', async () => {
      const res = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({
          gps_lat: -90,
          gps_lng: -180
        });
      
      expect(res.statusCode).toEqual(201);
      expect(res.body.data.gps_lat).toBeCloseTo(-90, 1);
      expect(res.body.data.gps_lng).toBeCloseTo(-180, 1);
    });

    it('Rejects non-numeric gps_lat', async () => {
      const res = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({
          gps_lat: 'invalid',
          gps_lng: 0
        });
      
      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toEqual('VALIDATION_ERROR');
    });

    it('Rejects unauthorized extra fields', async () => {
      const res = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({
          visit_number: 'VIS-001',
          extra_field: 'should fail'
        });
      
      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toEqual('VALIDATION_ERROR');
    });

    it('Requires authentication', async () => {
      const res = await request(app)
        .post('/api/v1/sessions')
        .send({});
      
      expect(res.statusCode).toEqual(401);
    });
  });

  describe('GET /api/v1/sessions/:id - Get Session', () => {
    it('Returns session with visit data fields', async () => {
      // Create a session first
      const createRes = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({
          visit_number: 'VIS-2026-100',
          shop_number: 'SHOP-999',
          gps_lat: 40.7128,
          gps_lng: -74.0060
        });
      
      const sessionId = createRes.body.data.id;
      
      const res = await request(app)
        .get(`/api/v1/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${inspectorToken}`);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.visit_number).toEqual('VIS-2026-100');
      expect(res.body.data.shop_number).toEqual('SHOP-999');
      expect(res.body.data.gps_lat).toBeCloseTo(40.7128, 4);
      expect(res.body.data.gps_lng).toBeCloseTo(-74.0060, 4);
    });

    it('Enforces ownership isolation', async () => {
      // Get another inspector token
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'inspector2@compliance.local', password: 'password123' });
      const inspector2Token = loginRes.body.data.token;
      
      // Create session with inspector1
      const createRes = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({});
      
      const sessionId = createRes.body.data.id;
      
      // Try to access with inspector2
      const res = await request(app)
        .get(`/api/v1/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${inspector2Token}`);
      
      expect(res.statusCode).toEqual(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/sessions/:id/close - Close Session', () => {
    it('Closes session preserving visit data', async () => {
      // Create session
      const createRes = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({
          visit_number: 'VIS-2026-200',
          shop_number: 'SHOP-888'
        });
      
      const sessionId = createRes.body.data.id;
      
      // Close it
      const closeRes = await request(app)
        .patch(`/api/v1/sessions/${sessionId}/close`)
        .set('Authorization', `Bearer ${inspectorToken}`);
      
      expect(closeRes.statusCode).toEqual(200);
      expect(closeRes.body.success).toBe(true);
      expect(closeRes.body.data.status).toEqual('CLOSED');
      expect(closeRes.body.data.end_time).toBeDefined();
      
      // Verify visit data preserved
      const getRes = await request(app)
        .get(`/api/v1/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${inspectorToken}`);
      
      expect(getRes.body.data.visit_number).toEqual('VIS-2026-200');
      expect(getRes.body.data.shop_number).toEqual('SHOP-888');
    });

    it('Enforces ownership when closing', async () => {
      // Get another inspector token
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'inspector2@compliance.local', password: 'password123' });
      const inspector2Token = loginRes.body.data.token;
      
      // Create session with inspector1
      const createRes = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({});
      
      const sessionId = createRes.body.data.id;
      
      // Try to close with inspector2
      const res = await request(app)
        .patch(`/api/v1/sessions/${sessionId}/close`)
        .set('Authorization', `Bearer ${inspector2Token}`);
      
      expect(res.statusCode).toEqual(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Param validation (A5)', () => {
    it('GET /sessions/:id with a malformed id returns clean 400, not a raw 500', async () => {
      const res = await request(app)
        .get('/api/v1/sessions/not-a-real-uuid')
        .set('Authorization', `Bearer ${inspectorToken}`);

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toEqual('VALIDATION_ERROR');
    });

    it('PATCH /sessions/:id/close with a malformed id returns clean 400, not a raw 500', async () => {
      const res = await request(app)
        .patch('/api/v1/sessions/not-a-real-uuid/close')
        .set('Authorization', `Bearer ${inspectorToken}`);

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toEqual('VALIDATION_ERROR');
    });
  });
});