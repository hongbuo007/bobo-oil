const express = require('express');
const { db, toCamel, toSnake } = require('../db');
const { authMiddleware } = require('../auth');

const router = express.Router();

// 所有路由需要认证
router.use(authMiddleware);

// 获取车辆列表
router.get('/', (req, res) => {
  const vehicles = db.prepare('SELECT * FROM vehicles ORDER BY created_at DESC').all();
  res.json(vehicles.map(toCamel));
});

// 添加车辆
router.post('/', (req, res) => {
  const now = new Date().toISOString();
  const vehicle = {
    id: crypto.randomUUID(),
    name: req.body.name || '',
    brand: req.body.brand || '',
    model: req.body.model || '',
    vehicleType: req.body.vehicleType || 'fuel',
    licensePlate: req.body.licensePlate || '',
    engineCapacity: req.body.engineCapacity || 0,
    transmission: req.body.transmission || 'AT',
    fuelType: req.body.fuelType || '92#',
    fuelTankCapacity: req.body.fuelTankCapacity || 50,
    purchaseDate: req.body.purchaseDate || '',
    currentMileage: req.body.currentMileage || 0,
    imageUrl: req.body.imageUrl || '',
    isActive: 1,
    createdAt: now,
    updatedAt: now,
  };

  const snake = toSnake(vehicle);
  const keys = Object.keys(snake);
  const placeholders = keys.map(() => '?').join(', ');
  const values = keys.map(k => snake[k]);

  db.prepare(`INSERT INTO vehicles (${keys.join(', ')}) VALUES (${placeholders})`).run(...values);
  res.json(toCamel({ ...snake, id: vehicle.id }));
});

// 更新车辆
router.put('/:id', (req, res) => {
  const now = new Date().toISOString();
  const fields = { ...req.body, updatedAt: now };
  delete fields.id;
  delete fields.createdAt;

  const snake = toSnake(fields);
  const setClauses = Object.keys(snake).map(k => `${k} = ?`).join(', ');
  const values = Object.keys(snake).map(k => snake[k]);

  db.prepare(`UPDATE vehicles SET ${setClauses} WHERE id = ?`).run(...values, req.params.id);
  const updated = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id);
  res.json(toCamel(updated));
});

// 删除车辆
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM refuel_records WHERE vehicle_id = ?').run(req.params.id);
  db.prepare('DELETE FROM vehicles WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

module.exports = router;
