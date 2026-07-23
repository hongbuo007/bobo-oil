import type { RefuelRecord } from '@/models/refuel';

export interface MonthlyStats {
  month: string;           // 'YYYY-MM'
  totalMileage: number;    // 当月行驶里程
  totalFuel: number;       // 当月总加油量
  totalCost: number;       // 当月总油费
  avgConsumption: number;  // 当月平均油耗
  costPerKm: number;       // 当月每公里成本
  recordCount: number;     // 当月加油次数
}

export interface DashboardStats {
  latestConsumption: number | null;
  avgConsumption: number | null;
  monthlyCost: number;
  costPerKm: number | null;
  totalMileage: number;
  totalFuel: number;
  totalCost: number;
  recordCount: number;
}

/**
 * 计算仪表盘统计数据
 */
export function calculateDashboardStats(records: RefuelRecord[]): DashboardStats {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // 最新油耗
  const latestRecord = records.filter(r => r.calculatedConsumption !== null).pop();
  const latestConsumption = latestRecord?.calculatedConsumption ?? null;

  // 平均油耗
  const validRecords = records.filter(r => r.calculatedConsumption !== null);
  const avgConsumption = validRecords.length > 0
    ? validRecords.reduce((sum, r) => sum + r.calculatedConsumption!, 0) / validRecords.length
    : null;

  // 本月油费
  const monthlyRecords = records.filter(r => r.date.startsWith(currentMonth));
  const monthlyCost = monthlyRecords.reduce((sum, r) => sum + r.totalCost, 0);

  // 每公里成本（基于有效记录）
  const costPerKmRecords = records.filter(r => r.calculatedCostPerKm !== null);
  const costPerKm = costPerKmRecords.length > 0
    ? costPerKmRecords.reduce((sum, r) => sum + r.calculatedCostPerKm!, 0) / costPerKmRecords.length
    : null;

  // 总计
  const totalFuel = records.reduce((sum, r) => sum + r.fuelAmount, 0);
  const totalCost = records.reduce((sum, r) => sum + r.totalCost, 0);
  const totalMileage = records.length > 0
    ? records[records.length - 1].currentMileage - records[0].currentMileage
    : 0;

  return {
    latestConsumption,
    avgConsumption: avgConsumption ? Math.round(avgConsumption * 100) / 100 : null,
    monthlyCost: Math.round(monthlyCost * 100) / 100,
    costPerKm: costPerKm ? Math.round(costPerKm * 10000) / 10000 : null,
    totalMileage,
    totalFuel: Math.round(totalFuel * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    recordCount: records.length,
  };
}

/**
 * 计算月度统计
 */
export function calculateMonthlyStats(records: RefuelRecord[]): MonthlyStats[] {
  const monthMap = new Map<string, RefuelRecord[]>();

  records.forEach((r) => {
    const month = r.date.substring(0, 7); // 'YYYY-MM'
    if (!monthMap.has(month)) {
      monthMap.set(month, []);
    }
    monthMap.get(month)!.push(r);
  });

  const stats: MonthlyStats[] = [];

  monthMap.forEach((monthRecords, month) => {
    const sorted = monthRecords.sort((a, b) => a.date.localeCompare(b.date));
    const totalFuel = sorted.reduce((sum, r) => sum + r.fuelAmount, 0);
    const totalCost = sorted.reduce((sum, r) => sum + r.totalCost, 0);
    const totalMileage = sorted.length > 1
      ? sorted[sorted.length - 1].currentMileage - sorted[0].currentMileage
      : 0;

    const validRecords = sorted.filter(r => r.calculatedConsumption !== null);
    const avgConsumption = validRecords.length > 0
      ? validRecords.reduce((sum, r) => sum + r.calculatedConsumption!, 0) / validRecords.length
      : 0;

    stats.push({
      month,
      totalMileage,
      totalFuel: Math.round(totalFuel * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      avgConsumption: Math.round(avgConsumption * 100) / 100,
      costPerKm: totalMileage > 0 ? Math.round((totalCost / totalMileage) * 10000) / 10000 : 0,
      recordCount: sorted.length,
    });
  });

  return stats.sort((a, b) => a.month.localeCompare(b.month));
}
