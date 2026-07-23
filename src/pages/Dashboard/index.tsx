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
} from 'recharts';
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
      cost: m.totalCost,
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
      <div className="p-6">
        <EmptyState
          title="还没有添加车辆"
          description="添加您的第一辆车，开始记录油耗数据"
          action={
            <Button type="primary" onClick={() => navigate('/vehicles/add')}>
              添加车辆
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 车辆切换器 */}
      <div className="flex items-center gap-3">
        <span className="text-gray-500 text-sm whitespace-nowrap">当前车辆：</span>
        <Select
          className="min-w-[240px]"
          value={currentVehicleId}
          onChange={handleVehicleChange}
          placeholder="请选择车辆"
          options={vehicles.map((v) => ({
            label: `${v.brand} ${v.model} (${v.licensePlate})`,
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
          description={`${currentVehicle.brand} ${currentVehicle.model} 还没有加油记录，开始记录您的第一笔加油数据`}
          action={
            <Button type="primary" onClick={() => navigate('/refuel/add')}>
              添加加油记录
            </Button>
          }
        />
      ) : (
        <>
          {/* 核心指标卡 */}
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={12} md={6}>
              <StatCard
                title="最新油耗"
                value={stats.latestConsumption !== null ? formatNumber(stats.latestConsumption) : '--'}
                unit="L/100km"
                color="blue"
              />
            </Col>
            <Col xs={12} sm={12} md={6}>
              <StatCard
                title="平均油耗"
                value={stats.avgConsumption !== null ? formatNumber(stats.avgConsumption) : '--'}
                unit="L/100km"
                color="green"
              />
            </Col>
            <Col xs={12} sm={12} md={6}>
              <StatCard
                title="本月油费"
                value={formatMoney(stats.monthlyCost)}
                color="orange"
              />
            </Col>
            <Col xs={12} sm={12} md={6}>
              <StatCard
                title="每公里成本"
                value={stats.costPerKm !== null ? formatNumber(stats.costPerKm, 2) : '--'}
                unit="元/km"
                color="red"
              />
            </Col>
          </Row>

          {/* 油耗趋势图 */}
          <Card title="油耗趋势" className="w-full">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis unit=" L" tick={{ fontSize: 12 }} />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length > 0) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                          <div className="text-sm text-gray-500">{data.fullDate}</div>
                          <div className="text-lg font-bold" style={{ color: '#1890FF' }}>
                            {data.consumption} L/100km
                          </div>
                          {data.algorithm && (
                            <div className="text-xs text-gray-400 mt-1">
                              算法：{ALGORITHM_NAMES[data.algorithm] || `算法${data.algorithm}`}
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="consumption"
                  stroke="#1890FF"
                  strokeWidth={2}
                  dot={{ fill: '#1890FF', r: 4 }}
                  activeDot={{ r: 6 }}
                  name="油耗"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* 月度油费柱状图 */}
          <Card title="月度油费统计" className="w-full">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <RechartsTooltip
                  formatter={(value) => [`¥${Number(value).toFixed(2)}`, '油费']}
                  labelFormatter={(label) => `${label}`}
                />
                <Bar dataKey="cost" fill="#52C41A" radius={[4, 4, 0, 0]} name="油费" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* 最近加油记录 */}
          <Card title="最近加油记录">
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
                  render: (v: string) => formatDate(v),
                },
                {
                  title: '里程',
                  dataIndex: 'currentMileage',
                  key: 'currentMileage',
                  render: (v: number) => `${v.toLocaleString('zh-CN')} km`,
                },
                {
                  title: '加油量',
                  dataIndex: 'fuelAmount',
                  key: 'fuelAmount',
                  render: (v: number) => `${v.toFixed(2)} L`,
                },
                {
                  title: '金额',
                  dataIndex: 'totalCost',
                  key: 'totalCost',
                  render: (v: number) => formatMoney(v),
                },
                {
                  title: '油耗',
                  dataIndex: 'calculatedConsumption',
                  key: 'calculatedConsumption',
                  render: (v: number | null) => (
                    <span className={v !== null ? 'font-medium' : 'text-gray-300'}>
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
