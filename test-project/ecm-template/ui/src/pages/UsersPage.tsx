import { useEffect, useState } from 'react';
import { api, type User } from '../api/client';

const ROLE_COLORS: Record<string, string> = { admin: '#8b5cf6', editor: '#3b82f6', viewer: '#64748b' };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [roleFilter, setRoleFilter] = useState('');
  const currentUser = JSON.parse(localStorage.getItem('ecm_user') ?? '{}');

  function load() {
    const params = roleFilter ? { role: roleFilter } : {};
    api.users.list(params).then(r => { setUsers(r.data); setTotal(r.total); }).catch(console.error);
  }
  useEffect(load, [roleFilter]);

  async function handleDelete(id: string, username: string) {
    if (!confirm(`Delete user "${username}"?`)) return;
    await api.users.delete(id).catch(console.error);
    load();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: '#1e293b' }}>Users</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>{total} total</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['', 'admin', 'editor', 'viewer'].map(r => (
          <button key={r} onClick={() => setRoleFilter(r)}
            style={{ padding: '5px 14px', borderRadius: 20, border: '1px solid #e2e8f0', background: roleFilter === r ? '#1e293b' : '#fff', color: roleFilter === r ? '#fff' : '#64748b', cursor: 'pointer', fontSize: 13 }}>
            {r || 'All'}
          </button>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              {['Username', 'Email', 'Role', 'Created', 'Actions'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No users</td></tr>}
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9', background: u.id === currentUser.id ? '#fafef8' : undefined }}>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1e293b' }}>
                  {u.username} {u.id === currentUser.id && <span style={{ fontSize: 11, color: '#64748b' }}>(you)</span>}
                </td>
                <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 14 }}>{u.email}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: (ROLE_COLORS[u.role] ?? '#64748b') + '22', color: ROLE_COLORS[u.role] ?? '#64748b' }}>
                    {u.role}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 13 }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                <td style={{ padding: '12px 16px' }}>
                  {u.id !== currentUser.id && (
                    <button onClick={() => handleDelete(u.id, u.username)}
                      style={{ padding: '4px 12px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
