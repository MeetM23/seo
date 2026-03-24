interface Props {
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'red' | 'orange' | 'yellow' | 'green' | 'indigo' | 'blue';
  icon?: string;
}

const accentMapBg: Record<string, string> = {
  red:    'bg-red-50 text-red-600',
  orange: 'bg-orange-50 text-orange-600',
  yellow: 'bg-yellow-50 text-yellow-600',
  green:  'bg-green-50 text-green-600',
  indigo: 'bg-[#e8f0fe] text-[#1a73e8]',
  blue:   'bg-[#e8f0fe] text-[#1a73e8]',
};

export default function StatCard({ label, value, sub, accent = 'blue', icon }: Props) {
  const iconBg = accentMapBg[accent];
  return (
    <div className={`bg-white rounded-3xl p-6 flex flex-col gap-3 shadow-[0_2px_10px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]`}>
      <div className="flex items-center gap-3 text-gray-500 text-sm font-medium">
        {icon && <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${iconBg}`}>{icon}</div>}
        {label}
      </div>
      <div className="text-4xl font-bold text-gray-900 ml-1">{value}</div>
      {sub && <div className="text-xs text-gray-400 ml-1">{sub}</div>}
    </div>
  );
}
