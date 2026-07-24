import type { FuelType } from './vehicle';

export interface RefuelRecord {
  id: string;
  vehicleId: string;
  date: string;
  currentMileage: number;
  fuelAmount: number;
  unitPrice: number;
  totalCost: number;            // 机显金额(元)
  discount: number;             // 优惠金额(元)
  actualCost: number;           // 实付金额(元) = totalCost - discount
  fuelType: FuelType;
  stationName: string;
  isFullTank: boolean;
  isLowFuelLight: boolean;
  isMissedPrevious: boolean;
  calculatedConsumption: number | null;
  calculatedCostPerKm: number | null;   // 基于实付金额计算
  algorithmUsed: number | null;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConsumptionResult {
  consumption: number | null;
  costPerKm: number | null;
  algorithm: number | null;
}

export type RefuelFormData = Omit<RefuelRecord, 'id' | 'calculatedConsumption' | 'calculatedCostPerKm' | 'algorithmUsed' | 'createdAt' | 'updatedAt'>;
