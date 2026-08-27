import { useState } from 'react';

// Hardcoded auth for R1 demo. Swap this function's internals for real
// JWT/session logic later — nothing outside this file should need to change.
function checkAuth(username, password) {
  return true; // always succeeds, per Mini/Team Bible R1 scope
}

export function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [role, setRole] = useState(null); // 'inspector' | 'official'

  function login(username, password, selectedRole) {
    const success = checkAuth(username, password);
    if (success) {
      setIsLoggedIn(true);
      setRole(selectedRole);
    }
    return success;
  }

  function logout() {
    setIsLoggedIn(false);
    setRole(null);
  }

  return { isLoggedIn, role, login, logout };
}