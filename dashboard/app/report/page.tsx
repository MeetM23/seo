'use client';

import { useEffect, useState } from 'react';
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts';

interface Pattern { pattern: string; count: number; cause: string; fix: string; }
interface ReportData {
  siteHealth: number;
  patterns: Pattern[];
  totalIssues: number;
  topRecommendations: string[];
  indexing?: {
    noindexFound: number;
    mismatches: number;
    warnings: number;
    verified: number;
  };
}
interface AuditStatus { state: string; step?: string; progress?: number; }

/* ── Animated radial health gauge ── */
function HealthGauge({ score }: { score: number }) {
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(score), 200);
    return () => clearTimeout(t);
  }, [score]);

  const color  = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  const label  = score >= 80 ? 'Excellent' : score >= 50 ? 'Needs Work' : 'Poor';
  const data   = [{ value: animated, fill: color }];

  return (
    <div className="relative flex flex-col items-center justify-center">
      <div className="relative w-52 h-52">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="68%" outerRadius="100%" data={data} startAngle={210} endAngle={-30}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" background={{ fill: 'rgba(255,255,255,0.1)' }} cornerRadius={10} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-black text-white">{score}</span>
          <span className="text-white/60 text-xs font-semibold mt-1 uppercase tracking-widest">/ 100</span>
        </div>
      </div>
      <span
        className="mt-2 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
        style={{ background: `${color}30`, color }}
      >{label}</span>
    </div>
  );
}

/* ── Severity badge ── */
const SEV: Record<string, string> = {
  Critical: 'bg-red-100 text-red-600',
  High:     'bg-orange-100 text-orange-600',
  Medium:   'bg-yellow-100 text-yellow-700',
  Low:      'bg-green-100 text-green-700',
};

