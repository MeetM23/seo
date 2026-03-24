'use client';

import { useEffect, useState, useCallback } from 'react';
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts';
import AuditForm from '@/components/AuditForm';
import SeverityBarChart from '@/components/SeverityBarChart';
import CWVScoreRing from '@/components/CWVScoreRing';

function SiteHealthRing({ health, pagesOk, total }: { health: number; pagesOk: number; total: number }) {
  const color = health >= 80 ? '#34a853' : health >= 50 ? '#fbbc04' : '#ea4335';
  const data = [{ name: 'health', value: health, fill: color }];
  return (
    <div className="bg-white rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] p-8 flex flex-col items-center justify-center h-full gap-3">
      <h2 className="text-sm font-semibold text-gray-500 tracking-wide">Site Health</h2>
      <div className="relative w-44 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="70%" outerRadius="100%" data={data} startAngle={210} endAngle={-30}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" background={{ fill: '#f3f4f6' }} cornerRadius={8} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-gray-900">{total === 0 ? '—' : `${health}`}</span>
          <span className="text-xs text-gray-400 mt-1">{total === 0 ? 'no data' : '/ 100'}</span>
        </div>
      </div>
      {total > 0 && <p className="text-xs text-gray-400">{pagesOk} of {total} pages OK</p>}
    </div>
  );
}

// Types
interface SEOIssue { issue: string; severity: string; why?: string; fix?: string; weight?: number; }
interface CrawlRow {
  url: string; status: number; wordCount: number; internalLinks: number;
  issues: { errors: SEOIssue[]; warnings: SEOIssue[]; };
}
interface CWVRow { url: string; performanceScore: string | number; lcpTag?: string; }
interface FlatIssue { url: string; issue: string; severity: string; detail?: string; recommendation?: string; }

const SEV_COLOR: Record<string, string> = {
  Critical: 'bg-red-100 text-red-700',
  High: 'bg-orange-100 text-orange-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-green-100 text-green-700',
};

