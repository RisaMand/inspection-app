// import.meta.env only exists inside Vite (dev server or build) -- Vite
// statically replaces it, so this guard is a no-op there. Outside Vite
// (this project's own plain `node --test` runner, used by every other
// src/lib test file) import.meta.env is undefined, and accessing
// .VITE_API_URL on it throws before this file can even be imported --
// confirmed live, this was a real gap: client.js could not be imported
// or tested by the app's own test runner at all until this guard existed.
const API_BASE = (typeof import.meta.env !== 'undefined' && import.meta.env.VITE_API_URL) || 'http://localhost:5000/api/v1';

async function request(path, { method = 'GET', body, token, includeMeta = false } = {}) {
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
  // includeMeta: pagination endpoints (page/limit/total/totalPages) put
  // that in the response envelope's `meta`, a sibling of `data` -- every
  // other caller only ever wanted `data` itself, so this defaults off to
  // avoid changing behavior for the 10+ existing call sites above.
  return includeMeta ? { data: data?.data, meta: data?.meta } : data?.data;
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

  // Section 2.6: the server-authoritative currently-active rule config.
  // See src/lib/ruleConfigCache.js for the fetch+cache+bundled-fallback
  // wrapper that actually calls this from useSession.js.
  getActiveRules: (token) =>
    request('/rules/active', { token }),

  // Section 2.7: barcode-keyed product lookup + prior compliance history.
  // No caller exists yet -- barcode scanning itself (audit 1.5) isn't
  // built on the FE -- but the client call is written and ready, so
  // nothing here waits on 1.5 to exist before the pipe can carry it.
  lookupProductByBarcode: (token, barcode) =>
    request(`/products/lookup?barcode=${encodeURIComponent(barcode)}`, { token }),
  getProductHistory: (token, productId) =>
    request(`/products/${productId}/history`, { token }),

  // Section 2.8: dashboard screens, previously all on mockDashboardData.js.
  // getReportData: the full per-item report contract (verdict, extracted
  // fields, signed photo URLs, visit/inspector context) -- see
  // translateReportForDisplay.js for the {item, session} shape adapter
  // ReportViewer.jsx/ComplianceReportBody.jsx actually need.
  getReportData: (token, id) =>
    request(`/inspections/${id}/report-data`, { token }),
  getDashboardSummary: (token, { from, to } = {}) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    return request(`/dashboard/summary${qs ? `?${qs}` : ''}`, { token });
  },
  getViolations: (token) =>
    request('/dashboard/violations', { token }),
  getOfficerActivity: (token) =>
    request('/dashboard/officer-activity', { token }),
  getInspectors: (token) =>
    request('/dashboard/inspectors', { token }),
  searchDashboard: (token, q) =>
    request(`/dashboard/search?q=${encodeURIComponent(q)}`, { token }),
  // Backs FilterDrilldown.jsx -- date range/shop/severity filters added to
  // the shared getInspections handler in the 2.8 backend patch. Returns
  // {data, meta} (meta carries total/page/limit/totalPages for pagination
  // controls) rather than just data, since this is the first paginated
  // endpoint this client has ever called.
  getFilteredInspections: (token, filters = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, value);
      }
    }
    const qs = params.toString();
    return request(`/dashboard/inspections${qs ? `?${qs}` : ''}`, { token, includeMeta: true });
  },
};