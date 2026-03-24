import { getIssues } from '@/lib/data';
import IssuesTable from '@/components/IssuesTable';
export const dynamic = 'force-dynamic';

export default async function IssuesPage() {
  const issues = getIssues();

  const sevCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 } as Record<string, number>;
  for (const i of issues) sevCounts[i.severity] = (sevCounts[i.severity] || 0) + 1;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">SEO Issues</h1>
        <p className="text-gray-500 text-base mt-2">{issues.length} issues found across all crawled pages</p>
      </div>

      {/* Severity pills */}
      <div className="flex flex-wrap gap-4">
        {Object.entries(sevCounts).map(([sev, count]) => {
          const colorMap: Record<string, string> = {
            Critical: 'bg-[#fce8e6] text-[#d93025]',
            High:     'bg-[#feefe3] text-[#e8710a]',
            Medium:   'bg-[#fef7e0] text-[#e37400]',
            Low:      'bg-[#e6f4ea] text-[#137333]',
          };
          return (
            <div key={sev} className={`px-5 py-2.5 rounded-full text-sm font-medium shadow-[0_2px_10px_rgba(0,0,0,0.04)] ${colorMap[sev]}`}>
              {sev}: <span className="font-bold">{count}</span>
            </div>
          );
        })}
      </div>

      <IssuesTable issues={issues} />
    </div>
  );
}
