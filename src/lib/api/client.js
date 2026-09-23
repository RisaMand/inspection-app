// import.meta.env only exists inside Vite (dev server or build) -- Vite
// statically replaces it, so this guard is a no-op there. Outside Vite
// (this project's own plain `node --test` runner, used by every other
// src/lib test file) import.meta.env is undefined, and accessing
// .VITE_API_URL on it throws before this file can even be imported --
// confirmed live, this was a real gap: client.js could not be imported
// or tested by the app's own test runner at all until this guard existed.
const API_BASE = (typeof import.meta.env !== 'undefined' && import.meta.env.VITE_API_URL) || 'http://localhost:5000/api/v1';

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const err = new Error(data?.error?.message || `Request failed: ${res.status}`);
    err.status = res.status;
    err.code = data?.error?.code;
    throw err;
  }
  return data?.data;
}

export const api = {
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: { email, password } }),
  createSession: (token, payload) =>
    request('/sessions', { method: 'POST', body: payload, token }),
  closeSession: (token, id) =>
    request(`/sessions/${id}/close`, { method: 'PATCH', token }),
  // F2, architecture B: this is permission to upload one specific photo
  // path -- the actual bytes never go through this backend or this
  // client function. See src/lib/api/photoUpload.js for the real upload.
  createUploadUrl: (token) =>
    request('/photos/upload-url', { method: 'POST', token }),
  // Section 2.5: the core of the FE<->BE sync arc -- items[] entries are
  // built by translateItemForSync.js, one idempotencyKey per batch so a
  // retried sync (e.g. after a dropped connection) never double-creates
  // server rows for the same items.
  syncInspections: (token, { deviceId, idempotencyKey, items }) =>
    request('/sync/inspections', { method: 'POST', body: { deviceId, idempotencyKey, items }, token }),
};