import { useEffect, useState } from 'react';
import { api } from '../api/client';

interface Stats { users: number; documents: number; folders: number; tags: number; }

const cards = [
  { key: 'documents', label: 'Documents', icon: '📄', color: '#3b82f6' },
  { key: 'folders', label: 'Folders', icon: '📁', color: '#10b981' },
  { key: 'tags', label: 'Tags', icon: '🏷️', color: '#f59e0b' },
  { key: 'users', label: 'Users', icon: '👥', color: '#8b5cf6' }
];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => { api.stats().then(setStats).catch(console.error); }, []);

  const user = JSON.parse(localStorage.getItem('ecm_user') ?? '{}');

  return (
    <div>
      <h1 style={{ margin: '0 0 4px', fontSize: 24, color: '#1e293b' }}>Dashboard</h1>
      <p style={{ margin: '0 0 28px', color: '#64748b' }}>Welcome back, <strong>{user.username}</strong></p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {cards.map(c => (
          <div key={c.key} style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: `4px solid ${c.color}` }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{c.icon}</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#1e293b' }}>{stats ? stats[c.key as keyof Stats] : '...'}</div>
            <div style={{ fontSize: 14, color: '#64748b', marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, color: '#1e293b' }}>Quick Links</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { href: '/documents', label: '📄 Browse Documents', color: '#eff6ff' },
            { href: '/folders', label: '📁 Manage Folders', color: '#f0fdf4' },
            { href: '/search', label: '🔍 Search', color: '#fef3c7' },
            { href: 'http://localhost:3001/docs', label: '📖 Swagger API', color: '#f5f3ff', ext: true }
          ].map(l => (
            <a key={l.href} href={l.href} target={l.ext ? '_blank' : undefined} rel="noreferrer"
              style={{ padding: '10px 18px', background: l.color, borderRadius: 8, fontSize: 14, color: '#1e293b', textDecoration: 'none', fontWeight: 500 }}>
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
