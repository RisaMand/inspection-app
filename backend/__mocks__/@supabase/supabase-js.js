// Manual mock, auto-applied by Jest to every test file (this is how Jest
// treats manual mocks placed under __mocks__ for real node_modules
// packages -- no explicit jest.mock() call needed per test file). Mirrors
// pg-mem's role for Postgres: a real substitute for the actual dependency,
// not a bypass of the code path under test.
//
// createSignedUploadUrl / createSignedUrl resolve deterministically so
// tests can assert on exact values instead of "did not throw".

function from(bucket) {
  return {
    createSignedUploadUrl: async (path) => ({
      data: {
        signedUrl: `https://mock.supabase.co/storage/v1/upload/sign/${bucket}/${path}?token=mock-upload-token`,
        token: 'mock-upload-token',
        path,
      },
      error: null,
    }),
    createSignedUrl: async (path, expiresInSeconds) => ({
      data: {
        signedUrl: `https://mock.supabase.co/storage/v1/sign/${bucket}/${path}?token=mock-download-token&expires=${expiresInSeconds}`,
      },
      error: null,
    }),
  };
}

function createClient(_url, _key) {
  return {
    storage: { from },
  };
}

module.exports = { createClient };