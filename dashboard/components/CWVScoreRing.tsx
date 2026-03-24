'use client';
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts';

interface Props { score: number; label?: string; }

function scoreColor(s: number) {
  if (s >= 90) return '#34a853'; // Google Green
  if (s >= 50) return '#fbbc04'; // Google Yellow
  return '#ea4335';              // Google Red
}

export default function CWVScoreRing({ score, label = 'Avg Performance Score' }: Props) {
  const color = scoreColor(score);
  const data = [{ name: 'score', value: score, fill: color }];
  return (
    <div className="bg-white rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] p-8 flex flex-col items-center justify-center h-full">
      <h2 className="text-sm font-semibold text-gray-500 mb-4 tracking-wide">Avg Performance Score</h2>
      <div className="relative w-44 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="70%"
            outerRadius="100%"
            data={data}
            startAngle={210}
            endAngle={-30}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" background={{ fill: '#f3f4f6' }} cornerRadius={8} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-gray-900">{score}</span>
          <span className="text-xs text-gray-500 mt-1">/ 100</span>
        </div>
      </div>
    </div>
  );
}
