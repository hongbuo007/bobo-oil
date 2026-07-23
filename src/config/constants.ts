// 车辆类型
export const VEHICLE_TYPES = {
  fuel: '燃油车',
  diesel: '柴油车',
  hybrid: '油电混动',
  electric: '纯电动',
  phev: '插电混动',
} as const;

// 油品类型
export const FUEL_TYPES = ['92#', '95#', '98#', '0#柴油'] as const;

// 变速箱类型
export const TRANSMISSION_TYPES = {
  MT: '手动挡',
  AT: '自动挡',
  CVT: '无级变速',
  DCT: '双离合',
} as const;

// 保养类型
export const MAINTENANCE_TYPES = {
  routine: '常规保养',
  major: '大保养',
  tire: '轮胎更换',
  brake: '刹车系统',
  air_condition: '空调系统',
  battery: '电瓶',
  other: '其他',
} as const;

// 提醒类型
export const REMINDER_TYPES = {
  maintenance: '保养提醒',
  insurance: '保险到期',
  annual_inspection: '年检到期',
  tire_rotation: '轮���换位',
  custom: '自定义提醒',
} as const;

// 油耗算法描述
export const ALGORITHM_NAMES: Record<number, string> = {
  1: '两次跳枪法',
  2: '两次亮灯法',
  3: '两点跳枪法(跨记录)',
  4: '两点亮灯法(跨记录)',
};

// 应用常量
export const APP_NAME = 'bobo油耗';
export const APP_VERSION = '1.0.0';
export const DB_NAME = 'BoboOilDB';
