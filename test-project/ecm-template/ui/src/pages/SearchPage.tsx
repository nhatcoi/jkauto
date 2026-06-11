import { useState } from 'react';
import { api, type SearchResult } from '../api/client';
import { useNavigate } from 'react-router-dom';

export default function SearchPage() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await api.search(q);
      setResults(res.results);
      setTotal(res.total);
    } catch { setResults([]); }
    setLoading(false);
  }

  function handleClick(r: SearchResult) {
    if (r.type === 'document') navigate('/documents');
    else if (r.type === 'folder') navigate('/folders');
  }

  return (
    <div>
      <h1 style={{ margin: '0 0 20px', fontSize: 24, color: '#1e293b' }}>Search</h1>
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search documents, folders..."
          style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 15 }}
          autoFocus
        />
        <button type="submit" disabled={loading}
          style={{ padding: '10px 24px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
          {loading ? '...' : 'Search'}
        </button>
      </form>

      {total > 0 && <p style={{ color: '#64748b', fontSize: 14, marginBottom: 12 }}>{total} results for "<strong>{q}</strong>"</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {results.map(r => (
          <div key={r.id} onClick={() => handleClick(r)} style={{ background: '#fff', borderRadius: 8, padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ fontSize: 24 }}>{r.type === 'document' ? '📄' : '📁'}</span>
            <div>
              <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 2 }}>{r.title}</div>
              {r.description && <div style={{ fontSize: 13, color: '#64748b' }}>{r.description}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{r.type}</span>
                {r.status && <span style={{ fontSize: 12, color: '#94a3b8' }}>· {r.status}</span>}
                <span style={{ fontSize: 12, color: '#94a3b8' }}>· matched: {r.matchedField}</span>
              </div>
            </div>
          </div>
        ))}
        {results.length === 0 && q && !loading && (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>No results found</div>
        )}
      </div>
    </div>
  );
}
