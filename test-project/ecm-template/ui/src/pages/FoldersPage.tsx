import { useEffect, useState } from 'react';
import { api, type Folder } from '../api/client';
import Modal from '../components/Modal';

export default function FoldersPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', parentId: '' });
  const [error, setError] = useState('');

  function load() { api.folders.list().then(setFolders).catch(console.error); }
  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.folders.create({ name: form.name, parentId: form.parentId || undefined });
      setShowCreate(false);
      setForm({ name: '', parentId: '' });
      load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete folder "${name}"?`)) return;
    await api.folders.delete(id).catch(console.error);
    load();
  }

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' };

  const tree = (parentId: string | null, depth = 0): React.ReactNode =>
    folders.filter(f => f.parentId === parentId).map(f => (
      <div key={f.id}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', paddingLeft: 16 + depth * 24, borderBottom: '1px solid #f1f5f9', background: '#fff' }}>
          <span style={{ marginRight: 8 }}>{'📁'}</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 500, color: '#1e293b' }}>{f.name}</span>
            <span style={{ marginLeft: 10, fontSize: 11, color: '#94a3b8' }}>{f.id}</span>
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8', marginRight: 12 }}>{new Date(f.createdAt).toLocaleDateString()}</span>
          {f.id !== 'fld_root' && (
            <button onClick={() => handleDelete(f.id, f.name)}
              style={{ padding: '3px 10px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
              Delete
            </button>
          )}
        </div>
        {tree(f.id, depth + 1)}
      </div>
    ));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24, color: '#1e293b' }}>Folders</h1>
        <button id="new-fld-btn" onClick={() => setShowCreate(true)}
          style={{ padding: '8px 18px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
          + New Folder
        </button>
      </div>
      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
        {tree(null)}
        {folders.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No folders</div>}
      </div>

      {showCreate && (
        <Modal title="New Folder" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Name *</label>
              <input id="fld-name" style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Parent Folder</label>
              <select id="fld-parent" style={inp} value={form.parentId} onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))}>
                <option value="">None (root)</option>
                {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            {error && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowCreate(false)}
                style={{ padding: '8px 18px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
              <button id="fld-submit-btn" type="submit"
                style={{ padding: '8px 18px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Create</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
