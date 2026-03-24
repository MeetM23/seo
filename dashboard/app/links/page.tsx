'use client';
import { useState, useEffect, useMemo } from 'react';
import { LinkRow, LinkEntry } from '@/lib/data';

interface TreeNode {
  url: string;
  label: string;
  children: TreeNode[];
}

interface PageInsight {
  url: string;
  score: number;
  reason: string;
  severity: 'Good' | 'Warning' | 'Critical';
}

function buildTree(links: LinkRow[]): TreeNode | null {
  if (links.length === 0) return null;
  const rootUrl = links.find(p => new URL(p.url).pathname === '/') ? links.find(p => new URL(p.url).pathname === '/')!.url : links[0].url;
  const visited = new Set<string>();
  const createNode = (url: string): TreeNode => ({ url, label: new URL(url).pathname || '/', children: [] });
  const rootNode = createNode(rootUrl);
  const queue: { node: TreeNode; depth: number }[] = [{ node: rootNode, depth: 0 }];
  visited.add(rootUrl);
  while (queue.length > 0) {
    const { node, depth } = queue.shift()!;
    if (depth > 4) continue;
    const pageData = links.find(l => l.url === node.url);
    if (!pageData || !pageData.outgoingLinks) continue;
    
    const internalLinks = pageData.outgoingLinks.filter(l => l.type === 'internal');
    for (const link of internalLinks) {
      if (!visited.has(link.target) && links.some(p => p.url === link.target)) {
        const childNode = createNode(link.target);
        node.children.push(childNode);
        visited.add(link.target);
        queue.push({ node: childNode, depth: depth + 1 });
      }
    }
  }
  return rootNode;
}

