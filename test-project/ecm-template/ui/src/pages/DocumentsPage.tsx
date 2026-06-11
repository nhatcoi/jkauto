import { useEffect, useState } from 'react';
import { api, type Document } from '../api/client';
import Modal from '../components/Modal';

const STATUS_COLORS: Record<string, string> = { draft: '#f59e0b', published: '#10b981', archived: '#94a3b8' };

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<{ title: string; description: string; status: 'draft' | 'published' | 'archived' }>({ title: '', description: '', status: 'draft' });
  const [error, setError] = useState('');

  function load(status?: string) {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    api.documents.list(params).then(r => { setDocs(r.data); setTotal(r.total); }).catch(console.error);
  }

  useEffect(() => { load(filter || undefined); }, [filter]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.documents.create(form);
      setShowCreate(false);
      setForm({ title: '', description: '', status: 'draft' });
      load(filter || undefined);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return;
    await api.documents.delete(id).catch(console.error);
    load(filter || undefined);
  }

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: '#1e293b' }}>Documents</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>{total} total</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          style={{ padding: '8px 18px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
          + New Document
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['', 'draft', 'published', 'archived'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ padding: '5px 14px', borderRadius: 20, border: '1px solid #e2e8f0', background: filter === s ? '#1e293b' : '#fff', color: filter === s ? '#fff' : '#64748b', cursor: 'pointer', fontSize: 13 }}>
            {s || 'All'}
          </button>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              {['Title', 'Status', 'Version', 'Created', 'Actions'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {docs.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No documents found</td></tr>
            )}
            {docs.map(d => (
              <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 14 }}>{d.title}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{d.description}</div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: STATUS_COLORS[d.status] + '22', color: STATUS_COLORS[d.status] }}>
                    {d.status}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 14 }}>v{d.currentVersion}</td>
                <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 13 }}>{new Date(d.createdAt).toLocaleDateString()}</td>
                <td style={{ padding: '12px 16px' }}>
                  <button onClick={() => handleDelete(d.id, d.title)}
                    style={{ padding: '4px 12px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal title="New Document" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Title *</label>
              <input style={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required autoFocus />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Description</label>
              <textarea style={{ ...inp, height: 80, resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Status</label>
              <select style={inp} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as 'draft' | 'published' | 'archived' }))}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            {error && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowCreate(false)}
                style={{ padding: '8px 18px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
              <button type="submit"
                style={{ padding: '8px 18px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Create</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
