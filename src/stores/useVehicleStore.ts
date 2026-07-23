import { create } from 'zustand';
import { db } from '@/db';
import { generateUUID } from '@/utils/format';
import type { Vehicle, VehicleFormData } from '@/models/vehicle';

interface VehicleState {
  vehicles: Vehicle[];
  currentVehicleId: string | null;
  loading: boolean;
  error: string | null;

  // Actions
  loadVehicles: () => Promise<void>;
  addVehicle: (data: VehicleFormData) => Promise<Vehicle>;
  updateVehicle: (id: string, data: Partial<Vehicle>) => Promise<void>;
  deleteVehicle: (id: string) => Promise<void>;
  setCurrentVehicle: (id: string | null) => void;
  getCurrentVehicle: () => Vehicle | undefined;
}

export const useVehicleStore = create<VehicleState>((set, get) => ({
  vehicles: [],
  currentVehicleId: null,
  loading: false,
  error: null,

  loadVehicles: async () => {
    set({ loading: true, error: null });
    try {
      const vehicles = await db.vehicles.orderBy('createdAt').reverse().toArray();
      const currentId = get().currentVehicleId;
      // 如果当前没有选中车辆且有车辆列表，自动选中第一辆
      if (!currentId && vehicles.length > 0) {
        set({ vehicles, currentVehicleId: vehicles[0].id, loading: false });
      } else {
        set({ vehicles, loading: false });
      }
    } catch (err) {
      set({ error: '加载车辆列表失败', loading: false });
      console.error(err);
    }
  },

  addVehicle: async (data: VehicleFormData) => {
    const now = new Date().toISOString();
    const vehicle: Vehicle = {
      ...data,
      id: generateUUID(),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    await db.vehicles.add(vehicle);
    const vehicles = await db.vehicles.orderBy('createdAt').reverse().toArray();
    set({ vehicles, currentVehicleId: vehicle.id });
    return vehicle;
  },

  updateVehicle: async (id: string, data: Partial<Vehicle>) => {
    const now = new Date().toISOString();
    await db.vehicles.update(id, { ...data, updatedAt: now });
    const vehicles = await db.vehicles.orderBy('createdAt').reverse().toArray();
    set({ vehicles });
  },

  deleteVehicle: async (id: string) => {
    await db.vehicles.delete(id);
    // 同时删除该车辆的所有加油记录
    await db.refuelRecords.where('vehicleId').equals(id).delete();
    const vehicles = await db.vehicles.orderBy('createdAt').reverse().toArray();
    const currentId = get().currentVehicleId;
    const newCurrentId = currentId === id ? (vehicles[0]?.id ?? null) : currentId;
    set({ vehicles, currentVehicleId: newCurrentId });
  },

  setCurrentVehicle: (id: string | null) => {
    set({ currentVehicleId: id });
  },

  getCurrentVehicle: () => {
    const { vehicles, currentVehicleId } = get();
    return vehicles.find((v) => v.id === currentVehicleId);
  },
}));
