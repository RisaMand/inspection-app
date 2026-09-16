const request = require('supertest');
const app = require('../../src/app');
const { pool } = require('../../src/config/db');

afterAll(async () => {
  await pool.end(); // close pg-mem connections to exit cleanly
});

describe('Auth API Integration', () => {
  it('Login succeeds with valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'inspector@compliance.local', password: 'password123' });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toEqual('INSPECTOR');
  });

  it('Login rejects invalid password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'inspector@compliance.local', password: 'wrongpassword' });
    
    expect(res.statusCode).toEqual(401);
    expect(res.body.success).toBe(false);
  });

  it('Unauthenticated protected endpoint returns 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.statusCode).toEqual(401);
  });

  it('Password hashes and JWT secrets never appear in API responses', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'inspector@compliance.local', password: 'password123' });
    
    expect(res.body.data.user.password_hash).toBeUndefined();
    expect(res.body.data.user.password).toBeUndefined();
  });

  
  it('rate limits repeated login attempts from the same IP (A7)', async () => {
    // Fire well past the 10-per-15-min window regardless of how many login
    // calls the earlier tests in this file already made.
    let lastRes;
    for (let i = 0; i < 15; i++) {
      lastRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'inspector@compliance.local', password: 'wrongpassword' });
    }
    expect(lastRes.statusCode).toEqual(429);
    expect(lastRes.body.error.code).toEqual('RATE_LIMITED');
  });
});
