'use client';
import { useState, useMemo } from 'react';
import { Issue } from '@/lib/data';

interface Props { issues: Issue[]; compact?: boolean; }

const SEV_COLORS: Record<string, string> = {
  Critical: 'bg-[#fce8e6] text-[#d93025]',
  High:     'bg-[#feefe3] text-[#e8710a]',
  Medium:   'bg-[#fef7e0] text-[#e37400]',
  Low:      'bg-[#e6f4ea] text-[#137333]',
};
const SEV_ROW: Record<string, string> = {
  Critical: '',
  High:     '',
  Medium:   '',
  Low:      '',
};

export default function IssuesTable({ issues, compact }: Props) {
  const [sevFilter, setSevFilter]   = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [search, setSearch]         = useState('');

  const severities  = ['All', 'Critical', 'High', 'Medium', 'Low'];
  const issueTypes  = ['All', ...Array.from(new Set(issues.map(i => i.issue))).sort()];

  const filtered = useMemo(() => issues.filter(i => {
    if (sevFilter  !== 'All' && i.severity !== sevFilter)  return false;
    if (typeFilter !== 'All' && i.issue    !== typeFilter)  return false;
    if (search && !i.url.toLowerCase().includes(search.toLowerCase()) &&
        !i.issue.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [issues, sevFilter, typeFilter, search]);

  return (
    <div className="bg-white rounded-3xl overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
      {!compact && (
        <div className="p-5 border-b border-gray-100 flex flex-wrap gap-4 items-center">
          <input
            className="bg-[#f8f9fa] text-gray-900 placeholder-gray-500 rounded-full px-4 py-2.5 text-sm flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-[#1a73e8] transition-shadow"
            placeholder="Search URL or issue…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="bg-[#f8f9fa] text-gray-900 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8] transition-shadow cursor-pointer"
            value={sevFilter}
            onChange={e => setSevFilter(e.target.value)}
          >
            {severities.map(s => <option key={s}>{s}</option>)}
          </select>
          <select
            className="bg-[#f8f9fa] text-gray-900 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8] transition-shadow cursor-pointer"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          >
            {issueTypes.map(t => <option key={t}>{t}</option>)}
          </select>
          <span className="text-sm text-gray-500 font-medium ml-2">{filtered.length} results</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white border-b border-gray-100 text-gray-500 text-xs tracking-wide">
              <th className="px-5 py-4 text-left font-medium">URL</th>
              <th className="px-5 py-4 text-left font-medium">Issue</th>
              <th className="px-5 py-4 text-left font-medium">Severity</th>
              {!compact && <th className="px-4 py-3 text-left font-medium">Detail</th>}
              {!compact && <th className="px-4 py-3 text-left font-medium">Fix Recommendation</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filtered.slice(0, compact ? 5 : 1000).map((row, i) => (
              <tr key={i} className={`hover:bg-[#f8f9fa] transition-colors ${SEV_ROW[row.severity] ?? ''}`}>
                <td className="px-5 py-4 max-w-xs truncate text-gray-600 font-mono text-xs">{row.url}</td>
                <td className="px-5 py-4 font-medium text-gray-900">{row.issue}</td>
                <td className="px-5 py-4">
                  <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${SEV_COLORS[row.severity] ?? ''}`}>
                    {row.severity}
                  </span>
                </td>
                {!compact && <td className="px-5 py-4 text-gray-600 text-sm max-w-xs leading-relaxed">{row.detail || row.issue}</td>}
                {!compact && <td className="px-5 py-4 text-gray-600 text-sm max-w-sm leading-relaxed">{row.recommendation}</td>}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-500">No issues match the filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
