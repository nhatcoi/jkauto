import { useEffect, useState } from 'react';
import { api, type Role } from '../api/client';
import Modal from '../components/Modal';

const ALL_PERMS = [
  'users:read', 'users:write', 'users:delete',
  'docs:read', 'docs:write', 'docs:delete',
  'folders:read', 'folders:write', 'folders:delete',
  'tags:read', 'tags:write', 'tags:delete',
  'roles:read', 'roles:write', 'roles:delete'
];

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', permissions: [] as string[] });
  const [error, setError] = useState('');

  function load() { api.roles.list().then(setRoles).catch(console.error); }
  useEffect(load, []);

  function togglePerm(p: string) {
    setForm(f => ({ ...f, permissions: f.permissions.includes(p) ? f.permissions.filter(x => x !== p) : [...f.permissions, p] }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.roles.create(form);
      setShowCreate(false);
      setForm({ name: '', permissions: [] });
      load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete role "${name}"?`)) return;
    await api.roles.delete(id).catch(console.error);
    load();
  }

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' };
  const builtIn = ['role_admin', 'role_editor', 'role_viewer'];
  const groups = [
    { label: 'Users', perms: ALL_PERMS.filter(p => p.startsWith('users:')) },
    { label: 'Documents', perms: ALL_PERMS.filter(p => p.startsWith('docs:')) },
    { label: 'Folders', perms: ALL_PERMS.filter(p => p.startsWith('folders:')) },
    { label: 'Tags', perms: ALL_PERMS.filter(p => p.startsWith('tags:')) },
    { label: 'Roles', perms: ALL_PERMS.filter(p => p.startsWith('roles:')) }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24, color: '#1e293b' }}>Roles</h1>
        <button onClick={() => setShowCreate(true)}
          style={{ padding: '8px 18px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
          + New Role
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {roles.map(r => (
          <div key={r.id} style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 16, color: '#1e293b' }}>{r.name}</span>
                {builtIn.includes(r.id) && <span style={{ marginLeft: 8, fontSize: 11, background: '#f1f5f9', padding: '2px 7px', borderRadius: 4, color: '#64748b' }}>built-in</span>}
              </div>
              {!builtIn.includes(r.id) && (
                <button onClick={() => handleDelete(r.id, r.name)}
                  style={{ padding: '4px 12px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                  Delete
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {r.permissions.map(p => (
                <span key={p} style={{ padding: '2px 10px', background: '#eff6ff', color: '#3b82f6', borderRadius: 12, fontSize: 12, fontWeight: 500 }}>{p}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <Modal title="New Role" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Name *</label>
              <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Permissions</label>
              {groups.map(g => (
                <div key={g.label} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 5, fontWeight: 600 }}>{g.label}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {g.perms.map(p => {
                      const checked = form.permissions.includes(p);
                      return (
                        <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 13 }}>
                          <input type="checkbox" checked={checked} onChange={() => togglePerm(p)} />
                          {p.split(':')[1]}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {error && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowCreate(false)}
                style={{ padding: '8px 18px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
              <button type="submit"
                style={{ padding: '8px 18px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Create</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
