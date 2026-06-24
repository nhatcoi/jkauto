import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, User, Lock, Eye, EyeOff, Package } from 'lucide-react';
import { api, setToken } from '../api/client';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.auth.login(username, password);
      setToken(res.accessToken);
      localStorage.setItem('ecm_user', JSON.stringify(res.user));
      navigate('/');
    } catch (err: unknown) {
      setError('Login failed');
    } finally {
      setLoading(false);
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 12px 10px 38px',
    borderRadius: 8, border: '1px solid #e2e8f0',
    fontSize: 14, boxSizing: 'border-box', outline: 'none'
  };
  const iconStyle: React.CSSProperties = {
    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none'
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', fontFamily: 'system-ui' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, background: 'linear-gradient(135deg, #667eea, #764ba2)', borderRadius: 14, marginBottom: 12 }}>
            <Package size={28} color="#fff" />
          </div>
          <h1 style={{ margin: '0 0 4px', fontSize: 24, color: '#1e293b', fontWeight: 700 }}>ECM Platform</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Username</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={iconStyle} />
              <input id="username" style={inp} value={username} onChange={e => setUsername(e.target.value)} autoFocus autoComplete="username" />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={iconStyle} />
              <input id="password" style={{ ...inp, paddingRight: 40 }} type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
              <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#94a3b8', display: 'flex' }}>
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button id="login-btn" type="submit" disabled={loading} style={{ width: '100%', padding: '11px', background: loading ? '#94a3b8' : 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading ? 'Signing in...' : <><LogIn size={16} /> Sign in</>}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 14, color: '#64748b' }}>
          No account?{' '}
          <Link to="/register" style={{ color: '#667eea', fontWeight: 600, textDecoration: 'none' }}>Register</Link>
        </div>

        <div style={{ marginTop: 16, padding: 12, background: '#f8fafc', borderRadius: 8, fontSize: 12, color: '#64748b' }}>
          <strong>Quick logins:</strong> admin/Admin@123 · editor/Editor@123 · viewer/Viewer@123
        </div>
      </div>
    </div>
  );
}
