import { useState, useEffect } from 'react';
import { dbPromise } from '../db/db';
import { api } from '../lib/api/client';
import { classifyLoginError } from '../lib/auth/classifyLoginError.js';

const AUTH_KEY = 'authState'; // { isLoggedIn, role, username, userId, token }

export function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [role, setRole] = useState(null);
  const [username, setUsername] = useState(null);
  const [userId, setUserId] = useState(null);
  const [token, setToken] = useState(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  useEffect(() => {
    async function loadAuth() {
      const db = await dbPromise;
      const stored = await db.get('auth', AUTH_KEY);
      if (stored) {
        setIsLoggedIn(stored.isLoggedIn);
        setRole(stored.role);
        setUsername(stored.username ?? null);
        setUserId(stored.userId ?? null);
        setToken(stored.token ?? null);
      }
      setAuthLoaded(true);
    }
    loadAuth();
  }, []);

  async function login(email, password) {
    try {
      const { token, user } = await api.login(email, password);
      const resolvedRole = user.role.toLowerCase();

      setIsLoggedIn(true);
      setRole(resolvedRole);
      setUsername(user.email);
      setUserId(user.id);
      setToken(token);

      const db = await dbPromise;
      await db.put('auth',
        { isLoggedIn: true, role: resolvedRole, username: user.email, userId: user.id, token },
        AUTH_KEY
      );
      return { role: resolvedRole };
    } catch (err) {
      // Section 2.9: distinguish a genuine network failure from a real
      // server response (wrong password, a 500, etc) -- see
      // classifyLoginError.js for why and how. Resuming an ALREADY logged
      // in session works fully offline already (loadAuth() above only
      // ever reads IndexedDB, never the network, and nothing anywhere
      // force-logs-out on token expiry) -- this only affects a fresh
      // login attempt.
      return { error: classifyLoginError(err) };
    }
  }

  async function logout() {
    setIsLoggedIn(false); setRole(null); setUsername(null); setUserId(null); setToken(null);
    const db = await dbPromise;
    await db.delete('auth', AUTH_KEY);
  }

  return { isLoggedIn, role, username, userId, token, login, logout, authLoaded };
}