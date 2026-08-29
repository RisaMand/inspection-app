import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ isLoggedIn, authLoaded, role, allowedRole, children }) {
  if (!authLoaded) {
    return <p style={{ padding: '2rem' }}>Loading...</p>;
  }
  if (!isLoggedIn) {
    return <Navigate to="/" replace />;
  }
  if (allowedRole && role !== allowedRole) {
    const homePath = role === 'inspector' ? '/session' : '/dashboard';
    return (
      <Navigate
        to={homePath}
        replace
        state={{ notice: `This screen isn't available for the ${role} role.` }}
      />
    );
  }
  return children;
}