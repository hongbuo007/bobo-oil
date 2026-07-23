import { useEffect, useMemo } from 'react';
import { Card, Row, Col, Select, Table, Segmented } from 'antd';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { useVehicleStore } from '@/stores/useVehicleStore';
import { useRefuelStore } from '@/stores/useRefuelStore';
import { calculateMonthlyStats } from '@/services/costCalculator';
import { formatMoney, formatDate } from '@/utils/format';
import { ALGORITHM_NAMES } from '@/config/constants';
import StatCard from '@/components/common/StatCard';
import EmptyState from '@/components/common/EmptyState';
import type { MonthlyStats } from '@/services/costCalculator';
import { useState } from 'react';
import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';

const COLORS = ['#1890FF', '#52C41A', '#FAAD14', '#FF4D4F', '#722ED1', '#13C2C2', '#EB2F96'];

export default function StatisticsPage() {
  const navigate = useNavigate();
  const { vehicles, currentVehicleId, setCurrentVehicle } = useVehicleStore();
  const { records, loading, loadRecords } = useRefuelStore();
  const [timeRange, setTimeRange] = useState<string>('12');

  useEffect(() => {
    if (currentVehicleId) {
      loadRecords(currentVehicleId);
    }
  }, [currentVehicleId, loadRecords]);

  const currentVehicle = vehicles.find(v => v.id === currentVehicleId);

  const monthlyStats = useMemo(() => {
    const stats = calculateMonthlyStats(records);
    const months = parseInt(timeRange);
    return months > 0 ? stats.slice(-months) : stats;
  }, [records, timeRange]);

  // 汇总统计
  const summary = useMemo(() => {
    const validRecords = records.filter(r => r.calculatedConsumption !== null);
    return {
      totalCost: records.reduce((s, r) => s + r.totalCost, 0),
      totalFuel: records.reduce((s, r) => s + r.fuelAmount, 0),
      avgConsumption: validRecords.length > 0
        ? validRecords.reduce((s, r) => s + r.calculatedConsumption!, 0) / validRecords.length
        : null,
      avgCostPerKm: validRecords.filter(r => r.calculatedCostPerKm !== null).length > 0
        ? validRecords.filter(r => r.calculatedCostPerKm !== null)
            .reduce((s, r) => s + r.calculatedCostPerKm!, 0) /
          validRecords.filter(r => r.calculatedCostPerKm !== null).length
        : null,
      totalMileage: records.length > 1
        ? records[records.length - 1].currentMileage - records[0].currentMileage
        : 0,
    };
  }, [records]);

  // 油耗趋势（按日期，每个点一条记录）
  const trendData = useMemo(() => {
    return records
      .filter(r => r.calculatedConsumption !== null)
      .map(r => ({
        date: formatDate(r.date, 'MM-DD'),
        fullDate: formatDate(r.date),
        油耗: r.calculatedConsumption,
        algorithm: r.algorithmUsed ? ALGORITHM_NAMES[r.algorithmUsed] : '',
      }));
  }, [records]);

  // 月度统计表数据
  const tableData = useMemo(() => {
    return monthlyStats.map((s, i) => ({
      key: i,
      month: s.month,
      totalMileage: s.totalMileage,
      totalFuel: s.totalFuel,
      totalCost: s.totalCost,
      avgConsumption: s.avgConsumption,
      costPerKm: s.costPerKm,
      recordCount: s.recordCount,
    }));
  }, [monthlyStats]);

  // 月度油费柱状图数据
  const barData = useMemo(() => {
    return monthlyStats.map(s => ({
      month: s.month.substring(5) + '月',
      油费: Math.round(s.totalCost * 100) / 100,
      里程: s.totalMileage,
    }));
  }, [monthlyStats]);

  // 费用构成饼图
  const pieData = useMemo(() => {
    const totalCost = records.reduce((s, r) => s + r.totalCost, 0);
    if (totalCost === 0) return [];
    const fuelCost = totalCost; // 全部是油费
    return [
      { name: '油费', value: fuelCost },
    ];
  }, [records]);

  // 算法分布饼图
  const algorithmData = useMemo(() => {
    const map = new Map<number, number>();
    records.forEach(r => {
      if (r.algorithmUsed) {
        map.set(r.algorithmUsed, (map.get(r.algorithmUsed) || 0) + 1);
      }
    });
    return Array.from(map.entries()).map(([algo, count]) => ({
      name: ALGORITHM_NAMES[algo] || `算法${algo}`,
      value: count,
    }));
  }, [records]);

  const columns = [
    { title: '月份', dataIndex: 'month', key: 'month', width: 90 },
    { title: '行驶里程(km)', dataIndex: 'totalMileage', key: 'mileage', width: 120, render: (v: number) => v.toLocaleString() },
    { title: '加油量(L)', dataIndex: 'totalFuel', key: 'fuel', width: 100, render: (v: number) => v.toFixed(1) },
    { title: '油费(元)', dataIndex: 'totalCost', key: 'cost', width: 100, render: (v: number) => formatMoney(v) },
    { title: '平均油耗', dataIndex: 'avgConsumption', key: 'avg', width: 110, render: (v: number) => v > 0 ? `${v.toFixed(2)} L/100km` : '--' },
    { title: '每公里成本', dataIndex: 'costPerKm', key: 'cpk', width: 110, render: (v: number) => v > 0 ? `¥${v.toFixed(2)}/km` : '--' },
    { title: '次数', dataIndex: 'recordCount', key: 'count', width: 60 },
  ];

  if (vehicles.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          title="请先添加车辆"
          description="需要先添加车辆才能查看报表"
          action={<Button type="primary" onClick={() => navigate('/vehicles/add')}>添加车辆</Button>}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* 顶部控制 */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select
          value={currentVehicleId}
          onChange={setCurrentVehicle}
          style={{ minWidth: 240 }}
          options={vehicles.map(v => ({ value: v.id, label: `${v.brand} ${v.model}` }))}
        />
        <Segmented
          value={timeRange}
          onChange={setTimeRange}
          options={[
            { value: '3', label: '近3月' },
            { value: '6', label: '近6月' },
            { value: '12', label: '近1年' },
            { value: '0', label: '全部' },
          ]}
        />
      </div>

      {records.length === 0 ? (
        <EmptyState
          title="暂无加油记录"
          description="添加加油记录后即可查看统计分析"
          action={<Button type="primary" onClick={() => navigate('/refuel/add')}>添加记录</Button>}
        />
      ) : (
        <>
          {/* 汇总指标卡 */}
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={8} md={4}>
              <StatCard title="累计油费" value={summary.totalCost.toFixed(2)} prefix="¥" color="orange" />
            </Col>
            <Col xs={12} sm={8} md={4}>
              <StatCard title="累计加油" value={summary.totalFuel.toFixed(0)} unit="L" color="blue" />
            </Col>
            <Col xs={12} sm={8} md={4}>
              <StatCard title="平均油耗" value={summary.avgConsumption?.toFixed(2) ?? '--'} unit="L/100km" color="green" />
            </Col>
            <Col xs={12} sm={8} md={4}>
              <StatCard title="每公里成本" value={summary.avgCostPerKm?.toFixed(2) ?? '--'} unit="元/km" color="red" />
            </Col>
            <Col xs={12} sm={8} md={4}>
              <StatCard title="累计里程" value={summary.totalMileage.toLocaleString()} unit="km" color="blue" />
            </Col>
            <Col xs={12} sm={8} md={4}>
              <StatCard title="记录次数" value={records.length} unit="次" color="green" />
            </Col>
          </Row>

          {/* 油耗趋势图 */}
          <Card title="油耗趋势" size="small">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis unit=" L" fontSize={12} />
                <RechartsTooltip
                  formatter={(value) => [`${Number(value).toFixed(2)} L/100km`, '油耗']}
                />
                <Line type="monotone" dataKey="油耗" stroke="#1890FF" strokeWidth={2} dot={{ r: 3, fill: '#1890FF' }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* 月度油费和里程 */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="月度油费" size="small">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} />
                    <RechartsTooltip formatter={(value) => [`¥${Number(value).toFixed(2)}`, '油费']} />
                    <Bar dataKey="油费" fill="#FAAD14" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="月度行驶里程" size="small">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} />
                    <RechartsTooltip formatter={(value) => [`${Number(value).toLocaleString()} km`, '里程']} />
                    <Bar dataKey="里程" fill="#1890FF" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>

          {/* 算法分布 + 油耗分布 */}
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card title="算法使用分布" size="small">
                {algorithmData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={algorithmData}
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {algorithmData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-gray-400 py-12">暂无有效油耗数据</div>
                )}
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card title="油耗分布" size="small">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: '< 7L', value: records.filter(r => r.calculatedConsumption !== null && r.calculatedConsumption! < 7).length },
                        { name: '7-9L', value: records.filter(r => r.calculatedConsumption !== null && r.calculatedConsumption! >= 7 && r.calculatedConsumption! < 9).length },
                        { name: '9-12L', value: records.filter(r => r.calculatedConsumption !== null && r.calculatedConsumption! >= 9 && r.calculatedConsumption! < 12).length },
                        { name: '>= 12L', value: records.filter(r => r.calculatedConsumption !== null && r.calculatedConsumption! >= 12).length },
                      ].filter(d => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}次`}
                    >
                      <Cell fill="#52C41A" />
                      <Cell fill="#1890FF" />
                      <Cell fill="#FAAD14" />
                      <Cell fill="#FF4D4F" />
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>

          {/* 月度统计表格 */}
          <Card title="月度汇总明细" size="small">
            <Table
              dataSource={tableData}
              columns={columns}
              pagination={false}
              size="small"
              scroll={{ x: 750 }}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}><strong>合计</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={1}>{summary.totalMileage.toLocaleString()}</Table.Summary.Cell>
                  <Table.Summary.Cell index={2}>{summary.totalFuel.toFixed(1)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={3}>{formatMoney(summary.totalCost)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={4}>{summary.avgConsumption?.toFixed(2) ?? '--'}</Table.Summary.Cell>
                  <Table.Summary.Cell index={5}>{summary.avgCostPerKm?.toFixed(2) ?? '--'}</Table.Summary.Cell>
                  <Table.Summary.Cell index={6}>{records.length}</Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />
          </Card>
        </>
      )}
    </div>
  );
}
