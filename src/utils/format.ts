import dayjs from 'dayjs';

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
