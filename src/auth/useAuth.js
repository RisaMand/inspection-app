import { useState, useEffect } from 'react';
import { dbPromise } from '../db/db';

// Hardcoded auth check for R1 demo. Swap this function's internals for real
// JWT/session logic later — nothing outside this file should need to change.
function checkAuth(username, password) {
  return true; // always succeeds, per Team Bible R1 scope
}

const AUTH_KEY = 'authState'; // { isLoggedIn, role, username, userId }
const USER_ID_MAP_KEY = 'userIdMap'; // { [username]: userId } — grows over time

// Resolve a stable, unique userId for a given username. First login for a
// username generates a new id and remembers it; every later login with the
// same username returns the same id. No password is ever stored — it isn't
// checked against anything real yet (checkAuth always succeeds), so storing
// it would be a false sense of security, not a real one.
async function resolveUserId(username) {
  const db = await dbPromise;
  const map = (await db.get('auth', USER_ID_MAP_KEY)) || {};

  if (!map[username]) {
    map[username] = crypto.randomUUID();
    await db.put('auth', map, USER_ID_MAP_KEY);
  }

  return map[username];
}

export function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [role, setRole] = useState(null); // 'inspector' | 'official'
  const [username, setUsername] = useState(null);
  const [userId, setUserId] = useState(null);
  const [authLoaded, setAuthLoaded] = useState(false); // true once IndexedDB read completes

  // On mount, restore auth state from IndexedDB — this is what survives a refresh.
  useEffect(() => {
    async function loadAuth() {
      const db = await dbPromise;
      const stored = await db.get('auth', AUTH_KEY);
      if (stored) {
        setIsLoggedIn(stored.isLoggedIn);
        setRole(stored.role);
        setUsername(stored.username ?? null);
        setUserId(stored.userId ?? null);
      }
      setAuthLoaded(true);
    }
    loadAuth();
  }, []);

  async function login(loginUsername, password, selectedRole) {
    const success = checkAuth(loginUsername, password);
    if (success) {
      const resolvedUserId = await resolveUserId(loginUsername);

      setIsLoggedIn(true);
      setRole(selectedRole);
      setUsername(loginUsername);
      setUserId(resolvedUserId);

      const db = await dbPromise;
      await db.put(
        'auth',
        { isLoggedIn: true, role: selectedRole, username: loginUsername, userId: resolvedUserId },
        AUTH_KEY
      );
    }
    return success;
  }

  async function logout() {
    setIsLoggedIn(false);
    setRole(null);
    setUsername(null);
    setUserId(null);
    const db = await dbPromise;
    await db.delete('auth', AUTH_KEY);
  }

  return { isLoggedIn, role, username, userId, login, logout, authLoaded };
}