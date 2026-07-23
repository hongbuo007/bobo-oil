import { Card, Skeleton } from 'antd';

interface StatCardProps {
  title: string;
  value: string | number | null;
  unit?: string;
  prefix?: string;
  color?: 'green' | 'blue' | 'orange' | 'red';
  loading?: boolean;
}

const colorMap: Record<string, string> = {
  green: '#52c41a',
  blue: '#1890ff',
  orange: '#fa8c16',
  red: '#ff4d4f',
};

export default function StatCard({ title, value, unit, prefix, color = 'blue', loading = false }: StatCardProps) {
  const displayValue = value === null || value === undefined ? '--' : value;
  return (
    <Card className="h-full" bodyStyle={{ padding: '20px' }}>
      {loading ? (
        <Skeleton active paragraph={{ rows: 1 }} title={{ width: '60%' }} />
      ) : (
        <>
          <div className="text-sm text-gray-400 mb-2">{title}</div>
          <div className="flex items-baseline gap-1">
            {prefix && <span className="text-lg text-gray-400">{prefix}</span>}
            <span className="text-[48px] font-bold leading-tight" style={{ color: colorMap[color] }}>
              {displayValue}
            </span>
            {unit && <span className="text-base text-gray-400">{unit}</span>}
          </div>
        </>
      )}
    </Card>
  );
}
