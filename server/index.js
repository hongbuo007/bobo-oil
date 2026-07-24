const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const vehicleRoutes = require('./routes/vehicles');
const refuelRoutes = require('./routes/refuels');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/refuels', refuelRoutes);

// 静态文件（生产环境前端）
const distPath = path.join(__dirname, '..', 'dist');
if (require('fs').existsSync(distPath)) {
  app.use(express.static(distPath));

  // SPA fallback
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

app.listen(PORT, () => {
  console.log(`🚗 bobo油耗服务端已启动: http://localhost:${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api`);
  console.log(`   前端: http://localhost:${PORT}`);

  // 启动时自动重算所有油耗
  try {
    const { db } = require('./db');
    const vehicleIds = db.prepare('SELECT DISTINCT vehicle_id FROM refuel_records WHERE vehicle_id != ?').all('');
    let totalUpdated = 0;
    for (const { vehicle_id } of vehicleIds) {
      const records = db.prepare('SELECT * FROM refuel_records WHERE vehicle_id = ? ORDER BY date ASC').all(vehicle_id);
      const update = db.prepare('UPDATE refuel_records SET calculated_consumption=?, calculated_cost_per_km=?, algorithm_used=?, updated_at=? WHERE id=?');
      const now = new Date().toISOString();
      for (let i = 0; i < records.length; i++) {
        // 跳枪法计算
        const curr = records[i];
        if (curr.is_missed_previous) continue;
        const hist = records.slice(0, i);
        if (hist.length === 0) continue;

        let bestConsumption = null, bestCostPerKm = null, bestAlgo = null;

        if (curr.is_full_tank) {
          for (let j = hist.length - 1; j >= 0; j--) {
            if (hist[j].is_full_tank && !hist[j].is_missed_previous) {
              const diff = curr.current_mileage - hist[j].current_mileage;
              if (diff > 0) {
                if (j === hist.length - 1) {
                  bestConsumption = +(curr.fuel_amount / diff * 100).toFixed(2);
                  bestCostPerKm = +(curr.actual_cost / diff).toFixed(4);
                  bestAlgo = 1;
                } else {
                  const intervalFuel = hist.slice(j + 1).reduce((s, r) => s + r.fuel_amount, 0) + curr.fuel_amount;
                  const intervalCost = hist.slice(j + 1).reduce((s, r) => s + r.actual_cost, 0) + curr.actual_cost;
                  bestConsumption = +(intervalFuel / diff * 100).toFixed(2);
                  bestCostPerKm = +(intervalCost / diff).toFixed(4);
                  bestAlgo = 3;
                }
              }
              break;
            }
          }
        }

        if (!bestConsumption && curr.is_low_fuel_light) {
          for (let j = hist.length - 1; j >= 0; j--) {
            if (hist[j].is_low_fuel_light && !hist[j].is_missed_previous) {
              const diff = curr.current_mileage - hist[j].current_mileage;
              if (diff > 0) {
                if (j === hist.length - 1) {
                  const intervalCost = hist.slice(j).reduce((s, r) => s + r.actual_cost, 0);
                  bestConsumption = +(hist[j].fuel_amount / diff * 100).toFixed(2);
                  bestCostPerKm = +(intervalCost / diff).toFixed(4);
                  bestAlgo = 2;
                } else {
                  const intervalFuel = hist.slice(j).reduce((s, r) => s + r.fuel_amount, 0);
                  const intervalCost = hist.slice(j).reduce((s, r) => s + r.actual_cost, 0);
                  bestConsumption = +(intervalFuel / diff * 100).toFixed(2);
                  bestCostPerKm = +(intervalCost / diff).toFixed(4);
                  bestAlgo = 4;
                }
              }
              break;
            }
          }
        }

        update.run(bestConsumption, bestCostPerKm, bestAlgo, now, curr.id);
        if (bestConsumption !== null) totalUpdated++;
      }
    }
    console.log(`   ✅ 油耗重算完成: ${totalUpdated} 条记录`);
  } catch (e) {
    console.log('   ⚠️ 油耗重算跳过:', e.message);
  }
});
