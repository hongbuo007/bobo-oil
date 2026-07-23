import dayjs from 'dayjs';

// 兼容的 UUID 生成函数（不依赖 crypto.randomUUID）
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // fallback：手动生成 UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// 格式化数字，保留指定小数位
export function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return '--';
  return value.toFixed(decimals);
}

// 格式化金额
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return '--';
  return `¥${value.toFixed(2)}`;
}

// 格式化油耗
export function formatConsumption(value: number | null | undefined): string {
  if (value === null || value === undefined) return '--';
  return `${value.toFixed(2)} L/100km`;
}

// 格式化每公里成本
export function formatCostPerKm(value: number | null | undefined): string {
  if (value === null || value === undefined) return '--';
  return `¥${value.toFixed(2)}/km`;
}

// 格式化日期
export function formatDate(date: string | null | undefined, pattern = 'YYYY-MM-DD'): string {
  if (!date) return '--';
  return dayjs(date).format(pattern);
}

// 格式化里程
export function formatMileage(value: number | null | undefined): string {
  if (value === null || value === undefined) return '--';
  return `${value.toLocaleString('zh-CN')} km`;
}

// 获取油耗颜色等级
export function getConsumptionColorClass(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (value < 7) return 'consumption-low';
  if (value < 9) return 'consumption-normal';
  if (value < 12) return 'consumption-high';
  return 'consumption-very-high';
}
