import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ isLoggedIn, authLoaded, children }) {
  if (!authLoaded) {
    // Still reading from IndexedDB — don't redirect yet, avoid a false
    // bounce-to-Login flicker for someone who's actually logged in.
    return <p style={{ padding: '2rem' }}>Loading...</p>;
  }
  if (!isLoggedIn) {
    return <Navigate to="/" replace />;
  }
  return children;
}