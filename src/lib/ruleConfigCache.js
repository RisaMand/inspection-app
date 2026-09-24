// src/lib/ruleConfigCache.js — FE<->BE sync integration, Section 2.6.
//
// Before this, the app ran entirely off its bundled Ruleconfig.json with no
// way to know if the server's active version had changed. This fetches
// GET /rules/active (fully built, per the backend audit) and caches the
// result in IndexedDB (the 'auth' store, same generic key-value pattern
// useAuth.js already uses) so a later offline launch still has the
// last-known-good server config rather than falling straight back to the
// bundled file every time.
//
// Falls back to the bundled Ruleconfig.json when: there's no token yet,
// the fetch fails (offline, or the server has no ACTIVE config seeded
// yet -- a real, separate backend/ops gap this frontend piece has no
// business papering over), or nothing has ever been cached. The bundled
// file is the correct fallback in every one of those cases, not an error.
import { dbPromise } from '../db/db.js';
import { api } from './api/client.js';
import bundledRuleConfig from './rules/Ruleconfig.json' with { type: 'json' };

const RULE_CONFIG_CACHE_KEY = 'ruleConfigCache';

/**
 * Fetches the server's currently-active rule config and caches it locally.
 * Never throws -- a failed fetch is a normal, expected offline/unseeded-
 * server outcome, not something calling code needs to handle specially.
 *
 * @param {string|null} token
 * @returns {Promise<{version: string, rules: Array} | null>} The freshly-fetched config, or null if the fetch didn't succeed (caller should fall back to getActiveRuleConfig()).
 */
export async function fetchAndCacheActiveRuleConfig(token) {
  if (!token) return null;
  try {
    const remote = await api.getActiveRules(token);
    if (!remote?.version || !Array.isArray(remote.rules)) return null;
    const db = await dbPromise;
    await db.put(
      'auth',
      { version: remote.version, rules: remote.rules, fetchedAt: new Date().toISOString() },
      RULE_CONFIG_CACHE_KEY
    );
    return { version: remote.version, rules: remote.rules };
  } catch (err) {
    console.warn('Could not fetch active rule config from server, will use cached/bundled config:', err.message);
    return null;
  }
}

/**
 * Returns the rule config to actually use right now: the most recently
 * cached server config if one exists, else the bundled Ruleconfig.json.
 * Synchronous-feeling but reads IndexedDB, so it's async -- callers that
 * need this at compliance-check time (addItem()) should await it once
 * and reuse the result for that item, not re-read per rule.
 *
 * @returns {Promise<{version: string, rules: Array, source: 'server'|'bundled'}>}
 */
export async function getActiveRuleConfig() {
  try {
    const db = await dbPromise;
    const cached = await db.get('auth', RULE_CONFIG_CACHE_KEY);
    if (cached?.version && Array.isArray(cached.rules)) {
      return { version: cached.version, rules: cached.rules, source: 'server' };
    }
  } catch (err) {
    console.warn('Could not read cached rule config, using bundled config:', err.message);
  }
  return { version: bundledRuleConfig.version, rules: bundledRuleConfig.rules, source: 'bundled' };
}
