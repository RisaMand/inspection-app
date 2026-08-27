import { useState, useEffect } from 'react';
import { dbPromise } from '../db/db';

// Hardcoded auth check for R1 demo. Swap this function's internals for real
// JWT/session logic later — nothing outside this file should need to change.
function checkAuth(username, password) {
  return true; // always succeeds, per Team Bible R1 scope
}

const AUTH_KEY = 'authState'; // single record: { isLoggedIn, role }

export function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [role, setRole] = useState(null); // 'inspector' | 'official'
  const [authLoaded, setAuthLoaded] = useState(false); // true once IndexedDB read completes

  // On mount, restore auth state from IndexedDB — this is what survives a refresh.
  useEffect(() => {
    async function loadAuth() {
      const db = await dbPromise;
      const stored = await db.get('auth', AUTH_KEY);
      if (stored) {
        setIsLoggedIn(stored.isLoggedIn);
        setRole(stored.role);
      }
      setAuthLoaded(true);
    }
    loadAuth();
  }, []);

  async function login(username, password, selectedRole) {
    const success = checkAuth(username, password);
    if (success) {
      setIsLoggedIn(true);
      setRole(selectedRole);
      const db = await dbPromise;
      await db.put('auth', { isLoggedIn: true, role: selectedRole }, AUTH_KEY);
    }
    return success;
  }

  async function logout() {
    setIsLoggedIn(false);
    setRole(null);
    const db = await dbPromise;
    await db.delete('auth', AUTH_KEY);
  }

  return { isLoggedIn, role, login, logout, authLoaded };
}