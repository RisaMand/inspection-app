// photoUpload.test.js — verifies the upload-URL round trip and the
// fail-fast behavior of uploadPhotos, against a mocked global.fetch.
// Doesn't touch a real Supabase bucket (no credentials available to a
// test run) — that live verification still has to happen against the
// real deployed backend, separately, before this is trusted end to end.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { uploadPhoto, uploadPhotos } from './photoUpload.js';

const TINY_JPEG_DATA_URL = 'data:image/jpeg;base64,' + Buffer.from('fake-jpeg-bytes').toString('base64');

let originalFetch;
let calls;

before(() => {
  originalFetch = global.fetch;
});

after(() => {
  global.fetch = originalFetch;
});

beforeEach(() => {
  calls = [];
});

// A minimal fetch stub that only understands the two real HTTP calls this
// module makes (the backend's upload-url endpoint, and the signed PUT) --
// data: URLs pass through to the real, native fetch (verified separately
// to already support them), so this stub doesn't need to fake that part.
function stubFetch({ uploadUrlOk = true, putOk = true } = {}) {
  global.fetch = async (url, opts) => {
    calls.push({ url, opts });

    if (typeof url === 'string' && url.startsWith('data:')) {
      return originalFetch(url, opts);
    }

    if (typeof url === 'string' && url.includes('/photos/upload-url')) {
      if (!uploadUrlOk) {
        return { ok: false, status: 401, json: async () => ({ success: false, error: { message: 'Unauthorized' } }) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { path: 'inspector-1/photo-1.jpg', signedUrl: 'https://fake.supabase.co/upload?token=abc', token: 'abc' },
        }),
      };
    }

    if (typeof url === 'string' && url.includes('fake.supabase.co')) {
      return putOk
        ? { ok: true, status: 200 }
        : { ok: false, status: 500 };
    }

    throw new Error(`Unexpected fetch call in test: ${url}`);
  };
}

describe('uploadPhoto', () => {
  it('asks for a signed URL, PUTs the decoded bytes, and returns the real storage path', async () => {
    stubFetch();

    const path = await uploadPhoto('fake-token', TINY_JPEG_DATA_URL);

    assert.equal(path, 'inspector-1/photo-1.jpg');

    const uploadUrlCall = calls.find((c) => String(c.url).includes('/photos/upload-url'));
    assert.ok(uploadUrlCall, 'should have requested a signed upload URL');
    assert.equal(uploadUrlCall.opts.headers.Authorization, 'Bearer fake-token');

    const putCall = calls.find((c) => String(c.url).includes('fake.supabase.co'));
    assert.ok(putCall, 'should have PUT the photo bytes to the signed URL');
    assert.equal(putCall.opts.method, 'PUT');
    assert.equal(putCall.opts.headers['Content-Type'], 'image/jpeg');
  });

  it('throws when the backend refuses to issue a signed URL', async () => {
    stubFetch({ uploadUrlOk: false });

    await assert.rejects(() => uploadPhoto('fake-token', TINY_JPEG_DATA_URL));
  });

  it('throws when the PUT to Supabase Storage itself fails', async () => {
    stubFetch({ putOk: false });

    await assert.rejects(
      () => uploadPhoto('fake-token', TINY_JPEG_DATA_URL),
      /Photo upload failed \(500\)/
    );
  });
});

describe('uploadPhotos', () => {
  it('uploads every photo in order and returns their paths', async () => {
    let n = 0;
    global.fetch = async (url, opts) => {
      calls.push({ url, opts });
      if (typeof url === 'string' && url.startsWith('data:')) return originalFetch(url, opts);
      if (typeof url === 'string' && url.includes('/photos/upload-url')) {
        n += 1;
        return { ok: true, status: 200, json: async () => ({ success: true, data: { path: `inspector-1/photo-${n}.jpg`, signedUrl: 'https://fake.supabase.co/upload', token: 'abc' } }) };
      }
      if (typeof url === 'string' && url.includes('fake.supabase.co')) return { ok: true, status: 200 };
      throw new Error(`Unexpected fetch call in test: ${url}`);
    };

    const paths = await uploadPhotos('fake-token', [TINY_JPEG_DATA_URL, TINY_JPEG_DATA_URL, TINY_JPEG_DATA_URL]);

    assert.deepEqual(paths, ['inspector-1/photo-1.jpg', 'inspector-1/photo-2.jpg', 'inspector-1/photo-3.jpg']);
  });

  it('fails fast on the first bad photo and never uploads the rest', async () => {
    let uploadUrlRequests = 0;
    global.fetch = async (url, opts) => {
      if (typeof url === 'string' && url.startsWith('data:')) return originalFetch(url, opts);
      if (typeof url === 'string' && url.includes('/photos/upload-url')) {
        uploadUrlRequests += 1;
        return { ok: true, status: 200, json: async () => ({ success: true, data: { path: `inspector-1/photo-${uploadUrlRequests}.jpg`, signedUrl: 'https://fake.supabase.co/upload', token: 'abc' } }) };
      }
      if (typeof url === 'string' && url.includes('fake.supabase.co')) {
        // Second photo's PUT fails; first and third would otherwise succeed.
        return uploadUrlRequests === 2 ? { ok: false, status: 500 } : { ok: true, status: 200 };
      }
      throw new Error(`Unexpected fetch call in test: ${url}`);
    };

    await assert.rejects(() => uploadPhotos('fake-token', [TINY_JPEG_DATA_URL, TINY_JPEG_DATA_URL, TINY_JPEG_DATA_URL]));

    // Only the first two photos should have even requested a signed URL --
    // the third must never be attempted once the second one threw.
    assert.equal(uploadUrlRequests, 2);
  });
});