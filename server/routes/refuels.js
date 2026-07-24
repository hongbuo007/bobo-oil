const express = require('express');
const { db, toCamel, toSnake } = require('../db');
const { authMiddleware } = require('../auth');

const router = express.Router();

router.use(authMiddleware);

// 跳枪法油耗计算（同前端逻辑）
function calculateConsumption(current, history) {
  if (current.isMissedPrevious || current.is_missed_previous) {
    return { consumption: null, costPerKm: null, algorithm: null };
  }
  if (history.length === 0) return { consumption: null, costPerKm: null, algorithm: null };

  const last = history[history.length - 1];
  if (current.currentMileage <= last.currentMileage) {
    return { consumption: null, costPerKm: null, algorithm: null };
  }

  const candidates = [];
  const full = current.isFullTank || current.is_full_tank;
  const light = current.isLowFuelLight || current.is_low_fuel_light;

  if (full) {
    for (let j = history.length - 1; j >= 0; j--) {
      const hFull = history[j].isFullTank || history[j].is_full_tank;
      const hMiss = history[j].isMissedPrevious || history[j].is_missed_previous;
      if (hFull && !hMiss) {
        const diff = current.currentMileage - history[j].currentMileage;
        if (diff <= 0) break;
        if (j === history.length - 1) {
          candidates.push({
            consumption: +(current.fuelAmount / diff * 100).toFixed(2),
            costPerKm: +(current.totalCost / diff).toFixed(4),
            algorithm: 1, priority: 1, span: 1,
          });
        } else {
          const intervalFuel = history.slice(j + 1).reduce((s, r) => s + r.fuelAmount, 0) + current.fuelAmount;
          const intervalCost = history.slice(j + 1).reduce((s, r) => s + r.totalCost, 0) + current.totalCost;
          candidates.push({
            consumption: +(intervalFuel / diff * 100).toFixed(2),
            costPerKm: +(intervalCost / diff).toFixed(4),
            algorithm: 3, priority: 3, span: history.length - j,
          });
        }
        break;
      }
    }
  }

  if (light) {
    for (let j = history.length - 1; j >= 0; j--) {
      const hLight = history[j].isLowFuelLight || history[j].is_low_fuel_light;
      const hMiss = history[j].isMissedPrevious || history[j].is_missed_previous;
      if (hLight && !hMiss) {
        const diff = current.currentMileage - history[j].currentMileage;
        if (diff <= 0) break;
        if (j === history.length - 1) {
          const intervalCost = history.slice(j).reduce((s, r) => s + r.totalCost, 0);
          candidates.push({
            consumption: +(history[j].fuelAmount / diff * 100).toFixed(2),
            costPerKm: +(intervalCost / diff).toFixed(4),
            algorithm: 2, priority: 2, span: 1,
          });
        } else {
          const intervalFuel = history.slice(j).reduce((s, r) => s + r.fuelAmount, 0);
          const intervalCost = history.slice(j).reduce((s, r) => s + r.totalCost, 0);
          candidates.push({
            consumption: +(intervalFuel / diff * 100).toFixed(2),
            costPerKm: +(intervalCost / diff).toFixed(4),
            algorithm: 4, priority: 4, span: history.length - j,
          });
        }
        break;
      }
    }
  }

  candidates.sort((a, b) => a.priority !== b.priority ? a.priority - b.priority : a.span - b.span);
  return candidates.length > 0 ? candidates[0] : { consumption: null, costPerKm: null, algorithm: null };
}

// 获取加油记录
router.get('/', (req, res) => {
  const { vehicleId } = req.query;
  let records;
  if (vehicleId) {
    records = db.prepare('SELECT * FROM refuel_records WHERE vehicle_id = ? ORDER BY date ASC').all(vehicleId);
  } else {
    records = db.prepare('SELECT * FROM refuel_records ORDER BY date ASC').all();
  }
  res.json(records.map(toCamel));
});

// 添加加油记录
router.post('/', (req, res) => {
  const now = new Date().toISOString();
  const record = {
    id: crypto.randomUUID(),
    vehicleId: req.body.vehicleId || '',
    date: req.body.date || '',
    currentMileage: req.body.currentMileage || 0,
    fuelAmount: req.body.fuelAmount || 0,
    unitPrice: req.body.unitPrice || 0,
    totalCost: req.body.totalCost || 0,
    discount: req.body.discount || 0,
    actualCost: req.body.actualCost || (req.body.totalCost || 0) - (req.body.discount || 0),
    fuelType: req.body.fuelType || '92#',
    stationName: req.body.stationName || '',
    isFullTank: req.body.isFullTank ? 1 : 0,
    isLowFuelLight: req.body.isLowFuelLight ? 1 : 0,
    isMissedPrevious: req.body.isMissedPrevious ? 1 : 0,
    calculatedConsumption: null,
    calculatedCostPerKm: null,
    algorithmUsed: null,
    note: req.body.note || '',
    createdAt: now,
    updatedAt: now,
  };

  // 获取历史记录计算油耗
  const history = db.prepare('SELECT * FROM refuel_records WHERE vehicle_id = ? ORDER BY date ASC').all(record.vehicleId);
  const result = calculateConsumption(record, history);
  record.calculatedConsumption = result.consumption;
  record.calculatedCostPerKm = result.costPerKm;
  record.algorithmUsed = result.algorithm;

  const snake = toSnake(record);
  const keys = Object.keys(snake);
  const placeholders = keys.map(() => '?').join(', ');
  const values = keys.map(k => snake[k]);
  db.prepare(`INSERT INTO refuel_records (${keys.join(', ')}) VALUES (${placeholders})`).run(...values);

  // 更新车辆里程
  if (record.vehicleId && record.currentMileage > 0) {
    const vehicle = db.prepare('SELECT current_mileage FROM vehicles WHERE id = ?').get(record.vehicleId);
    if (vehicle && record.currentMileage > vehicle.current_mileage) {
      db.prepare('UPDATE vehicles SET current_mileage = ?, updated_at = ? WHERE id = ?')
        .run(record.currentMileage, now, record.vehicleId);
    }
  }

  res.json(toCamel({ ...snake, id: record.id }));
});

