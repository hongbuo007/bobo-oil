import { create } from 'zustand';
import { db } from '@/db';
import type { RefuelRecord, RefuelFormData } from '@/models/refuel';
import { calculateConsumption } from '@/services/refuelCalculator';

interface RefuelState {
  records: RefuelRecord[];
  loading: boolean;
  error: string | null;

  // Actions
  loadRecords: (vehicleId: string) => Promise<void>;
  addRecord: (data: RefuelFormData) => Promise<RefuelRecord>;
  updateRecord: (id: string, data: Partial<RefuelRecord>) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  getRecordsByVehicle: (vehicleId: string) => RefuelRecord[];
}

export const useRefuelStore = create<RefuelState>((set, get) => ({
  records: [],
  loading: false,
  error: null,

  loadRecords: async (vehicleId: string) => {
    set({ loading: true, error: null });
    try {
      const records = await db.refuelRecords
        .where('vehicleId')
        .equals(vehicleId)
        .sortBy('date');
      set({ records, loading: false });
    } catch (err) {
      set({ error: '加载加油记录失败', loading: false });
      console.error(err);
    }
  },

  addRecord: async (data: RefuelFormData) => {
    // 获取历史记录用于计算油耗
    const historyRecords = await db.refuelRecords
      .where('vehicleId')
      .equals(data.vehicleId)
      .sortBy('date');

    // 计算油耗
    const result = calculateConsumption(data, historyRecords);

    const now = new Date().toISOString();
    const record: RefuelRecord = {
      ...data,
      id: crypto.randomUUID(),
      calculatedConsumption: result.consumption,
      calculatedCostPerKm: result.costPerKm,
      algorithmUsed: result.algorithm,
      createdAt: now,
      updatedAt: now,
    };

    await db.refuelRecords.add(record);

    // 更新车辆当前里程
    const vehicle = await db.vehicles.get(data.vehicleId);
    if (vehicle && data.currentMileage > vehicle.currentMileage) {
      await db.vehicles.update(data.vehicleId, {
        currentMileage: data.currentMileage,
        updatedAt: now,
      });
    }

    // 重新加载记录（新记录可能导致之前的记录需要重新计算）
    // 简化处理：只重新加载当前车辆的记录
    const updatedRecords = await db.refuelRecords
      .where('vehicleId')
      .equals(data.vehicleId)
      .sortBy('date');

    set({ records: updatedRecords });
    return record;
  },

  updateRecord: async (id: string, data: Partial<RefuelRecord>) => {
    const now = new Date().toISOString();
    await db.refuelRecords.update(id, { ...data, updatedAt: now });

    // 重新加载记录
    const record = await db.refuelRecords.get(id);
    if (record) {
      const updatedRecords = await db.refuelRecords
        .where('vehicleId')
        .equals(record.vehicleId)
        .sortBy('date');
      set({ records: updatedRecords });
    }
  },

  deleteRecord: async (id: string) => {
    const record = await db.refuelRecords.get(id);
    if (!record) return;

    await db.refuelRecords.delete(id);

    const updatedRecords = await db.refuelRecords
      .where('vehicleId')
      .equals(record.vehicleId)
      .sortBy('date');
    set({ records: updatedRecords });
  },

  getRecordsByVehicle: (vehicleId: string) => {
    return get().records.filter((r) => r.vehicleId === vehicleId);
  },
}));
