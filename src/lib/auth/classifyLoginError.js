// src/lib/auth/classifyLoginError.js
// Section 2.9: useAuth.js's login() used to swallow every failure --
// wrong password, a 500, or genuinely no connectivity -- into one bare
// `return null`, surfaced to the user as "Login failed. Please check your
// credentials." Telling an offline field inspector their password is
// wrong when the real problem is no signal is actively misleading exactly
// when it matters most (they're standing in a shop with poor connectivity,
// which is the whole scenario this app is built for).
//
// This never uses navigator.onLine -- unreliable (false-positive on a
// captive portal or borderline signal) and unused anywhere else in this
// codebase. Every other offline handling here is reactive: catch the
// actual failed request and inspect it. client.js's request() only ever
// sets err.status when a real HTTP response came back (inside the
// `if (!res.ok)` branch); a genuine network failure means fetch() itself
// threw first, so err.status is never set at all. That's the signal.

/**
 * @param {Error & {status?: number}} err - the error thrown by api.login()
 * @returns {'network' | 'invalid_credentials'}
 */
export function classifyLoginError(err) {
  // A real HTTP status is always >= 100 -- any falsy value (undefined,
  // null, 0) means no real response ever came back, whatever the exact
  // cause (some environments report status 0 for a failed/aborted
  // request instead of never setting it at all).
  if (!err || !err.status) {
    return 'network';
  }
  return 'invalid_credentials';
}