// 批量导入（带重算）
router.post('/import', (req, res) => {
  const { records } = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: '无效的数据' });
  }

  const now = new Date().toISOString();
  let imported = 0;

  // 如果没有指定 vehicleId，创建默认车辆
  let defaultVehicleId = records[0]?.vehicleId || '';
  if (!defaultVehicleId) {
    const existingVehicle = db.prepare('SELECT id FROM vehicles WHERE is_active = 1 LIMIT 1').get();
    if (existingVehicle) {
      defaultVehicleId = existingVehicle.id;
    } else {
      defaultVehicleId = crypto.randomUUID();
      db.prepare(`INSERT INTO vehicles (id, name, brand, model, vehicle_type, license_plate, engine_capacity, transmission, fuel_type, fuel_tank_capacity, purchase_date, current_mileage, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(defaultVehicleId, '我的车', '', '', 'fuel', '', 0, 'AT', '92#', 50, '', 0, 1, now, now);
    }
  }

  const insert = db.prepare(`INSERT OR IGNORE INTO refuel_records
    (id, vehicle_id, date, current_mileage, fuel_amount, unit_price, total_cost, discount, actual_cost, fuel_type, station_name,
     is_full_tank, is_low_fuel_light, is_missed_previous, calculated_consumption, calculated_cost_per_km,
     algorithm_used, note, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const transaction = db.transaction(() => {
    for (const r of records) {
      const discount = r.discount || 0;
      const actualCost = r.actualCost || ((r.totalCost || 0) - discount);
      const row = toSnake({
        id: r.id || crypto.randomUUID(),
        vehicleId: r.vehicleId || defaultVehicleId,
        date: r.date || '',
        currentMileage: r.currentMileage || 0,
        fuelAmount: r.fuelAmount || 0,
        unitPrice: r.unitPrice || 0,
        totalCost: r.totalCost || 0,
        discount,
        actualCost,
        fuelType: r.fuelType || '92#',
        stationName: r.stationName || '',
        isFullTank: r.isFullTank ? 1 : 0,
        isLowFuelLight: r.isLowFuelLight ? 1 : 0,
        isMissedPrevious: r.isMissedPrevious ? 1 : 0,
        calculatedConsumption: r.calculatedConsumption ?? null,
        calculatedCostPerKm: r.calculatedCostPerKm ?? null,
        algorithmUsed: r.algorithmUsed ?? null,
        note: r.note || '',
        createdAt: now,
        updatedAt: now,
      });
      const keys = ['id', 'vehicle_id', 'date', 'current_mileage', 'fuel_amount', 'unit_price', 'total_cost', 'discount', 'actual_cost', 'fuel_type', 'station_name',
        'is_full_tank', 'is_low_fuel_light', 'is_missed_previous', 'calculated_consumption', 'calculated_cost_per_km',
        'algorithm_used', 'note', 'created_at', 'updated_at'];
      const values = keys.map(k => row[k] !== undefined ? row[k] : null);
      const info = insert.run(...values);
      if (info.changes > 0) imported++;
    }

    // 重算油耗（对所有有 vehicleId 或全部记录）
    const vehicleIds = [...new Set(records.map(r => r.vehicleId).filter(Boolean))];
    // 如果没有指定 vehicleId，获取所有不同的 vehicle_id
    if (vehicleIds.length === 0) {
      const allVids = db.prepare('SELECT DISTINCT vehicle_id FROM refuel_records WHERE vehicle_id != ?').all('');
      allVids.forEach(row => { if (row.vehicle_id) vehicleIds.push(row.vehicle_id); });
    }
    for (const vid of vehicleIds) {
      const all = db.prepare('SELECT * FROM refuel_records WHERE vehicle_id = ? ORDER BY date ASC').all(vid);
      const update = db.prepare(`UPDATE refuel_records SET calculated_consumption=?, calculated_cost_per_km=?, algorithm_used=?, updated_at=? WHERE id=?`);
      for (let i = 0; i < all.length; i++) {
        const hist = all.slice(0, i);
        const r = calculateConsumption(all[i], hist);
        update.run(r.consumption, r.costPerKm, r.algorithm, now, all[i].id);
      }
    }
  });

  transaction();
  res.json({ imported, total: records.length });
});

// 更新记录
router.put('/:id', (req, res) => {
  const now = new Date().toISOString();
  const fields = { ...req.body, updatedAt: now };
  delete fields.id;
  delete fields.createdAt;
  delete fields.vehicleId;

  const snake = toSnake(fields);
  const setClauses = Object.keys(snake).map(k => `${k} = ?`).join(', ');
  const values = Object.keys(snake).map(k => snake[k]);
  db.prepare(`UPDATE refuel_records SET ${setClauses} WHERE id = ?`).run(...values, req.params.id);

  const updated = db.prepare('SELECT * FROM refuel_records WHERE id = ?').get(req.params.id);
  res.json(toCamel(updated));
});

// 删除记录
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM refuel_records WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

module.exports = router;