function StatCard({ label, value, icon, accent }: { label: string; value: string | number; icon: string; accent: string }) {
  const accents: Record<string, string> = {
    indigo: 'text-indigo-600 bg-indigo-50',
    green:  'text-green-600 bg-green-50',
    orange: 'text-orange-600 bg-orange-50',
    red:    'text-red-600 bg-red-50',
    blue:   'text-blue-600 bg-blue-50',
  };
  return (
    <div className="bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] rounded-3xl p-6 flex items-center gap-4 transition-all duration-500">
      <span className={`text-2xl w-12 h-12 flex items-center justify-center rounded-2xl flex-shrink-0 ${accents[accent] || accents.indigo}`}>{icon}</span>
      <div>
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-black text-gray-900 transition-all duration-300">{value}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [crawl, setCrawl] = useState<CrawlRow[]>([]);
  const [cwv, setCwv]   = useState<CWVRow[]>([]);
  const [auditState, setAuditState] = useState<string>('idle');

  const fetchData = useCallback(async () => {
    try {
      const [crawlRes, cwvRes] = await Promise.all([
        fetch(`/api/crawl?_t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/cwv?_t=${Date.now()}`,   { cache: 'no-store' }),
      ]);
      if (crawlRes.ok) setCrawl(await crawlRes.json());
      if (cwvRes.ok)   setCwv(await cwvRes.json());
    } catch (_) {}
  }, []);

  // Poll audit status + refetch data every 2s while running
  useEffect(() => {
    let id: NodeJS.Timeout;
    const poll = async () => {
      try {
        const res  = await fetch(`/api/audit-status?_t=${Date.now()}`, { cache: 'no-store' });
        const data = await res.json();
        setAuditState(data.state);
        if (data.state === 'running' || data.state === 'completed') await fetchData();
      } catch (_) {}
      id = setTimeout(poll, 2000);
    };
    poll();
    return () => clearTimeout(id);
  }, [fetchData]);

  // Flatten issues from crawl
  const flatIssues: FlatIssue[] = [];
  crawl.forEach(row => {
    const all = [...(row.issues?.errors || []), ...(row.issues?.warnings || [])];
    all.forEach(iss => flatIssues.push({ url: row.url, issue: iss.issue, severity: iss.severity }));
  });

  const totalPages   = crawl.length;
  const successful   = crawl.filter(r => r.status === 200).length;
  const totalIssues  = flatIssues.length;
  const critical     = flatIssues.filter(i => i.severity === 'Critical').length;

  const scored = cwv.filter(r => !isNaN(Number(r.performanceScore)));
  const avgScore = scored.length
    ? Math.round(scored.reduce((s, r) => s + Number(r.performanceScore), 0) / scored.length)
    : 0;

  const sevCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 } as Record<string, number>;
  flatIssues.forEach(i => { sevCounts[i.severity] = (sevCounts[i.severity] || 0) + 1; });
  const chartData = Object.entries(sevCounts).map(([severity, count]) => ({ severity, count }));

  // Site health = 100 minus weighted issue penalty per page
  const WEIGHTS: Record<string, number> = { Critical: 10, High: 7, Medium: 4, Low: 1 };
  const totalPenalty = flatIssues.reduce((acc, i) => acc + (WEIGHTS[i.severity] || 1), 0);
  const siteHealth = totalPages > 0 ? Math.max(0, Math.min(100, 100 - Math.floor(totalPenalty / totalPages))) : 0;

  const topIssues = flatIssues.filter(i => i.severity === 'Critical').slice(0, 5);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">SEO Audit Dashboard</h1>
        <p className="text-gray-500 text-base mt-2">Overview of your website's SEO health</p>
      </div>

      <AuditForm />

      {/* Stat cards — update live */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Pages Crawled"   value={totalPages}  icon="🕷"  accent="indigo" />
        <StatCard label="Pages OK (200)"  value={successful}  icon="✅"  accent="green"  />
        <StatCard label="Total Issues"    value={totalIssues} icon="🔍"  accent="orange" />
        <StatCard label="Critical Issues" value={critical}    icon="🚨"  accent="red"    />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <SeverityBarChart data={chartData} />
        </div>
        <div>
          {avgScore > 0 ? (
            <CWVScoreRing score={avgScore} />
          ) : (
            /* Show Site Health ring from crawl data when CWV isn't available */
            <SiteHealthRing health={siteHealth} pagesOk={successful} total={totalPages} />
          )}
        </div>
      </div>

      {/* CWV stats (only when data exists) */}
      {cwv.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Avg Score"    value={`${avgScore}/100`} icon="⚡" accent="blue" />
          <StatCard label="LCP Critical" value={cwv.filter(r => r.lcpTag === 'Critical').length} icon="🐢" accent="red" />
          <StatCard label="LCP High"     value={cwv.filter(r => r.lcpTag === 'High').length}     icon="⚠️" accent="orange" />
          <StatCard label="URLs Audited" value={cwv.length} icon="📡" accent="indigo" />
        </div>
      )}

      {/* Top critical issues */}
      {topIssues.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">🚨 Top Critical Issues</h2>
          <div className="bg-white rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500 text-xs tracking-wide">
                  <th className="px-5 py-4 text-left font-medium">URL</th>
                  <th className="px-5 py-4 text-left font-medium">Issue</th>
                  <th className="px-5 py-4 text-left font-medium">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {topIssues.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4 text-gray-500 font-mono text-xs max-w-xs truncate">{row.url}</td>
                    <td className="px-5 py-4 font-medium text-gray-900">{row.issue}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${SEV_COLOR[row.severity] || ''}`}>{row.severity}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-right">
            <a href="/issues" className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors">View all issues →</a>
          </div>
        </div>
      )}

      {totalPages === 0 && auditState !== 'running' && (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400 space-y-3">
          <span className="text-6xl">🕸️</span>
          <p className="text-lg font-medium">No audit data yet</p>
          <p className="text-sm">Enter a URL above and run your first SEO audit</p>
        </div>
      )}
    </div>
  );
}
