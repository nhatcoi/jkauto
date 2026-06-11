import { useState } from 'react';
import { Activity, Shield, Cpu, RefreshCw } from 'lucide-react';

export default function App() {
  const [clickCount, setClickCount] = useState(0);

  return (
    <div className="app-container">
      <header>
        <h1>SleekWeb Portal</h1>
        <p className="subtitle">Modern React Web Application template for E2E Test Automation</p>
      </header>

      <div className="grid">
        <div className="card" id="card-system" onClick={() => setClickCount(c => c + 1)}>
          <h3><Cpu size={20} color="#818cf8" /> System Specs</h3>
          <p>Mock platform configurations, CPU, memory metrics, and background job statuses.</p>
          <span className="status-badge" id="badge-system">Active</span>
        </div>

        <div className="card" id="card-security" onClick={() => setClickCount(c => c + 1)}>
          <h3><Shield size={20} color="#34d399" /> Security</h3>
          <p>SSL, token validation, user scopes, role permissions, and active session scopes.</p>
          <span className="status-badge" id="badge-security">Secure</span>
        </div>

        <div className="card" id="card-metrics" onClick={() => setClickCount(c => c + 1)}>
          <h3><Activity size={20} color="#fb7185" /> Performance</h3>
          <p>Page speed loads, Core Web Vitals, API response latency, and memory footprint.</p>
          <span className="status-badge" id="badge-metrics">Optimal</span>
        </div>
      </div>

      <div className="actions">
        <button id="btn-interact" onClick={() => setClickCount(clickCount + 1)}>
          <RefreshCw size={16} style={{ marginRight: 8, verticalAlign: 'middle', animation: 'spin 2s linear infinite' }} />
          Interact ({clickCount})
        </button>
        <button id="btn-reset" className="secondary" onClick={() => setClickCount(0)}>
          Reset
        </button>
      </div>
    </div>
  );
}
