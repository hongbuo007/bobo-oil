import { Card, Skeleton } from 'antd';

interface StatCardProps {
  title: string;
  value: string | number | null;
  unit?: string;
  prefix?: string;
  icon?: React.ReactNode;
  color?: 'green' | 'blue' | 'orange' | 'red';
  loading?: boolean;
}

const colorConfig: Record<string, { color: string; bg: string; gradient: string }> = {
  green:  { color: '#52c41a', bg: '#f6ffed', gradient: 'linear-gradient(135deg, #f6ffed, #fcffe6)' },
  blue:   { color: '#1677ff', bg: '#e6f4ff', gradient: 'linear-gradient(135deg, #e6f4ff, #f0f5ff)' },
  orange: { color: '#fa8c16', bg: '#fff7e6', gradient: 'linear-gradient(135deg, #fff7e6, #fffbe6)' },
  red:    { color: '#ff4d4f', bg: '#fff2f0', gradient: 'linear-gradient(135deg, #fff2f0, #fff1f0)' },
};

export default function StatCard({ title, value, unit, prefix, icon, color = 'blue', loading = false }: StatCardProps) {
  const cfg = colorConfig[color] || colorConfig.blue;
  const displayValue = value === null || value === undefined ? '--' : value;

  return (
    <Card
      className="h-full card-hover overflow-hidden"
      styles={{ body: { padding: '20px', background: cfg.gradient } }}
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 1 }} title={{ width: '60%' }} />
      ) : (
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            {icon && <span className="text-lg opacity-60">{icon}</span>}
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</span>
          </div>
          <div className="flex items-baseline gap-1">
            {prefix && <span className="text-sm text-gray-400 font-medium">{prefix}</span>}
            <span
              className="text-[44px] font-extrabold leading-none tracking-tight"
              style={{ color: cfg.color, fontFamily: "'Inter', -apple-system, sans-serif" }}
            >
              {displayValue}
            </span>
            {unit && <span className="text-xs text-gray-400 ml-0.5 font-medium">{unit}</span>}
          </div>
        </div>
      )}
    </Card>
  );
}
