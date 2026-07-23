import { create } from 'zustand';
import { db } from '@/db';
import { vehiclesApi, checkServer } from '@/db/api';
import { generateUUID } from '@/utils/format';
import type { Vehicle, VehicleFormData } from '@/models/vehicle';

interface VehicleState {
  vehicles: Vehicle[];
  currentVehicleId: string | null;
  loading: boolean;
  error: string | null;
  useServer: boolean;

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
  useServer: false,

  loadVehicles: async () => {
    set({ loading: true, error: null });
    try {
      const serverOk = await checkServer();
      let vehicles: Vehicle[];
      if (serverOk) {
        set({ useServer: true });
        vehicles = await vehiclesApi.list();
      } else {
        vehicles = await db.vehicles.orderBy('createdAt').reverse().toArray();
      }
      const currentId = get().currentVehicleId || vehicles[0]?.id || null;
      set({ vehicles, currentVehicleId: currentId, loading: false });
    } catch (err) {
      set({ error: '加载车辆列表失败', loading: false });
      console.error(err);
    }
  },

  addVehicle: async (data: VehicleFormData) => {
    const now = new Date().toISOString();
    const vehicle: Vehicle = { ...data, id: generateUUID(), isActive: true, createdAt: now, updatedAt: now };
    if (get().useServer) {
      await vehiclesApi.create(vehicle);
    } else {
      await db.vehicles.add(vehicle);
    }
    await get().loadVehicles();
    set({ currentVehicleId: vehicle.id });
    return vehicle;
  },

  updateVehicle: async (id: string, data: Partial<Vehicle>) => {
    if (get().useServer) {
      await vehiclesApi.update(id, data);
    } else {
      await db.vehicles.update(id, { ...data, updatedAt: new Date().toISOString() });
    }
    await get().loadVehicles();
  },

  deleteVehicle: async (id: string) => {
    if (get().useServer) {
      await vehiclesApi.remove(id);
    } else {
      await db.vehicles.delete(id);
      await db.refuelRecords.where('vehicleId').equals(id).delete();
    }
    await get().loadVehicles();
    const vehicles = get().vehicles;
    const currentId = get().currentVehicleId === id ? (vehicles[0]?.id ?? null) : get().currentVehicleId;
    set({ currentVehicleId: currentId });
  },

  setCurrentVehicle: (id: string | null) => set({ currentVehicleId: id }),

  getCurrentVehicle: () => {
    const { vehicles, currentVehicleId } = get();
    return vehicles.find(v => v.id === currentVehicleId);
  },
}));
