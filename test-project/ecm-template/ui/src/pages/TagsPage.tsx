import { useEffect, useState } from 'react';
import { api, type Tag } from '../api/client';
import Modal from '../components/Modal';

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b'];

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', color: '#3b82f6' });
  const [error, setError] = useState('');

  function load() { api.tags.list().then(setTags).catch(console.error); }
  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.tags.create(form);
      setShowCreate(false);
      setForm({ name: '', color: '#3b82f6' });
      load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete tag "${name}"?`)) return;
    await api.tags.delete(id).catch(console.error);
    load();
  }

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24, color: '#1e293b' }}>Tags</h1>
        <button onClick={() => setShowCreate(true)}
          style={{ padding: '8px 18px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
          + New Tag
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {tags.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: `4px solid ${t.color}` }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: t.color, display: 'inline-block' }} />
            <span style={{ fontWeight: 600, color: '#1e293b' }}>{t.name}</span>
            <button onClick={() => handleDelete(t.id, t.name)}
              style={{ padding: '2px 8px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>×</button>
          </div>
        ))}
        {tags.length === 0 && <div style={{ color: '#94a3b8' }}>No tags yet</div>}
      </div>

      {showCreate && (
        <Modal title="New Tag" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Name *</label>
              <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Color</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                    style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: form.color === c ? '3px solid #1e293b' : '2px solid transparent', cursor: 'pointer' }} />
                ))}
              </div>
            </div>
            {error && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowCreate(false)}
                style={{ padding: '8px 18px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
              <button type="submit"
                style={{ padding: '8px 18px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Create</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
