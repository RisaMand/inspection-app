import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';

export default function Login({ login, isLoggedIn, authLoaded, currentRole }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  if (authLoaded && isLoggedIn) {
    return <Navigate to={currentRole === 'inspector' ? '/session' : '/dashboard'} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await login(username, password);
    if (result.role) {
      navigate(result.role === 'inspector' ? '/session' : '/dashboard');
    } else if (result.error === 'network') {
      setError("Can't reach the server. Check your connection and try again.");
    } else {
      setError('Login failed. Please check your credentials.');
    }
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 400, margin: '0 auto' }}>
      <h1>Legal Metrology Inspector</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            Username
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ display: 'block', width: '100%' }}
            />
          </label>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ display: 'block', width: '100%' }}
            />
          </label>
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit">Log In</button>
      </form>
    </div>
  );
}