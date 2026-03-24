'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  data: { severity: string; count: number }[];
}

const COLOR_MAP: Record<string, string> = {
  Critical: '#ea4335', // Google Red
  High:     '#f9ab00', // Google Orange-ish
  Medium:   '#fbbc04', // Google Yellow
  Low:      '#34a853', // Google Green
};

export default function SeverityBarChart({ data }: Props) {
  return (
    <div className="bg-white rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] p-8 h-full">
      <h2 className="text-sm font-semibold text-gray-500 mb-8 tracking-wide">Issues by Severity</h2>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis dataKey="severity" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8, color: '#111827' }}
            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={60}>
            {data.map(entry => (
              <Cell key={entry.severity} fill={COLOR_MAP[entry.severity] ?? '#2563eb'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
