import type { FuelType } from './vehicle';

export interface RefuelRecord {
  id: string;
  vehicleId: string;
  date: string;                 // ISO 8601
  currentMileage: number;       // 加油时总里程(km)
  fuelAmount: number;           // 加油量(L)
  unitPrice: number;            // 单价(元/L)
  totalCost: number;            // 总金额(元)
  fuelType: FuelType;           // 油品类型
  stationName: string;          // 加油站名称
  isFullTank: boolean;          // 是否加满（跳枪）
  isLowFuelLight: boolean;      // 加油前油灯是否亮起
  isMissedPrevious: boolean;    // 是否漏记上次加油
  calculatedConsumption: number | null;   // 油耗(L/100km)
  calculatedCostPerKm: number | null;     // 每公里油费(元/km)
  algorithmUsed: number | null;           // 算法编号
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConsumptionResult {
  consumption: number | null;     // L/100km
  costPerKm: number | null;       // 元/km
  algorithm: number | null;       // 1-4
}

export type RefuelFormData = Omit<RefuelRecord, 'id' | 'calculatedConsumption' | 'calculatedCostPerKm' | 'algorithmUsed' | 'createdAt' | 'updatedAt'>;
