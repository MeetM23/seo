'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuditForm() {
  const [url, setUrl]         = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [status, setStatus]   = useState({ state: 'idle', step: '', progress: 0 });

  const router = useRouter();

  // Poll for status every 2s while running
  useEffect(() => {
    let id: NodeJS.Timeout;

    const checkStatus = async () => {
      try {
        const res  = await fetch(`/api/audit-status?_t=${Date.now()}`, { cache: 'no-store' });
        const data = await res.json();
        setStatus(data);

        if (data.state === 'completed') {
          setSuccess('✅ Audit completed!');
          setLoading(false);
          setTimeout(() => setSuccess(''), 5000);
        } else if (data.state === 'error') {
          setError(data.error || 'Audit failed');
          setLoading(false);
        } else if (data.state === 'running') {
          setLoading(true);
        } else {
          // idle / stopped
          setLoading(false);
        }
      } catch (_) {}
    };

    if (loading || status.state === 'running') {
      id = setInterval(checkStatus, 2000);
    } else {
      checkStatus();
    }

    return () => clearInterval(id);
  }, [loading, status.state]);

  const handleAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status.state === 'running') return;
    setError(''); setSuccess('');
    if (!url.trim()) { setError('Please enter a website URL.'); return; }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setError('URL must start with http:// or https://'); return;
    }
    setLoading(true);
    try {
      const res  = await fetch('/api/run-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Audit failed');
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(false);
    setStatus({ state: 'idle', step: '', progress: 0 });
    setError('');
    try {
      await fetch('/api/stop-audit', { method: 'POST' });
    } catch (_) {}
  };

  const handleReset = async () => {
    setUrl(''); setError(''); setSuccess('');
    setStatus({ state: 'idle', step: '', progress: 0 });
    setLoading(false);
    try {
      await fetch('/api/reset-audit', { method: 'POST' });
      // Force reload to clear all in-memory state
      window.location.reload();
    } catch (_) {}
  };

  const isRunning = loading || status.state === 'running';

  return (
    <div className="bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] rounded-3xl p-6 pb-8 mb-8 mt-6 max-w-4xl relative overflow-hidden">
      <form onSubmit={handleAudit} className="flex flex-col sm:flex-row gap-4 items-center">
        <input
          type="url"
          className="bg-[#f8f9fa] text-gray-900 placeholder-gray-400 rounded-full px-5 py-3.5 text-sm flex-1 w-full focus:outline-none focus:ring-2 focus:ring-[#1a73e8] shadow-inner transition-all"
          placeholder="Enter website URL (https://example.com)..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={isRunning}
          required
        />

        <div className="flex gap-2 shrink-0">
          {/* Run Audit — hidden while running */}
          {!isRunning && (
            <button
              type="submit"
              className="px-8 py-3.5 rounded-full text-sm font-medium bg-[#1a73e8] hover:bg-[#1557b0] text-white hover:shadow-md transition-all shadow-sm"
            >
              Run Audit
            </button>
          )}

          {/* Stop — shown while running */}
          {isRunning && (
            <button
              type="button"
              onClick={handleStop}
              className="px-6 py-3.5 rounded-full text-sm font-bold bg-red-500 hover:bg-red-600 text-white shadow-sm hover:shadow-md flex items-center gap-2 transition-all"
            >
              <span className="w-2 h-2 bg-white rounded-full animate-pulse inline-block"></span>
              Stop Audit
            </button>
          )}

          {/* Reset — ALWAYS visible */}
          <button
            type="button"
            onClick={handleReset}
            disabled={isRunning}
            className={`px-6 py-3.5 rounded-full text-sm font-medium transition-all shadow-sm
              ${isRunning
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:shadow-md'
              }`}
          >
            🗑 Reset
          </button>
        </div>
      </form>

      {/* Progress Bar */}
      {isRunning && (
        <div className="mt-8 px-2 max-w-2xl mx-auto text-center">
          <p className="text-sm text-gray-600 font-medium mb-3 animate-pulse">{status.step || 'Starting...'}</p>
          <div className="w-full bg-[#f8f9fa] rounded-full h-2.5 overflow-hidden shadow-inner">
            <div
              className="bg-[#1a73e8] h-2.5 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.max(2, status.progress || 0)}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-400 mt-2">{status.progress || 0}% Complete</p>
        </div>
      )}

      {error   && <p className="mt-4 text-sm text-[#d93025] font-medium flex items-center justify-center gap-1">❌ {error}</p>}
      {success && <p className="mt-4 text-sm text-[#34a853] font-medium flex items-center justify-center gap-1">{success}</p>}
    </div>
  );
}
