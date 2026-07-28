import { useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Select, Table, Card, Button } from 'antd';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LabelList,
  Area,
  AreaChart,
} from 'recharts';
import {
  DashboardOutlined,
  FireOutlined,
  DollarOutlined,
  CarOutlined,
  ThunderboltOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import { useVehicleStore } from '@/stores/useVehicleStore';
import { useRefuelStore } from '@/stores/useRefuelStore';
import { calculateDashboardStats, calculateMonthlyStats } from '@/services/costCalculator';
import { formatNumber, formatMoney, formatConsumption, formatCostPerKm, formatDate } from '@/utils/format';
import { ALGORITHM_NAMES } from '@/config/constants';
import StatCard from '@/components/common/StatCard';
import EmptyState from '@/components/common/EmptyState';
import type { MonthlyStats, DashboardStats } from '@/services/costCalculator';
import type { RefuelRecord } from '@/models/refuel';

export default function DashboardPage() {
  const navigate = useNavigate();
  const vehicles = useVehicleStore((s) => s.vehicles);
  const currentVehicleId = useVehicleStore((s) => s.currentVehicleId);
  const getCurrentVehicle = useVehicleStore((s) => s.getCurrentVehicle);
  const setCurrentVehicle = useVehicleStore((s) => s.setCurrentVehicle);

  const records = useRefuelStore((s) => s.records);
  const loading = useRefuelStore((s) => s.loading);
  const loadRecords = useRefuelStore((s) => s.loadRecords);

  useEffect(() => {
    if (currentVehicleId) {
      loadRecords(currentVehicleId);
    }
  }, [currentVehicleId, loadRecords]);

  const stats: DashboardStats = useMemo(() => calculateDashboardStats(records), [records]);
  const monthlyStats: MonthlyStats[] = useMemo(() => calculateMonthlyStats(records), [records]);

  const trendData = useMemo(() => {
    const validRecords = records
      .filter((r) => r.calculatedConsumption !== null)
      .map((r) => ({
        date: formatDate(r.date, 'MM-DD'),
        fullDate: r.date,
        consumption: Number(r.calculatedConsumption!.toFixed(2)),
        algorithm: r.algorithmUsed,
      }));
    return validRecords.length > 20 ? validRecords.slice(validRecords.length - 20) : validRecords;
  }, [records]);

  const barData = useMemo(() => {
    return monthlyStats.map((m) => ({
      month: m.month,
      cost: Math.round(m.totalCost * 100) / 100,
    }));
  }, [monthlyStats]);

  const recentRecords: RefuelRecord[] = useMemo(() => {
    return [...records].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  }, [records]);

  const handleVehicleChange = useCallback(
    (value: string | null) => {
      setCurrentVehicle(value);
    },
    [setCurrentVehicle],
  );

  const currentVehicle = getCurrentVehicle();

  if (vehicles.length === 0) {
    return (
      <div className="p-6 page-enter">
        <EmptyState
          title="还没有添加车辆"
          description="添加您的第一辆车，开始记录油耗数据"
          action={
            <Button type="primary" size="large" onClick={() => navigate('/vehicles/add')}>
              添加车辆
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 page-enter">
      {/* 顶部横幅 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 m-0">
            {currentVehicle ? `${currentVehicle.brand} ${currentVehicle.model}` : '仪表盘'}
          </h1>
          <p className="text-sm text-gray-400 mt-1 m-0">
            {currentVehicle?.licensePlate || '选择车辆查看数据'}
          </p>
        </div>
        <Select
          className="min-w-[220px]"
          size="large"
          value={currentVehicleId}
          onChange={handleVehicleChange}
          placeholder="选择车辆"
          options={vehicles.map((v) => ({
            label: `${v.name || v.brand} ${v.licensePlate ? `(${v.licensePlate})` : ''}`,
            value: v.id,
          }))}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <span className="text-gray-400">加载中...</span>
        </div>
      ) : !currentVehicle ? null : records.length === 0 ? (
        <EmptyState
          title="暂无加油记录"
          description={`${currentVehicle.brand} ${currentVehicle.model} 还没有加油记录`}
          action={
            <Button type="primary" size="large" onClick={() => navigate('/refuel/add')}>
              添加第一条记录
            </Button>
          }
        />
      ) : (
        <>
          {/* 核心指标卡 */}
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={6}>
              <StatCard
                title="最新油耗"
                value={stats.latestConsumption !== null ? formatNumber(stats.latestConsumption) : '--'}
                unit="L/100km"
                color="blue"
                icon={<ThunderboltOutlined />}
              />
            </Col>
            <Col xs={12} sm={6}>
              <StatCard
                title="平均油耗"
                value={stats.avgConsumption !== null ? formatNumber(stats.avgConsumption) : '--'}
                unit="L/100km"
                color="green"
                icon={<RiseOutlined />}
              />
            </Col>
            <Col xs={12} sm={6}>
              <StatCard
                title="本月油费"
                value={formatMoney(stats.monthlyCost)}
                color="orange"
                icon={<DollarOutlined />}
              />
            </Col>
            <Col xs={12} sm={6}>
              <StatCard
                title="每公里成本"
                value={stats.costPerKm !== null ? formatNumber(stats.costPerKm, 2) : '--'}
                unit="元/km"
                color="red"
                icon={<FireOutlined />}
              />
            </Col>
          </Row>

          {/* 图表区 */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="油耗趋势" className="h-full">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorConsumption" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1677ff" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#1677ff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis unit=" L" tick={{ fontSize: 12 }} />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length > 0) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 rounded-xl shadow-lg border border-gray-100">
                              <div className="text-xs text-gray-400">{data.fullDate}</div>
                              <div className="text-lg font-bold text-blue-600">{data.consumption} L/100km</div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area type="monotone" dataKey="consumption" stroke="#1677ff" strokeWidth={2.5} fill="url(#colorConsumption)" dot={{ fill: '#1677ff', r: 3 }} activeDot={{ r: 5, strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="月度油费" className="h-full">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={barData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tickFormatter={(v) => `${v.substring(5)}月`} tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `¥${v}`} />
                    <RechartsTooltip
                      formatter={(value) => [`¥${Number(value).toFixed(2)}`, '油费']}
                      labelFormatter={(label) => `${(label as string).substring(5)}月`}
                    />
                    <Bar dataKey="cost" fill="#52c41a" radius={[6, 6, 0, 0]} name="油费">
                      <LabelList dataKey="cost" position="top" style={{ fontSize: 11, fill: '#666' }} formatter={(v: any) => `¥${Math.round(Number(v || 0) * 100) / 100}`} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>

          {/* 最近加油记录 */}
          <Card title="最近加油记录" extra={<Button type="link" size="small" onClick={() => navigate('/refuel')}>查看全部</Button>}>
            <Table
              dataSource={recentRecords}
              rowKey="id"
              pagination={false}
              size="middle"
              onRow={(record) => ({
                onClick: () => navigate(`/refuel/${record.id}`),
                className: 'cursor-pointer',
              })}
              columns={[
                {
                  title: '日期',
                  dataIndex: 'date',
                  key: 'date',
                  width: 110,
                  render: (v: string) => formatDate(v),
                },
                {
                  title: '里程',
                  dataIndex: 'currentMileage',
                  key: 'currentMileage',
                  width: 110,
                  render: (v: number) => `${v.toLocaleString('zh-CN')} km`,
                },
                {
                  title: '加油量',
                  dataIndex: 'fuelAmount',
                  key: 'fuelAmount',
                  width: 90,
                  render: (v: number) => `${v.toFixed(2)} L`,
                },
                {
                  title: '金额',
                  dataIndex: 'actualCost',
                  key: 'actualCost',
                  width: 100,
                  render: (_: unknown, r: RefuelRecord) => {
                    const actual = r.actualCost ?? r.totalCost ?? 0;
                    return <span className="font-medium">{formatMoney(actual)}</span>;
                  },
                },
                {
                  title: '油耗',
                  dataIndex: 'calculatedConsumption',
                  key: 'calculatedConsumption',
                  width: 110,
                  render: (v: number | null) => (
                    <span className={`font-semibold ${v !== null ? (v < 7 ? 'consumption-low' : v < 9 ? 'consumption-normal' : v < 12 ? 'consumption-high' : 'consumption-very-high') : 'text-gray-300'}`}>
                      {formatConsumption(v)}
                    </span>
                  ),
                },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  );
}
