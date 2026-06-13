'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, login, register } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) router.push('/chat');
  }, [user, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);
    try {
      let result;
      if (isLogin) {
        result = await login(email, password);
      } else {
        if (!username.trim()) { setError('Username is required'); setLoading(false); return; }
        result = await register(email, username, password);
      }
      if (!result.success) {
        setError(result.error);
      } else if (result.pendingApproval) {
        setSuccessMessage(result.message);
        setIsLogin(true); // Switch to login tab so they can login later
        setUsername('');
        setPassword('');
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card fade-in">
        <h1 style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>N://Chat</h1>
        <p className="auth-sub">Encrypted. Private. Yours.</p>

        <div className="auth-tabs">
          <button className={`auth-tab ${isLogin ? 'active' : ''}`} onClick={() => { setIsLogin(true); setError(''); }}>
            Login
          </button>
          <button className={`auth-tab ${!isLogin ? 'active' : ''}`} onClick={() => { setIsLogin(false); setError(''); }}>
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{isLogin ? 'Email or Username' : 'Email'}</label>
            <input
              type={isLogin ? 'text' : 'email'}
              className="form-input"
              placeholder={isLogin ? 'your@email.com or username' : 'your@email.com'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                className="form-input"
                placeholder="Pick a unique username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                required
                minLength={3}
                maxLength={20}
              />
            </div>
          )}

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <button type="submit" className="form-btn" disabled={loading}>
            {loading ? 'Processing...' : isLogin ? 'Enter NChat →' : 'Create Account →'}
          </button>

          {error && <p className="auth-error">⚠ {error}</p>}
          {successMessage && <p className="auth-success" style={{ color: 'var(--accent)', fontSize: '0.85rem', fontWeight: 600, marginTop: '12px' }}>✓ {successMessage}</p>}
        </form>
      </div>
    </div>
  );
}
