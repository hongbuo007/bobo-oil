import Dexie, { type Table } from 'dexie';
import type { Vehicle } from '@/models/vehicle';
import type { RefuelRecord } from '@/models/refuel';
import type { User } from '@/models/auth';

export class BoboOilDB extends Dexie {
  vehicles!: Table<Vehicle, string>;
  refuelRecords!: Table<RefuelRecord, string>;
  settings!: Table<{ id: string; key: string; value: string }, string>;
  users!: Table<User, string>;

  constructor() {
    super('BoboOilDB');

    this.version(1).stores({
      vehicles: 'id, isActive, brand, model, createdAt',
      refuelRecords: 'id, vehicleId, date, currentMileage, [vehicleId+date]',
      settings: 'id, key',
    });

    this.version(2).stores({
      vehicles: 'id, isActive, brand, model, createdAt',
      refuelRecords: 'id, vehicleId, date, currentMileage, [vehicleId+date]',
      settings: 'id, key',
      users: 'id',
    });
  }
}

export const db = new BoboOilDB();
