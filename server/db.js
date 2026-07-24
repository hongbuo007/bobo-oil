const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'bobo-oil.db');

// 确保 data 目录存在
const fs = require('fs');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// 启用 WAL 模式提升并发性能
db.pragma('journal_mode = WAL');

// 创建表
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT 'default',
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    brand TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    vehicle_type TEXT NOT NULL DEFAULT 'fuel',
    license_plate TEXT NOT NULL DEFAULT '',
    engine_capacity REAL NOT NULL DEFAULT 0,
    transmission TEXT NOT NULL DEFAULT 'AT',
    fuel_type TEXT NOT NULL DEFAULT '92#',
    fuel_tank_capacity REAL NOT NULL DEFAULT 50,
    purchase_date TEXT NOT NULL DEFAULT '',
    current_mileage REAL NOT NULL DEFAULT 0,
    image_url TEXT DEFAULT '',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS refuel_records (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    date TEXT NOT NULL,
    current_mileage REAL NOT NULL DEFAULT 0,
    fuel_amount REAL NOT NULL DEFAULT 0,
    unit_price REAL NOT NULL DEFAULT 0,
    total_cost REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    actual_cost REAL NOT NULL DEFAULT 0,
    fuel_type TEXT NOT NULL DEFAULT '92#',
    station_name TEXT NOT NULL DEFAULT '',
    is_full_tank INTEGER NOT NULL DEFAULT 0,
    is_low_fuel_light INTEGER NOT NULL DEFAULT 0,
    is_missed_previous INTEGER NOT NULL DEFAULT 0,
    calculated_consumption REAL,
    calculated_cost_per_km REAL,
    algorithm_used INTEGER,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_refuel_vehicle ON refuel_records(vehicle_id, date);
`);

// 迁移：给旧表添加 discount 和 actual_cost 列
try {
  db.exec(`ALTER TABLE refuel_records ADD COLUMN discount REAL NOT NULL DEFAULT 0`);
} catch {}
try {
  db.exec(`ALTER TABLE refuel_records ADD COLUMN actual_cost REAL NOT NULL DEFAULT 0`);
} catch {}
// 初始化旧数据的 actual_cost = total_cost
db.exec(`UPDATE refuel_records SET actual_cost = total_cost WHERE actual_cost = 0 AND total_cost > 0`);

// snake_case DB row → camelCase JS object
function toCamel(row) {
  if (!row) return row;
  const result = {};
  for (const key of Object.keys(row)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camel] = row[key];
  }
  return result;
}

// camelCase JS object → snake_case DB row
function toSnake(obj) {
  const result = {};
  for (const key of Object.keys(obj)) {
    const snake = key.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
    result[snake] = obj[key];
  }
  return result;
}

module.exports = { db, toCamel, toSnake };