export default function ReportPage() {
  const [report, setReport]   = useState<ReportData | null>(null);
  const [status, setStatus]   = useState<AuditStatus>({ state: 'idle' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const poll = async () => {
      try {
        const [sRes, rRes] = await Promise.all([
          fetch(`/api/audit-status?_t=${Date.now()}`, { cache: 'no-store' }),
          fetch(`/api/report?_t=${Date.now()}`,        { cache: 'no-store' }),
        ]);
        if (sRes.ok) setStatus(await sRes.json());
        if (rRes.ok) { setReport(await rRes.json()); setLoading(false); }
        else setLoading(false);
      } catch { setLoading(false); }
      timer = setTimeout(poll, 2000);
    };
    poll();
    return () => clearTimeout(timer);
  }, []);

  const isRunning  = status.state === 'running';
  const recs       = report?.topRecommendations ?? [];
  const patterns   = report?.patterns ?? [];
  const health     = report?.siteHealth ?? 0;

  return (
    <div className="space-y-10 pb-24">

      {/* ── Hero banner ──────────────────────────────────────────────────────── */}
      <div
        className="relative rounded-3xl overflow-hidden p-8 md:p-12"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #1a73e8 100%)' }}
      >
        {/* decorative circles */}
        <div className="absolute -top-10 -right-10 w-64 h-64 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #60a5fa, transparent)' }} />
        <div className="absolute -bottom-16 -left-10 w-80 h-80 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #818cf8, transparent)' }} />

        <div className="relative flex flex-col md:flex-row items-center gap-10">
          {/* Left: title + status */}
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center gap-2 mb-3 justify-center md:justify-start">
              <span className="text-blue-300 text-xs font-bold uppercase tracking-widest">SEO Decision Engine</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Technical SEO Report</h1>
            <p className="text-white/50 mt-2 text-sm">Executive summary · Pattern detection · AI recommendations</p>

            {/* Audit status pill */}
            <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold"
                 style={{ background: isRunning ? 'rgba(96,165,250,0.2)' : 'rgba(16,185,129,0.15)' }}>
              {isRunning ? (
                <><span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                  <span className="text-blue-300">Live — crawling in progress</span></>
              ) : status.state === 'completed' ? (
                <><span className="text-emerald-400">✓</span>
                  <span className="text-emerald-300">Audit completed</span></>
              ) : (
                <><span className="text-white/40">○</span>
                  <span className="text-white/40">Idle</span></>
              )}
            </div>

            {/* Progress bar while running */}
            {isRunning && (
              <div className="mt-4 max-w-sm mx-auto md:mx-0">
                <p className="text-white/60 text-xs mb-2 truncate">{status.step}</p>
                <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-blue-400 h-1.5 rounded-full transition-all duration-500"
                       style={{ width: `${status.progress || 2}%` }}/>
                </div>
                <p className="text-white/40 text-xs mt-1">{status.progress || 0}%</p>
              </div>
            )}
          </div>

          {/* Right: health gauge */}
          {!loading && (
            <div className="flex-shrink-0">
              {report ? <HealthGauge score={health} /> : (
                <div className="w-52 h-52 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center text-white/30 text-sm">No data</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Stat cards ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Site health */}
        <div className="bg-white rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.06)] p-7 flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-2xl flex-shrink-0">📈</div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Site Health</p>
            <p className={`text-3xl font-black mt-0.5 ${health >= 80 ? 'text-emerald-500' : health >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
              {loading ? '—' : report ? `${health}%` : 'N/A'}
            </p>
          </div>
        </div>

        {/* Total issues */}
        <div className="bg-white rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.06)] p-7 flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center text-2xl flex-shrink-0">🔍</div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Total Issues</p>
            <p className="text-3xl font-black text-gray-900 mt-0.5">{loading ? '—' : report?.totalIssues ?? 0}</p>
          </div>
        </div>

        {/* Patterns */}
        <div className="bg-white rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.06)] p-7 flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center text-2xl flex-shrink-0">🧬</div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Pattern Clusters</p>
            <p className="text-3xl font-black text-gray-900 mt-0.5">{loading ? '—' : patterns.length}</p>
          </div>
        </div>
      </div>

      {/* ── Indexing Health ────────────────────────────────────────────────── */}
      {report?.indexing && (
        <section className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="p-6 border-b border-gray-50 flex items-center justify-between"
               style={{ background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)' }}>
            <div className="flex items-center gap-3">
              <span className="text-xl">🛡️</span>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Advanced Indexing Health</h2>
            </div>
            <span className="text-[10px] bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-black uppercase tracking-widest border border-indigo-200">3-Signal Validation Active</span>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
             <div className="flex flex-col gap-2">
                <div className="text-3xl font-black text-rose-600">{report.indexing.noindexFound}</div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Validated Noindex</div>
                <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">Explicitly blocked across HTML, Googlebot, and Headers with 90%+ confidence score.</p>
             </div>
             <div className="flex flex-col gap-2 border-l border-gray-100 md:pl-8">
                <div className="text-3xl font-black text-amber-500">{report.indexing.mismatches}</div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Bot Mismatches</div>
                <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">Pages where Googlebot sees different indexing signals than standard Chrome crawlers.</p>
             </div>
             <div className="flex flex-col gap-2 border-l border-gray-100 md:pl-8 font-black">
                <div className="text-3xl font-black text-emerald-500">{report.indexing.verified}</div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Google Verified</div>
                <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">Pages where indexing status was matched and confirmed by Google Search Console data.</p>
             </div>
          </div>
        </section>
      )}

      {/* ── No data ──────────────────────────────────────────────────────────── */}
      {!loading && !report && (
        <div className="rounded-3xl border-2 border-dashed border-gray-200 bg-gray-50 p-20 text-center">
          <p className="text-5xl mb-4">📊</p>
          <p className="text-gray-600 font-semibold text-lg">No report data yet</p>
          <p className="text-gray-400 text-sm mt-2">Run an audit from the Dashboard to generate your first report.</p>
        </div>
      )}

      {report && (<>

        {/* ── Top Recommendations ───────────────────────────────────────────── */}
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚀</span>
            <h2 className="text-xl font-black text-gray-900">Top Recommendations</h2>
            <span className="ml-auto text-xs text-gray-400 font-medium">{recs.length} action{recs.length !== 1 ? 's' : ''}</span>
          </div>

          {recs.length > 0 ? (
            <div className="grid gap-3">
              {recs.map((rec, i) => (
                <div key={i}
                     className="group bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.05)] p-5 flex items-start gap-4 border border-transparent hover:border-blue-100 hover:shadow-[0_4px_16px_rgba(26,115,232,0.08)] transition-all duration-200">
                  <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm"
                       style={{ background: `linear-gradient(135deg, #1a73e8, #6366f1)`, color: '#fff' }}>{i + 1}</div>
                  <p className="text-gray-800 font-medium leading-relaxed pt-0.5">{rec}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 flex items-center gap-4">
              <span className="text-3xl">🎉</span>
              <div>
                <p className="font-semibold text-emerald-800">No critical recommendations</p>
                <p className="text-emerald-600 text-sm mt-0.5">Your site looks great! Run a full crawl to get detailed suggestions.</p>
              </div>
            </div>
          )}
        </section>

        {/* ── Pattern Detection ─────────────────────────────────────────────── */}
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧬</span>
            <h2 className="text-xl font-black text-gray-900">Cluster Pattern Detection</h2>
            <span className="ml-auto text-xs text-gray-400 font-medium">{patterns.length} pattern{patterns.length !== 1 ? 's' : ''} found</span>
          </div>

          {patterns.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {patterns.map((p, i) => (
                <div key={i}
                     className="bg-white rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.06)] overflow-hidden border border-gray-100 hover:shadow-[0_6px_20px_rgba(0,0,0,0.1)] transition-all duration-200">
                  {/* Card header */}
                  <div className="px-6 py-4 flex items-start justify-between gap-3"
                       style={{ background: 'linear-gradient(135deg, #f8faff, #eef2ff)' }}>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm leading-snug">{p.pattern}</p>
                      <p className="text-xs text-gray-400 mt-1 font-medium">Detected across {p.count} pages</p>
                    </div>
                    <span className="flex-shrink-0 bg-blue-100 text-blue-700 text-xs font-black px-2.5 py-1 rounded-full">×{p.count}</span>
                  </div>

                  {/* Card body */}
                  <div className="grid grid-cols-2 divide-x divide-gray-100">
                    <div className="px-5 py-4">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Probable Cause</p>
                      <p className="text-xs text-gray-600 font-mono leading-relaxed">{p.cause}</p>
                    </div>
                    <div className="px-5 py-4">
                      <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-2">Recommended Fix</p>
                      <p className="text-xs text-gray-800 font-semibold leading-relaxed">{p.fix}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border-2 border-dashed border-gray-200 bg-gray-50 p-12 text-center">
              <p className="text-4xl mb-3">✨</p>
              <p className="font-semibold text-gray-600">No systemic patterns detected</p>
              <p className="text-gray-400 text-sm mt-1">Crawl more pages to surface template-level issues across your site.</p>
            </div>
          )}
        </section>

      </>)}
    </div>
  );
}
