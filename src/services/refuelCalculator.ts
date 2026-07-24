import type { RefuelRecord, RefuelFormData, ConsumptionResult } from '@/models/refuel';

/**
 * 跳枪法油耗计算引擎
 *
 * 四种算法：
 * 算法1（两次跳枪）：当前跳枪 + 上次也跳枪 + 无漏记
 *   → 油耗 = 本次加油量 / (本次里程 - 上次跳枪里程) * 100
 *
 * 算法2（两次亮灯）：当前亮灯 + 上次也亮灯 + 无漏记
 *   → 油耗 = 上次加油量 / (本次里程 - 上次亮灯里程) * 100
 *
 * 算法3（两点跳枪，跨记录）：当前跳枪 + 历史有跳枪
 *   → 油耗 = 区间总加油量(不含上次跳枪) / 里程差 * 100
 *
 * 算法4（两点亮灯，跨记录）：当前亮灯 + 历史有亮灯
 *   → 油耗 = 区间总加油量(含上次亮灯) / 里程差 * 100
 */

/**
 * 计算单次加油记录的油耗
 * @param currentRecord 当前加油记录（表单数据）
 * @param historyRecords 历史加油记录（按日期升序排列，不含当前记录）
 * @returns 计算结果
 */
export function calculateConsumption(
  currentRecord: RefuelFormData | RefuelRecord,
  historyRecords: RefuelRecord[]
): ConsumptionResult {
  // 漏记上次加油 → 无法计算
  if (currentRecord.isMissedPrevious) {
    return { consumption: null, costPerKm: null, algorithm: null };
  }

  // 没有历史记录 → 无法计算
  if (historyRecords.length === 0) {
    return { consumption: null, costPerKm: null, algorithm: null };
  }

  // 里程倒挂检查
  const lastRecord = historyRecords[historyRecords.length - 1];
  if (currentRecord.currentMileage <= lastRecord.currentMileage) {
    return { consumption: null, costPerKm: null, algorithm: null };
  }

  const result = findBestAlgorithm(currentRecord, historyRecords);

  return result;
}

// 获取实付金额（兼容旧数据）
function getActualCost(r: RefuelRecord | RefuelFormData): number {
  if ('actualCost' in r && r.actualCost !== undefined && r.actualCost !== null) {
    return r.actualCost;
  }
  // 兼容旧数据：actualCost = totalCost - discount
  if ('discount' in r && r.discount !== undefined && r.discount !== null) {
    return r.totalCost - (r as any).discount;
  }
  return r.totalCost;
}

function findBestAlgorithm(
  current: RefuelFormData | RefuelRecord,
  history: RefuelRecord[]
): ConsumptionResult {
  const candidates: { result: ConsumptionResult; span: number; priority: number }[] = [];

  // 尝试算法1：两次跳枪
  if (current.isFullTank) {
    const lastFullTankIdx = findLastIndex(history, (r) => r.isFullTank && !r.isMissedPrevious);
    if (lastFullTankIdx >= 0) {
      const lastFullTank = history[lastFullTankIdx];
      const span = history.length - lastFullTankIdx;
      if (span === 1) {
        // 算法1：连续两次跳枪
        const mileageDiff = current.currentMileage - lastFullTank.currentMileage;
        if (mileageDiff > 0) {
          const consumption = (current.fuelAmount / mileageDiff) * 100;
          const costPerKm = getActualCost(current) / mileageDiff;
          candidates.push({
            result: { consumption: round(consumption), costPerKm: round(costPerKm), algorithm: 1 },
            span: 1,
            priority: 1, // 最高优先级
          });
        }
      } else {
        // 算法3：两点跳枪（跨记录）
        const mileageDiff = current.currentMileage - lastFullTank.currentMileage;
        if (mileageDiff > 0) {
          // 区间总加油量 = 上次跳枪之后的所有加油量之和（不含上次跳枪）+ 本次加油量
          const intervalFuel = history
            .slice(lastFullTankIdx + 1)
            .reduce((sum, r) => sum + r.fuelAmount, 0) + current.fuelAmount;
          const intervalCost = history
            .slice(lastFullTankIdx + 1)
            .reduce((sum, r) => sum + getActualCost(r), 0) + getActualCost(current);
          const consumption = (intervalFuel / mileageDiff) * 100;
          const costPerKm = intervalCost / mileageDiff;
          candidates.push({
            result: { consumption: round(consumption), costPerKm: round(costPerKm), algorithm: 3 },
            span,
            priority: 3,
          });
        }
      }
    }
  }

  // 尝试算法2：两次亮灯
  if (current.isLowFuelLight) {
    const lastLightIdx = findLastIndex(history, (r) => r.isLowFuelLight && !r.isMissedPrevious);
    if (lastLightIdx >= 0) {
      const lastLight = history[lastLightIdx];
      const span = history.length - lastLightIdx;
      if (span === 1) {
        // 算法2：连续两次亮灯
        const mileageDiff = current.currentMileage - lastLight.currentMileage;
        if (mileageDiff > 0) {
          // 用上次加油量
          const consumption = (lastLight.fuelAmount / mileageDiff) * 100;
          // 每公里成本 = (上次金额 + 中间金额) / 里程差
          const intervalCost = history
            .slice(lastLightIdx)
            .reduce((sum, r) => sum + getActualCost(r), 0);
          const costPerKm = intervalCost / mileageDiff;
          candidates.push({
            result: { consumption: round(consumption), costPerKm: round(costPerKm), algorithm: 2 },
            span: 1,
            priority: 2,
          });
        }
      } else {
        // 算法4：两点亮灯（跨记录）
        const mileageDiff = current.currentMileage - lastLight.currentMileage;
        if (mileageDiff > 0) {
          // 区间总加油量 = 从上次亮灯（含）到本次之前的所有加油量之和
          const intervalFuel = history
            .slice(lastLightIdx)
            .reduce((sum, r) => sum + r.fuelAmount, 0);
          const intervalCost = history
            .slice(lastLightIdx)
            .reduce((sum, r) => sum + getActualCost(r), 0);
          const consumption = (intervalFuel / mileageDiff) * 100;
          const costPerKm = intervalCost / mileageDiff;
          candidates.push({
            result: { consumption: round(consumption), costPerKm: round(costPerKm), algorithm: 4 },
            span,
            priority: 4,
          });
        }
      }
    }
  }

  // 按优先级排序：优先算法1 > 2 > 3 > 4，同优先级选跨度小的
  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.span - b.span;
  });

  if (candidates.length > 0) {
    return candidates[0].result;
  }

  return { consumption: null, costPerKm: null, algorithm: null };
}

function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return i;
  }
  return -1;
}

function round(value: number, decimals = 2): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}
