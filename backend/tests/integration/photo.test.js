const request = require('supertest');
const app = require('../../src/app');
const { pool } = require('../../src/config/db');

var inspectorToken;
var officialToken;

beforeAll(async () => {
  var res = await request(app).post('/api/v1/auth/login').send({ email: 'inspector@compliance.local', password: 'password123' });
  inspectorToken = res.body.data.token;
  var res2 = await request(app).post('/api/v1/auth/login').send({ email: 'official@compliance.local', password: 'password123' });
  officialToken = res2.body.data.token;
});

afterAll(async () => {
  await pool.end();
});

var UUID_PATH_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/i;

describe('Photo Upload URL API (F2)', () => {
  it('INSPECTOR gets a real signed upload URL and a real storage path', async () => {
    var res = await request(app)
      .post('/api/v1/photos/upload-url')
      .set('Authorization', 'Bearer ' + inspectorToken);

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.path).toMatch(UUID_PATH_RE);
    expect(res.body.data.signedUrl).toEqual(expect.stringContaining('mock.supabase.co'));
    expect(res.body.data.token).toBeDefined();
  });

  it('the returned path is namespaced under the calling inspector\'s own id', async () => {
    var res = await request(app)
      .post('/api/v1/photos/upload-url')
      .set('Authorization', 'Bearer ' + inspectorToken);

    expect(res.body.data.path.startsWith('33333333-3333-3333-3333-333333333333/')).toBe(true);
  });

  it('two requests never return the same path', async () => {
    var res1 = await request(app).post('/api/v1/photos/upload-url').set('Authorization', 'Bearer ' + inspectorToken);
    var res2 = await request(app).post('/api/v1/photos/upload-url').set('Authorization', 'Bearer ' + inspectorToken);

    expect(res1.body.data.path).not.toEqual(res2.body.data.path);
  });

  it('rejects an unauthenticated request with 401', async () => {
    var res = await request(app).post('/api/v1/photos/upload-url');
    expect(res.statusCode).toEqual(401);
  });

  it('rejects OFFICIAL with 403 -- officials never capture photos', async () => {
    var res = await request(app)
      .post('/api/v1/photos/upload-url')
      .set('Authorization', 'Bearer ' + officialToken);

    expect(res.statusCode).toEqual(403);
  });
});