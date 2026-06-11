import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, User, Mail, Lock, Eye, EyeOff, Package } from 'lucide-react';
import { api } from '../api/client';

export default function RegisterPage() {
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await api.auth.register(form.username, form.email, form.password);
      navigate('/login', { state: { registered: true } });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
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
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, background: 'linear-gradient(135deg, #667eea, #764ba2)', borderRadius: 14, marginBottom: 12 }}>
            <Package size={28} color="#fff" />
          </div>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, color: '#1e293b', fontWeight: 700 }}>Create account</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Join ECM Platform</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Username *</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={iconStyle} />
              <input id="reg-username" style={inp} value={form.username} onChange={set('username')} required minLength={3} autoFocus autoComplete="username" placeholder="min. 3 characters" />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Email *</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={iconStyle} />
              <input id="reg-email" style={inp} type="email" value={form.email} onChange={set('email')} required autoComplete="email" placeholder="you@example.com" />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Password *</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={iconStyle} />
              <input id="reg-password" style={{ ...inp, paddingRight: 40 }} type={showPwd ? 'text' : 'password'} value={form.password} onChange={set('password')} required minLength={6} autoComplete="new-password" placeholder="min. 6 characters" />
              <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#94a3b8', display: 'flex' }}>
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Confirm password *</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={iconStyle} />
              <input id="reg-confirm" style={inp} type={showPwd ? 'text' : 'password'} value={form.confirm} onChange={set('confirm')} required autoComplete="new-password" placeholder="repeat password" />
            </div>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button id="register-btn" type="submit" disabled={loading} style={{ width: '100%', padding: '11px', background: loading ? '#94a3b8' : 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading ? 'Creating account...' : <><UserPlus size={16} /> Create account</>}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 14, color: '#64748b' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#667eea', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}
