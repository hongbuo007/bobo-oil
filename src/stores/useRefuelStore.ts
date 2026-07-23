import { create } from 'zustand';
import { db } from '@/db';
import { refuelsApi, checkServer } from '@/db/api';
import { generateUUID } from '@/utils/format';
import { calculateConsumption } from '@/services/refuelCalculator';
import type { RefuelRecord, RefuelFormData } from '@/models/refuel';

interface RefuelState {
  records: RefuelRecord[];
  loading: boolean;
  error: string | null;
  useServer: boolean;

  loadRecords: (vehicleId: string) => Promise<void>;
  addRecord: (data: RefuelFormData) => Promise<RefuelRecord>;
  updateRecord: (id: string, data: Partial<RefuelRecord>) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
}

export const useRefuelStore = create<RefuelState>((set, get) => ({
  records: [],
  loading: false,
  error: null,
  useServer: false,

  loadRecords: async (vehicleId: string) => {
    set({ loading: true, error: null });
    try {
      const serverOk = await checkServer();
      let records: RefuelRecord[];
      if (serverOk) {
        set({ useServer: true });
        records = await refuelsApi.list(vehicleId);
      } else {
        records = await db.refuelRecords.where('vehicleId').equals(vehicleId).sortBy('date');
      }
      set({ records, loading: false });
    } catch (err) {
      set({ error: '加载加油记录失败', loading: false });
      console.error(err);
    }
  },

  addRecord: async (data: RefuelFormData) => {
    if (get().useServer) {
      await refuelsApi.create(data);
    } else {
      const historyRecords = await db.refuelRecords.where('vehicleId').equals(data.vehicleId).sortBy('date');
      const result = calculateConsumption(data, historyRecords);
      const now = new Date().toISOString();
      const record: RefuelRecord = { ...data, id: generateUUID(), calculatedConsumption: result.consumption, calculatedCostPerKm: result.costPerKm, algorithmUsed: result.algorithm, createdAt: now, updatedAt: now };
      await db.refuelRecords.add(record);
      const vehicle = await db.vehicles.get(data.vehicleId);
      if (vehicle && data.currentMileage > vehicle.currentMileage) {
        await db.vehicles.update(data.vehicleId, { currentMileage: data.currentMileage, updatedAt: now });
      }
    }
    await get().loadRecords(data.vehicleId);
    return {} as RefuelRecord;
  },

  updateRecord: async (id: string, data: Partial<RefuelRecord>) => {
    if (get().useServer) {
      await refuelsApi.update(id, data);
    } else {
      await db.refuelRecords.update(id, { ...data, updatedAt: new Date().toISOString() });
    }
    const record = get().records.find(r => r.id === id);
    if (record) await get().loadRecords(record.vehicleId);
  },

  deleteRecord: async (id: string) => {
    const record = get().records.find(r => r.id === id);
    if (get().useServer) {
      await refuelsApi.remove(id);
    } else {
      await db.refuelRecords.delete(id);
    }
    if (record) await get().loadRecords(record.vehicleId);
  },
}));
