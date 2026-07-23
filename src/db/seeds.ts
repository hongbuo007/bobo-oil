import { db } from './index';
import { generateUUID } from '@/utils/format';
import type { Vehicle } from '@/models/vehicle';
import type { RefuelRecord } from '@/models/refuel';

/**
 * 插入演示数据（仅在数据库为空时执行）
 */
export async function seedDemoData() {
  const vehicleCount = await db.vehicles.count();
  if (vehicleCount > 0) return; // 已有数据，跳过

  const now = new Date().toISOString();

  // 演示车辆
  const demoVehicle: Vehicle = {
    id: 'demo-vehicle-001',
    name: '小白',
    brand: '丰田',
    model: '卡罗拉 2023款 1.2T',
    vehicleType: 'fuel',
    licensePlate: '京A·12345',
    engineCapacity: 1.2,
    transmission: 'CVT',
    fuelType: '92#',
    fuelTankCapacity: 50,
    purchaseDate: '2023-06-15',
    currentMileage: 25680,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  await db.vehicles.add(demoVehicle);

  // 演示加油记录（最近6个月，约20条记录）
  const demoRecords: RefuelRecord[] = [];
  const baseDate = new Date('2026-01-15');
  const baseMileage = 18000;

  // 模拟数据：日期、里程、加油量、单价、跳枪/亮灯
  const mockData = [
    { d: 0, km: 18000, amt: 42.5, price: 7.85, full: true, light: false, miss: false },
    { d: 12, km: 18520, amt: 40.2, price: 7.82, full: true, light: false, miss: false },
    { d: 28, km: 19080, amt: 43.1, price: 7.90, full: true, light: false, miss: false },
    { d: 42, km: 19630, amt: 38.5, price: 7.88, full: false, light: true, miss: false },
    { d: 55, km: 20100, amt: 44.0, price: 7.95, full: true, light: false, miss: false },
    { d: 70, km: 20650, amt: 41.8, price: 7.92, full: true, light: false, miss: false },
    { d: 82, km: 21120, amt: 39.5, price: 7.86, full: false, light: true, miss: false },
    { d: 95, km: 21600, amt: 43.5, price: 8.05, full: true, light: false, miss: false },
    { d: 110, km: 22150, amt: 42.0, price: 8.02, full: true, light: false, miss: false },
    { d: 122, km: 22630, amt: 40.8, price: 7.98, full: false, light: false, miss: false },
    { d: 135, km: 23100, amt: 44.5, price: 8.10, full: true, light: false, miss: false },
    { d: 148, km: 23620, amt: 41.2, price: 8.08, full: true, light: false, miss: false },
    { d: 158, km: 24080, amt: 38.8, price: 7.96, full: false, light: true, miss: false },
    { d: 170, km: 24550, amt: 43.8, price: 8.12, full: true, light: false, miss: false },
    { d: 185, km: 25080, amt: 42.3, price: 8.15, full: true, light: false, miss: false },
    { d: 196, km: 25680, amt: 44.2, price: 8.18, full: true, light: false, miss: false },
  ];

  for (const item of mockData) {
    const recordDate = new Date(baseDate);
    recordDate.setDate(recordDate.getDate() + item.d);
    const dateStr = recordDate.toISOString().split('T')[0];

    demoRecords.push({
      id: generateUUID(),
      vehicleId: demoVehicle.id,
      date: dateStr,
      currentMileage: item.km,
      fuelAmount: item.amt,
      unitPrice: item.price,
      totalCost: Math.round(item.amt * item.price * 100) / 100,
      fuelType: '92#',
      stationName: ['中石化北苑加油站', '中石油望京加油站', '壳牌四惠加油站'][Math.floor(Math.random() * 3)],
      isFullTank: item.full,
      isLowFuelLight: item.light,
      isMissedPrevious: item.miss,
      calculatedConsumption: null,
      calculatedCostPerKm: null,
      algorithmUsed: null,
      note: '',
      createdAt: now,
      updatedAt: now,
    });
  }

  // 手动计算每条记录的油耗
  for (let i = 1; i < demoRecords.length; i++) {
    const curr = demoRecords[i];
    const history = demoRecords.slice(0, i);

    if (curr.isMissedPrevious) continue;

    // 算法1：连续跳枪
    if (curr.isFullTank) {
      for (let j = history.length - 1; j >= 0; j--) {
        if (history[j].isFullTank && !history[j].isMissedPrevious) {
          const mileageDiff = curr.currentMileage - history[j].currentMileage;
          if (mileageDiff > 0) {
            if (j === history.length - 1) {
              // 算法1
              curr.calculatedConsumption = Math.round((curr.fuelAmount / mileageDiff) * 10000) / 100;
              curr.calculatedCostPerKm = Math.round((curr.totalCost / mileageDiff) * 10000) / 10000;
              curr.algorithmUsed = 1;
            } else {
              // 算法3
              const intervalFuel = history.slice(j + 1).reduce((s, r) => s + r.fuelAmount, 0) + curr.fuelAmount;
              const intervalCost = history.slice(j + 1).reduce((s, r) => s + r.totalCost, 0) + curr.totalCost;
              curr.calculatedConsumption = Math.round((intervalFuel / mileageDiff) * 10000) / 100;
              curr.calculatedCostPerKm = Math.round((intervalCost / mileageDiff) * 10000) / 10000;
              curr.algorithmUsed = 3;
            }
          }
          break;
        }
      }
    }

    // 如果跳枪法没算出且亮灯，尝试亮灯法
    if (curr.calculatedConsumption === null && curr.isLowFuelLight) {
      for (let j = history.length - 1; j >= 0; j--) {
        if (history[j].isLowFuelLight && !history[j].isMissedPrevious) {
          const mileageDiff = curr.currentMileage - history[j].currentMileage;
          if (mileageDiff > 0) {
            if (j === history.length - 1) {
              curr.calculatedConsumption = Math.round((history[j].fuelAmount / mileageDiff) * 10000) / 100;
              curr.algorithmUsed = 2;
            } else {
              const intervalFuel = history.slice(j).reduce((s, r) => s + r.fuelAmount, 0);
              const intervalCost = history.slice(j).reduce((s, r) => s + r.totalCost, 0);
              curr.calculatedConsumption = Math.round((intervalFuel / mileageDiff) * 10000) / 100;
              curr.calculatedCostPerKm = Math.round((intervalCost / mileageDiff) * 10000) / 10000;
              curr.algorithmUsed = 4;
            }
          }
          break;
        }
      }
    }
  }

  await db.refuelRecords.bulkAdd(demoRecords);
  console.log('✅ 演示数据已加载：1辆车 + ' + demoRecords.length + '条加油记录');
}
