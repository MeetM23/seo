'use client';
import { useEffect, useState } from 'react';
import { CrawlRow, Issue, CWVRow } from '@/lib/data';
import Link from 'next/link';

function StatusBadge({ code }: { code: string }) {
  const n = parseInt(code, 10);
  const cls = n < 300 ? 'bg-[#e6f4ea] text-[#137333]' :
              n < 400 ? 'bg-[#fef7e0] text-[#e37400]' : 'bg-[#fce8e6] text-[#d93025]';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{code}</span>;
}

export default function PagesListPage() {
  const [rows, setRows]     = useState<CrawlRow[]>([]);
  const [cwv, setCwv]       = useState<CWVRow[]>([]);
  const [selected, setSelected] = useState<CrawlRow | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/crawl').then(r => r.json()).then(setRows).catch(() => setRows([]));
    fetch('/api/cwv').then(r => r.json()).then(setCwv).catch(() => setCwv([]));
  }, []);

  const filtered = (rows || []).filter(r => r.url.toLowerCase().includes(search.toLowerCase()));

  const pageCWV = selected ? cwv.find(c => c.url === selected.url) : null;

  const SEV_COLORS: Record<string, string> = {
    Critical: 'bg-[#fce8e6] text-[#d93025]',
    High:     'bg-[#feefe3] text-[#e8710a]',
    Medium:   'bg-[#fef7e0] text-[#e37400]',
    Low:      'bg-[#e6f4ea] text-[#137333]',
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Audit Results</h1>
        <p className="text-gray-500 text-base mt-2">{rows.length} pages analyzed</p>
      </div>

      <input
        className="bg-white text-gray-900 placeholder-gray-400 rounded-full px-5 py-3 text-sm w-full max-w-md focus:outline-none focus:ring-2 focus:ring-[#1a73e8] shadow-[0_2px_10px_rgba(0,0,0,0.04)] transition-shadow"
        placeholder="Filter by URL…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className="flex gap-4 items-start">
        {/* Pages table */}
        <div className={`bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] rounded-3xl overflow-hidden flex-1 ${selected ? 'max-w-md' : 'w-full'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white border-b border-gray-100 text-gray-500 text-xs tracking-wide">
                  <th className="px-5 py-4 text-left font-medium">#</th>
                  <th className="px-5 py-4 text-left font-medium">URL</th>
                  <th className="px-5 py-4 text-left font-medium">Status</th>
                  <th className="px-5 py-4 text-left font-medium">Words</th>
                  <th className="px-5 py-4 text-left font-medium">Links</th>
                  <th className="px-5 py-4 text-left font-medium">Issues</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {filtered.map((row, i) => {
                  const issueCount = (row.issues?.errors?.length || 0) + (row.issues?.warnings?.length || 0);
                  return (
                    <tr
                      key={i}
                      onClick={() => setSelected(selected?.url === row.url ? null : row)}
                      className={`cursor-pointer transition-colors border-b border-gray-50 last:border-0
                        ${selected?.url === row.url ? 'bg-[#e8f0fe]' : 'hover:bg-[#f8f9fa]'}`}
                    >
                      <td className="px-5 py-4 text-gray-400 font-medium">{i + 1}</td>
                      <td className="px-5 py-4 max-w-[200px] truncate text-gray-600 font-mono text-xs">{row.url}</td>
                      <td className="px-5 py-4"><StatusBadge code={String(row.status)} /></td>
                      <td className="px-5 py-4 text-gray-500">{row.wordCount}</td>
                      <td className="px-5 py-4 text-gray-500">{row.internalLinks}</td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${issueCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {issueCount}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="flex-1 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] rounded-3xl p-8 space-y-8 min-w-0">
            <div className="flex justify-between items-start border-b border-gray-100 pb-4">
              <div>
                <span className="text-xs font-bold text-[#1a73e8] uppercase tracking-wider">Page Details</span>
                <h2 className="text-xl font-bold text-gray-900 break-all leading-tight mt-1">{selected.url}</h2>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700 ml-4 text-2xl leading-none transition-colors">✕</button>
            </div>

            {/* SEO Issues Section */}
            <div className="grid gap-6">
              {/* Errors */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-red-600 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-600 rounded-full"></span>
                  Errors ({selected.issues?.errors?.length || 0})
                </h3>
                <div className="grid gap-4">
                  {selected.issues?.errors?.length ? selected.issues.errors.map((err, idx) => (
                    <div key={idx} className="bg-red-50 border border-red-100 rounded-2xl p-5 space-y-3">
                      <div className="flex justify-between items-center">
                        <p className="text-red-900 font-bold text-sm">{err.issue}</p>
                        <span className="text-[10px] font-bold uppercase py-0.5 px-2 bg-red-100 text-red-600 rounded-full">{err.severity}</span>
                      </div>
                      
                      <div>
                        <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">Why this matters</p>
                        <p className="text-red-700 text-xs leading-relaxed">{err.why}</p>
                      </div>

                      <div className="bg-white/50 rounded-xl p-3 border border-red-200">
                        <p className="text-[10px] font-bold text-[#1a73e8] uppercase tracking-wider mb-1 italic">AI suggested fix</p>
                        <p className="text-gray-800 font-medium text-xs">"{err.fix}"</p>
                      </div>
                    </div>
                  )) : <p className="text-gray-400 text-xs italic">No critical errors found.</p>}
                </div>
              </div>

              {/* Warnings */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-amber-600 flex items-center gap-2">
                  <span className="w-2 h-2 bg-amber-600 rounded-full"></span>
                  Warnings ({selected.issues?.warnings?.length || 0})
                </h3>
                <div className="grid gap-4">
                  {selected.issues?.warnings?.length ? selected.issues.warnings.map((warn, idx) => (
                    <div key={idx} className="bg-amber-50 border border-amber-100 rounded-2xl p-5 space-y-3">
                      <div className="flex justify-between items-center">
                        <p className="text-amber-900 font-bold text-sm">{warn.issue}</p>
                        <span className="text-[10px] font-bold uppercase py-0.5 px-2 bg-amber-100 text-amber-600 rounded-full">{warn.severity}</span>
                      </div>
                      
                      <div>
                        <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1">Why this matters</p>
                        <p className="text-amber-700 text-xs leading-relaxed">{warn.why}</p>
                      </div>

                      <div className="bg-white/50 rounded-xl p-3 border border-amber-200">
                        <p className="text-[10px] font-bold text-[#1a73e8] uppercase tracking-wider mb-1 italic">AI suggested improvement</p>
                        <p className="text-gray-800 font-medium text-xs">"{warn.fix}"</p>
                      </div>
                    </div>
                  )) : <p className="text-gray-400 text-xs italic">No warnings found.</p>}
                </div>
              </div>
            </div>

            {/* Metrics Footer */}
            <div className="grid grid-cols-2 gap-4 pt-6 mt-6 border-t border-gray-100">
               <div className="bg-gray-50 rounded-2xl p-4">
                 <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">Word Count</p>
                 <p className="text-lg font-bold text-gray-900">{selected.wordCount}</p>
               </div>
               <div className="bg-gray-50 rounded-2xl p-4">
                 <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">Internal Links</p>
                 <p className="text-lg font-bold text-gray-900">{selected.internalLinks}</p>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