function TreeItem({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const [isOpen, setIsOpen] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  return (
    <div className="ml-4">
      <div className="flex items-center gap-2 py-2 group">
        {hasChildren ? (
          <button onClick={() => setIsOpen(!isOpen)} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-600 transition-colors">
            <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
          </button>
        ) : <div className="w-6 h-6 border-l-2 border-b-2 border-gray-100 rounded-bl-lg ml-1 mb-2"></div>}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${hasChildren ? 'bg-blue-50/50 border-blue-100 text-blue-700 font-semibold' : 'bg-gray-50 border-gray-100 text-gray-600'}`}>
          <span className="text-sm">{hasChildren ? '📁' : '📄'} {node.label === '/' ? 'Home' : node.label}</span>
          {hasChildren && <span className="text-[10px] bg-blue-100 px-2 py-0.5 rounded-full">{node.children.length}</span>}
        </div>
      </div>
      {hasChildren && isOpen && <div className="border-l-2 border-dashed border-gray-100 ml-3">{node.children.map((child, i) => <TreeItem key={i} node={child} depth={depth + 1} />)}</div>}
    </div>
  );
}

export default function LinksPage() {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [selectedPage, setSelectedPage] = useState<LinkRow | null>(null);
  const [status, setStatus] = useState<{state: string, step: string, progress: number} | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'explorer' | 'tree' | 'insights'>('explorer');
  const [subTab, setSubTab] = useState<'incoming' | 'outgoing' | 'external'>('incoming');

  const treeData = useMemo(() => buildTree(links), [links]);

  const insights = useMemo(() => {
    if (links.length === 0) return { orphans: [], weak: [], strong: [], depthMap: {} };
    
    // Depth Map (BFS from homepage)
    const dm: Record<string, number> = {};
    const rootUrl = links.find(p => new URL(p.url).pathname === '/') ? links.find(p => new URL(p.url).pathname === '/')!.url : links[0].url;
    const q: { url: string; d: number }[] = [{ url: rootUrl, d: 0 }];
    while(q.length) {
      const { url, d } = q.shift()!;
      if (dm[url] !== undefined) continue;
      dm[url] = d;
      const pd = links.find(l => l.url === url);
      if (pd && pd.outgoingLinks) {
        pd.outgoingLinks.filter(l => l.type === 'internal').forEach(l => q.push({ url: l.target, d: d + 1 }));
      }
    }

    const orphans = links.filter(p => p.incomingCount === 0 && new URL(p.url).pathname !== '/');
    const weak = links.filter(p => p.incomingCount > 0 && p.incomingCount < 2);
    const strong = [...links].sort((a, b) => b.incomingCount - a.incomingCount).slice(0, 10);
    
    return { orphans, weak, strong, depthMap: dm };
  }, [links]);

  useEffect(() => {
    const fetchLinks = async () => {
      try {
        const [linksRes, statusRes] = await Promise.all([
          fetch('/api/links?_t=' + Date.now()),
          fetch('/api/audit-status?_t=' + Date.now())
        ]);
        const data = await linksRes.json();
        const stat = await statusRes.json();
        
        setLinks(data);
        setStatus(stat);
        
        setSelectedPage(prev => {
          if (!prev && data.length > 0) return data[0];
          if (prev && data.length > 0) {
            return data.find((p: LinkRow) => p.url === prev.url) || prev;
          }
          return prev;
        });
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchLinks();
    const interval = setInterval(fetchLinks, 3000);
    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  if (loading && links.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Link Intelligence</h1>
              <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                <span className="flex items-center gap-1.5 ">
                  <span className={`w-2 h-2 rounded-full ${status?.state === 'running' ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></span> 
                  {status?.state === 'running' ? 'Audit in Progress' : 'Analysis Live'}
                </span>
                <span className="text-gray-300">•</span>
                <span>{links.length} Pages Mapped</span>
              </div>
            </div>
          </div>
        </div>

        {status?.state === 'running' && (
            <div className="flex-1 max-w-md">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2">
                <span className="truncate max-w-[200px]">{status.step}</span>
                <span>{status.progress}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(37,99,235,0.3)]"
                  style={{ width: `${status.progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
          <button onClick={() => setActiveTab('explorer')} className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'explorer' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>Explorer</button>
          <button onClick={() => setActiveTab('tree')} className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'tree' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>Structure Map</button>
          <button onClick={() => setActiveTab('insights')} className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'insights' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>Insights Engine</button>
        </div>
      </header>

      {activeTab === 'explorer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Pages Sidebar */}
          <div className="lg:col-span-4 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[800px]">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-800">Crawl Data</h2>
                <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-bold">{links.length} index</span>
              </div>
              <div className="relative">
                <input type="text" placeholder="Filter pages..." className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {links.map((page) => (
                <button
                  key={page.url}
                  onClick={() => setSelectedPage(page)}
                  className={`w-full text-left px-4 py-3.5 rounded-2xl transition-all group ${
                    selectedPage?.url === page.url ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className="text-sm font-bold truncate mb-1.5">{new URL(page.url).pathname === '/' ? 'Homepage' : new URL(page.url).pathname}</div>
                  <div className={`flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider ${selectedPage?.url === page.url ? 'text-blue-100' : 'text-gray-400'}`}>
                    <span className="flex items-center gap-1.5">OUT: {page.internalCount}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1.5">IN: {page.incomingCount}</span>
                    {(page.linkIssues || []).length > 0 && <span className={`ml-auto px-2 py-0.5 rounded ${selectedPage?.url === page.url ? 'bg-white/20' : 'bg-red-50 text-red-500'}`}>⚠️ {(page.linkIssues || []).length}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Detailed Analysis */}
          <div className="lg:col-span-8 space-y-8">
            {selectedPage ? (
              <>
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { label: 'Authority Score', val: (selectedPage.incomingCount || 0) * 2 + (selectedPage.internalCount || 0), color: 'blue' },
                    { label: 'Internal Reach', val: selectedPage.incomingCount || 0, color: 'indigo' },
                    { label: 'Outbound Flow', val: selectedPage.internalCount || 0, color: 'violet' }
                  ].map((s, i) => (
                    <div key={i} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group hover:scale-[1.02] transition-transform">
                      <div className="relative z-10">
                        <div className="text-3xl font-black text-gray-900 mb-1">{s.val}</div>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">{s.label}</div>
                      </div>
                      <div className={`absolute bottom-[-20px] right-[-20px] w-24 h-24 rounded-full opacity-5 bg-${s.color}-600 group-hover:scale-150 transition-transform`}></div>
                    </div>
                  ))}
                </div>

                {/* Trust Layer Logic */}
                {selectedPage.indexingValidation && (
                  <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 overflow-hidden relative">
                    {selectedPage.indexingValidation.isGoogleVerified && (
                      <div className="absolute top-0 right-0 px-4 py-1.5 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-bl-2xl flex items-center gap-1.5 shadow-sm">
                        <span className="animate-pulse">✨</span> Google Verified
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Indexing Trust Layer</span>
                        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border ${
                          selectedPage.indexingValidation.final_verdict === 'VALID ISSUE' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                          selectedPage.indexingValidation.final_verdict === 'GOOGLE OVERRIDDEN' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                          selectedPage.indexingValidation.final_verdict === 'LIKELY FALSE POSITIVE' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                          'bg-indigo-50 text-indigo-600 border-indigo-100'
                        }`}>
                          Verdict: {selectedPage.indexingValidation.final_verdict}
                        </div>
                      </div>
                      <h3 className="text-lg font-black text-gray-800 leading-tight mb-2">
                        {selectedPage.indexingValidation.issue === 'None' ? 'Perfect Indexing Signal' : selectedPage.indexingValidation.issue}
                      </h3>
                      <p className="text-sm text-gray-500 leading-relaxed max-w-2xl">{selectedPage.indexingValidation.explanation}</p>
                      
                      <div className="flex flex-wrap gap-4 mt-4">
                        <div className="flex items-center gap-2">
                           <div className={`w-2 h-2 rounded-full ${selectedPage.indexingValidation.isFresh ? 'bg-blue-400' : 'bg-gray-200'}`}></div>
                           <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{selectedPage.indexingValidation.isFresh ? 'Content Fresh' : 'Older Content'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <div className={`w-2 h-2 rounded-full ${selectedPage.indexingValidation.isLikelyIndexedInSERP ? 'bg-indigo-400' : 'bg-gray-200'}`}></div>
                           <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{selectedPage.indexingValidation.isLikelyIndexedInSERP ? 'Found in SERP' : 'SERP Heuristic Neg.'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <div className="text-[10px] font-black text-gray-900 px-2 py-0.5 bg-gray-100 rounded">Score: {selectedPage.indexingValidation.confidence_score}</div>
                        </div>
                        {selectedPage.indexingValidation.signals && (
                          <div className="flex items-center gap-2">
                             <div className="text-[10px] font-black text-blue-600 px-2 py-0.5 bg-blue-50 rounded border border-blue-100 uppercase tracking-tighter">
                               {selectedPage.indexingValidation.signals.robots_tag} via {selectedPage.indexingValidation.signals.source}
                             </div>
                          </div>
                        )}
                      </div>
                    </div>
                    {selectedPage.indexingValidation.recommended_action && (
                       <div className="w-full md:w-auto p-5 bg-slate-900 rounded-2xl flex flex-col gap-2 shadow-lg shadow-slate-200">
                          <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Recommended Fix</span>
                          <div className="text-xs font-bold text-white text-center italic leading-relaxed">"{selectedPage.indexingValidation.recommended_action}"</div>
                       </div>
                    )}
                  </div>
                )}

                {/* Main Content Area */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden min-h-[500px] flex flex-col">
                  <div className="p-1 px-1 flex bg-gray-50 border-b border-gray-100">
                    {['incoming', 'outgoing', 'external'].map((t) => (
                      <button 
                        key={t}
                        onClick={() => setSubTab(t as any)}
                        className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all ${subTab === t ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                        {t} Links ({t === 'incoming' ? selectedPage.incomingCount : t === 'outgoing' ? selectedPage.internalCount : selectedPage.externalCount})
                      </button>
                    ))}
                  </div>

                  <div className="flex-1 p-8 space-y-4">
                    {subTab === 'incoming' && (
                      <div className="space-y-4">
                        {(selectedPage.incomingLinks || []).length > 0 ? (selectedPage.incomingLinks || []).map((l, i) => (
                          <div key={i} className="group p-5 bg-gray-50/50 hover:bg-white rounded-2xl border border-gray-50 hover:border-blue-100 transition-all">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs font-black text-blue-500 uppercase tracking-tighter flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span> Backlink</span>
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => copyToClipboard(l.source)} className="p-1.5 bg-white shadow-sm border rounded-lg text-gray-400 hover:text-blue-600">📋</button>
                                <a href={l.source} target="_blank" className="p-1.5 bg-white shadow-sm border rounded-lg text-gray-400 hover:text-blue-600">↗️</a>
                              </div>
                            </div>
                            <div className="text-sm font-bold text-gray-800 mb-2 truncate">{l.source}</div>
                            <div className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-[10px] font-black italic rounded-lg">Anchor: "{l.anchor}"</div>
                          </div>
                        )) : <div className="h-64 flex flex-col items-center justify-center text-gray-300 gap-4 font-bold"><span>⛓️</span> No incoming internal links found</div>}
                      </div>
                    )}
                    {subTab === 'outgoing' && (
                      <div className="space-y-4">
                        {(selectedPage.outgoingLinks || []).filter(l => l.type === 'internal').map((l, i) => {
                          const isBroken = !links.some(p => p.url === l.target);
                          return (
                            <div key={i} className={`p-5 rounded-2xl border transition-all ${isBroken ? 'bg-red-50 border-red-100' : 'bg-gray-50/50 hover:bg-white border-gray-50 hover:border-indigo-100'}`}>
                              <div className="flex justify-between mb-3 font-black text-[10px] uppercase tracking-widest">
                                <span className={isBroken ? 'text-red-600' : 'text-indigo-500'}>{isBroken ? '🔴 Broken Internal' : '🟣 Internal Link'}</span>
                                <a href={l.target} target="_blank" className="hover:text-indigo-600">↗️</a>
                              </div>
                              <div className="text-sm font-bold text-gray-800 mb-2 break-all">{l.target}</div>
                              <div className={`inline-block px-3 py-1 text-[10px] font-black italic rounded-lg ${isBroken ? 'bg-red-100 text-red-700' : 'bg-indigo-50 text-indigo-700'}`}>Anchor: "{l.anchor}"</div>
                            </div>
                          );
                        })}
                        {(selectedPage.outgoingLinks || []).filter(l => l.type === 'internal').length === 0 && <div className="h-64 flex flex-col items-center justify-center text-gray-300 gap-4 font-bold"><span>📤</span> No outgoing internal links found</div>}
                      </div>
                    )}
                    {subTab === 'external' && (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(selectedPage.externalLinks || []).map((l, i) => (
                           <div key={i} className="p-5 bg-violet-50/30 rounded-2xl border border-violet-100/50 flex flex-col h-full">
                              <span className="text-[10px] font-black text-violet-500 uppercase tracking-widest mb-2">🌍 External</span>
                              <div className="text-sm font-bold text-gray-800 mb-auto truncate">{l.target}</div>
                              <div className="mt-4 text-[10px] font-bold text-violet-600 bg-violet-100 px-2 py-1 rounded-lg italic">"{l.anchor}"</div>
                           </div>
                        ))}
                        {(selectedPage.externalLinks || []).length === 0 && <div className="h-64 flex flex-col items-center justify-center text-gray-300 gap-4 font-bold w-full col-span-2"><span>🌍</span> No external links found</div>}
                       </div>
                    )}
                  </div>
                </div>
              </>
            ) : <div className="h-[600px] bg-white rounded-3xl border border-gray-100 flex items-center justify-center text-gray-400 font-bold">Select a page to analyze its link DNA</div>}
          </div>
        </div>
      )}

      {activeTab === 'tree' && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 min-h-[700px]">
          <div className="flex items-center justify-between mb-8 pb-8 border-b border-gray-50">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Architecture Visualization</h2>
              <p className="text-sm text-gray-500 mt-1">Hierarchical BFS map of your site structure starting from homepage.</p>
            </div>
            <div className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-xs font-black uppercase tracking-widest border border-indigo-100">
               Depth Limit: 4 Steps
            </div>
          </div>
          {treeData ? <div className="max-w-4xl mx-auto"><TreeItem node={treeData} /></div> : null}
        </div>
      )}

      {activeTab === 'insights' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Orphan Pages', val: insights.orphans.length, color: 'rose', unit: 'pages' },
              { label: 'Weak Links', val: insights.weak.length, color: 'orange', unit: 'pages' },
              { label: 'Deep Pages', val: Object.values(insights.depthMap).filter(d => d > 3).length, color: 'blue', unit: 'pages' },
              { label: 'Avg Inbound', val: (links.reduce((acc, l) => acc + l.incomingCount, 0) / links.length || 0).toFixed(1), color: 'emerald', unit: 'links/page' }
            ].map((i, idx) => (
              <div key={idx} className={`bg-white p-8 rounded-3xl border border-gray-100 shadow-sm border-b-4 border-b-${i.color}-500 transition-all hover:translate-y-[-4px]`}>
                 <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">{i.label}</div>
                 <div className="text-4xl font-black text-gray-900 flex items-baseline gap-2">{i.val} <span className="text-xs font-bold text-gray-400">{i.unit}</span></div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Top Authority */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
               <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center justify-between">
                 🚀 Top Authority Pages
                 <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase">Most Backlinks</span>
               </h3>
               <div className="space-y-4">
                 {insights.strong.map((p, i) => (
                   <div key={i} className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition-all border border-transparent hover:border-gray-100">
                     <div className="flex items-center gap-4 min-w-0">
                       <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xs">{i+1}</span>
                       <div className="truncate min-w-0">
                         <div className="text-sm font-bold text-gray-800 truncate">{new URL(p.url).pathname}</div>
                         <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{p.incomingCount} Internal backlink(s)</div>
                       </div>
                     </div>
                     <a href={p.url} target="_blank" className="p-2 text-gray-300 hover:text-blue-500 transition-colors">↗️</a>
                   </div>
                 ))}
               </div>
            </div>

            {/* Link Safety */}
            <div className="grid grid-cols-1 gap-8">
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center justify-between text-rose-600">
                   🔥 Cleanup Required
                   <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full uppercase">Alerts</span>
                </h3>
                <div className="space-y-4">
                   {insights.orphans.length > 0 ? insights.orphans.slice(0, 5).map((p, i) => (
                     <div key={i} className="p-4 bg-rose-50/50 rounded-2xl border border-rose-100 flex items-center justify-between">
                       <div className="min-w-0">
                          <div className="text-sm font-bold text-gray-800 truncate">{new URL(p.url).pathname}</div>
                          <div className="text-[10px] text-rose-600 font-bold uppercase tracking-widest mt-0.5">Orphan Page — 0 internal links</div>
                       </div>
                     </div>
                   )) : <div className="p-8 text-center text-emerald-500 font-bold text-sm bg-emerald-50/50 rounded-3xl border border-emerald-100">✨ No orphan pages detected</div>}
                </div>
              </div>

              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center justify-between text-orange-600">
                   ⚠️ Optimization Suggested
                   <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full uppercase">Notice</span>
                </h3>
                <div className="space-y-4">
                   {insights.weak.slice(0, 5).map((p, i) => (
                     <div key={i} className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100 flex items-center justify-between">
                       <div className="min-w-0">
                          <div className="text-sm font-bold text-gray-800 truncate">{new URL(p.url).pathname}</div>
                          <div className="text-[10px] text-orange-600 font-bold uppercase tracking-widest mt-0.5">Weak Internal Authority ({p.incomingCount} link)</div>
                       </div>
                     </div>
                   ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
