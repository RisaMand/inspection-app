import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyLoginError } from './classifyLoginError.js';

describe('classifyLoginError', () => {
  it('classifies a real 401 (wrong credentials) response as invalid_credentials', () => {
    const err = new Error('Invalid email or password');
    err.status = 401;
    err.code = 'UNAUTHORIZED';
    assert.equal(classifyLoginError(err), 'invalid_credentials');
  });

  it('classifies a real 500 server error as invalid_credentials, not network', () => {
    // A real HTTP response came back (however bad) -- the client is
    // online, the server itself failed. Distinct from "no connection".
    const err = new Error('Internal server error');
    err.status = 500;
    assert.equal(classifyLoginError(err), 'invalid_credentials');
  });

  it('classifies a raw fetch failure (no status at all) as network', () => {
    // This is what a real browser throws when fetch() can't reach the
    // server at all (offline, DNS failure, etc) -- no response ever
    // existed, so client.js's request() never got to set err.status.
    const err = new TypeError('Failed to fetch');
    assert.equal(classifyLoginError(err), 'network');
  });

  it('treats a missing error (falsy) as network rather than throwing', () => {
    assert.equal(classifyLoginError(null), 'network');
    assert.equal(classifyLoginError(undefined), 'network');
  });

  it('treats status 0 as network, not a real response', () => {
    // Some environments report status 0 for a genuinely failed/aborted
    // request rather than throwing before a status exists at all --
    // status === undefined is the real signal, but 0 is never a real
    // HTTP status either, so it should not be read as invalid_credentials.
    const err = new Error('network error');
    err.status = 0;
    assert.equal(classifyLoginError(err), 'network');
  });
});
