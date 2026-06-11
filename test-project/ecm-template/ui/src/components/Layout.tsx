import { NavLink, useNavigate } from 'react-router-dom';
import { clearToken } from '../api/client';

const nav = [
  { to: '/', label: '📊 Dashboard', end: true },
  { to: '/documents', label: '📄 Documents' },
  { to: '/folders', label: '📁 Folders' },
  { to: '/tags', label: '🏷️ Tags' },
  { to: '/users', label: '👥 Users' },
  { to: '/roles', label: '🔐 Roles' },
  { to: '/search', label: '🔍 Search' }
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('ecm_user') ?? '{}');

  function logout() {
    clearToken();
    navigate('/login');
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif', background: '#f8fafc' }}>
      <aside style={{ width: 220, background: '#1e293b', color: '#cbd5e1', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #334155' }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#f1f5f9' }}>ECM Platform</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Content Management</div>
        </div>
        <nav style={{ flex: 1, padding: '12px 8px' }}>
          {nav.map(n => (
            <NavLink key={n.to} to={n.to} end={n.end}
              style={({ isActive }) => ({
                display: 'block', padding: '8px 12px', borderRadius: 6, marginBottom: 2,
                color: isActive ? '#f1f5f9' : '#94a3b8',
                background: isActive ? '#334155' : 'transparent',
                textDecoration: 'none', fontSize: 14
              })}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: '12px 16px', borderTop: '1px solid #334155' }}>
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>
            <span style={{ color: '#f1f5f9' }}>{user.username}</span>
            <span style={{ marginLeft: 6, background: '#334155', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>{user.role}</span>
          </div>
          <button onClick={logout} style={{ width: '100%', padding: '6px', background: '#334155', color: '#f87171', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
            Logout
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {children}
      </main>
    </div>
  );
}
