import { useState, useCallback } from 'react';
import { Card, Button, Upload, Popconfirm, Input, message, Space, Descriptions, Typography, Form, Modal, Alert } from 'antd';
import { DownloadOutlined, UploadOutlined, DeleteOutlined, LockOutlined, LogoutOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import * as XLSX from 'xlsx';
import { db } from '@/db';
import { APP_NAME, APP_VERSION } from '@/config/constants';
import { generateUUID } from '@/utils/format';
import { calculateConsumption } from '@/services/refuelCalculator';
import { useAuthStore } from '@/stores/useAuthStore';
import type { RefuelRecord } from '@/models/refuel';
import type { Vehicle } from '@/models/vehicle';
import type { FuelType } from '@/models/vehicle';

const { Text } = Typography;

// ==================== 工具函数 ====================

function generateCSV(records: RefuelRecord[]): string {
  const headers = [
    '日期', '里程(km)', '加油量(L)', '单价(元/L)', '总金额(元)',
    '油品', '加油站', '是否加满', '是否亮灯', '是否漏记', '油耗(L/100km)',
    '每公里成本', '备注',
  ];
  const rows = records.map((r) => [
    r.date,
    r.currentMileage,
    r.fuelAmount,
    r.unitPrice,
    r.totalCost,
    r.fuelType,
    r.stationName,
    r.isFullTank ? '是' : '否',
    r.isLowFuelLight ? '是' : '否',
    r.isMissedPrevious ? '是' : '否',
    r.calculatedConsumption ?? '',
    r.calculatedCostPerKm ?? '',
    r.note,
  ]);
  const BOM = '\uFEFF';
  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  return BOM + csvContent;
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function parseBool(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  const s = String(val ?? '').trim();
  return s === '是' || s === 'true' || s === '1' || s === 'TRUE' || s === 'yes' || s === 'YES';
}

function parseFuelType(val: unknown): FuelType {
  const s = String(val ?? '').trim();
  const validTypes: FuelType[] = ['92#', '95#', '98#', '0#柴油'];
  return validTypes.includes(s as FuelType) ? (s as FuelType) : '92#';
}

function toNumber(val: unknown): number {
  if (typeof val === 'number') return val;
  const s = String(val ?? '').trim().replace(/[¥元,]/g, '');
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

function toString(val: unknown): string {
  return String(val ?? '');
}

// Excel 日期序列号转 YYYY-MM-DD（例如 45678 → 2025-01-15）
function excelDateToString(val: unknown): string {
  if (val === null || val === undefined || val === '') return '';
  // 已经是字符串格式的日期
  if (typeof val === 'string') {
    const trimmed = val.trim();
    // 尝试识别各种日期格式
    // YYYY-MM-DD 或 YYYY/MM/DD
    const match1 = trimmed.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (match1) {
      return `${match1[1]}-${match1[2].padStart(2, '0')}-${match1[3].padStart(2, '0')}`;
    }
    // MM/DD/YYYY 或 DD/MM/YYYY
    const match2 = trimmed.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
    if (match2) {
      return `${match2[3]}-${match2[1].padStart(2, '0')}-${match2[2].padStart(2, '0')}`;
    }
    return trimmed;
  }
  // Excel 数字日期序列号
  if (typeof val === 'number') {
    // Excel 日期从 1900-01-01 开始计数（但 Excel 有个 bug：把 1900 当作闰年）
    // 序列号 1 = 1900-01-01，序列号 60 = 1900-02-29（不存在），所以 >= 60 需要 -1
    const excelEpoch = Date.UTC(1899, 11, 30); // 1899-12-30
    let days = Math.floor(val);
    if (days >= 60) days -= 1; // 修正 Excel 1900 闰年 bug
    const date = new Date(excelEpoch + days * 86400000);
    return date.toISOString().split('T')[0];
  }
  return '';
}

// ==================== JSON 导入逻辑 ====================

function validateRefuelRecord(data: unknown): data is RefuelRecord[] {
  if (!Array.isArray(data)) return false;
  if (data.length === 0) return true; // 空数组也算合法
  return data.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof item.date === 'string' &&
      typeof item.currentMileage === 'number',
  );
}

async function importJSON(text: string): Promise<number> {
  const data = JSON.parse(text);
  const defaultVehicleId = await getDefaultVehicleId();

  // 支持两种格式：直接数组 或 { refuelRecords: [...] }
  let records: RefuelRecord[];
  if (Array.isArray(data)) {
    records = data;
  } else if (data && typeof data === 'object' && Array.isArray(data.refuelRecords)) {
    records = data.refuelRecords;

    // 也导入车辆数据
    if (Array.isArray(data.vehicles)) {
      const existingVehicles = new Set((await db.vehicles.toArray()).map(v => v.id));
      const newVehicles = data.vehicles.filter((v: Vehicle) => !existingVehicles.has(v.id));
      if (newVehicles.length > 0) {
        await db.vehicles.bulkAdd(newVehicles);
      }
    }
  } else {
    throw new Error('无法识别的数据格式');
  }

  if (!validateRefuelRecord(records)) {
    throw new Error('数据格式校验失败：每条记录至少需要 date 和 currentMileage 字段');
  }

  // 补充缺失的字段，确保每条记录完整
  const now = new Date().toISOString();
  const completeRecords: RefuelRecord[] = records.map((r) => ({
    id: generateUUID(),
    vehicleId: r.vehicleId || defaultVehicleId,
    date: excelDateToString(r.date),
    currentMileage: toNumber(r.currentMileage),
    fuelAmount: toNumber(r.fuelAmount),
    unitPrice: toNumber(r.unitPrice),
    totalCost: toNumber(r.totalCost),
    fuelType: parseFuelType(r.fuelType),
    stationName: toString(r.stationName),
    isFullTank: parseBool(r.isFullTank),
    isLowFuelLight: parseBool(r.isLowFuelLight),
    isMissedPrevious: parseBool(r.isMissedPrevious),
    // 优先使用 Excel 自带的油耗和每公里成本；没有则清空后重算
    calculatedConsumption: r.calculatedConsumption != null ? toNumber(r.calculatedConsumption) : null,
    calculatedCostPerKm: r.calculatedCostPerKm != null ? toNumber(r.calculatedCostPerKm) : null,
    algorithmUsed: null,
    note: toString(r.note),
    createdAt: now,
    updatedAt: now,
  }));

  await db.refuelRecords.bulkAdd(completeRecords);

  // 对没有油耗的记录重新计算
  await recalcMissing(completeRecords[0]?.vehicleId || defaultVehicleId);

  return completeRecords.length;
}

// ==================== Excel 导入逻辑 ====================

/**
 * 列名映射：Excel/CSV 表头 → 数据库字段
 */
const COLUMN_MAP: Record<string, string> = {
  '日期': 'date',
  '日期时间': 'date',
  '时间': 'date',
  '加油日期': 'date',
  '里程': 'currentMileage',
  '里程(km)': 'currentMileage',
  '当前里程': 'currentMileage',
  '总里程': 'currentMileage',
  '加油量': 'fuelAmount',
  '加油量(L)': 'fuelAmount',
  '升数': 'fuelAmount',
  '单价': 'unitPrice',
  '单价(元/L)': 'unitPrice',
  '油价': 'unitPrice',
  '机显单价': 'unitPrice',
  '总金额': 'totalCost',
  '总金额(元)': 'totalCost',
  '金额': 'totalCost',
  '油费': 'totalCost',
  '机显金额': 'totalCost',
  '实付金额': 'totalCost',
  '油品': 'fuelType',
  '油品类型': 'fuelType',
  '燃油类型': 'fuelType',
  '油号': 'fuelType',
  '加油站': 'stationName',
  '加油站名称': 'stationName',
  '加油站点': 'stationName',
  '是否加满': 'isFullTank',
  '是否跳枪': 'isFullTank',
  '加满': 'isFullTank',
  '跳枪': 'isFullTank',
  '是否亮灯': 'isLowFuelLight',
  '油灯亮': 'isLowFuelLight',
  '亮灯': 'isLowFuelLight',
  '是否漏记': 'isMissedPrevious',
  '漏记上次': 'isMissedPrevious',
  '漏记': 'isMissedPrevious',
  '油耗': 'calculatedConsumption',
  '油耗(L/100km)': 'calculatedConsumption',
  '百公里油耗': 'calculatedConsumption',
  '每公里成本': 'calculatedCostPerKm',
  '每公里费用': 'calculatedCostPerKm',
  '备注': 'note',
  '说明': 'note',
};

function mapRow(row: Record<string, unknown>): Partial<RefuelRecord> {
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const field = COLUMN_MAP[key.trim()] || key.trim();
    mapped[field] = value;
  }

  // 金额字段优先级：实付金额 > 机显金额 > 总金额 > 金额 > 油费
  const costFields = ['实付金额', '机显金额', '总金额', '金额', '油费'];
  for (const costKey of costFields) {
    if (row[costKey] !== undefined && row[costKey] !== null && row[costKey] !== '') {
      mapped.totalCost = row[costKey];
      break;
    }
  }

  // 日期字段优先级：日期时间 > 日期 > 时间
  const dateFields = ['日期时间', '日期', '时间'];
  for (const dateKey of dateFields) {
    if (row[dateKey] !== undefined && row[dateKey] !== null && row[dateKey] !== '') {
      mapped.date = row[dateKey];
      break;
    }
  }

  return mapped;
}

async function getDefaultVehicleId(): Promise<string> {
  const vehicles = await db.vehicles.toArray();
  const activeVehicle = vehicles.find(v => v.isActive) || vehicles[0];
  return activeVehicle?.id || '';
}

// 重新计算指定车辆中油耗缺失的记录
async function recalcMissing(vehicleId: string): Promise<number> {
  if (!vehicleId) return 0;
  const records = await db.refuelRecords
    .where('vehicleId')
    .equals(vehicleId)
    .sortBy('date');

  const now = new Date().toISOString();
  let calcCount = 0;
  for (let i = 0; i < records.length; i++) {
    // 如果油耗和每公里成本都有，跳过
    if (records[i].calculatedConsumption != null && records[i].calculatedCostPerKm != null) continue;

    const history = records.slice(0, i);
    const result = calculateConsumption(records[i], history);
    await db.refuelRecords.update(records[i].id, {
      calculatedConsumption: result.consumption ?? records[i].calculatedConsumption,
      calculatedCostPerKm: result.costPerKm ?? records[i].calculatedCostPerKm,
      algorithmUsed: result.algorithm ?? records[i].algorithmUsed,
      updatedAt: now,
    });
    if (result.consumption != null || result.costPerKm != null) calcCount++;
  }
  return calcCount;
}

async function importExcel(file: File): Promise<number> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Excel 文件中没有工作表');

  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  if (rawData.length === 0) throw new Error('Excel 文件中没有数据');

  // 映射列名
  const rows = rawData.map(mapRow);

  // 检查必填字段
  const firstRow = rows[0];
  if (!firstRow.date && !firstRow.currentMileage) {
    throw new Error(
      '未识别到日期或里程列。请确保 Excel 表头包含"日期"和"里程"列。\n' +
      '当前表头：' + Object.keys(rawData[0]).join(', '),
    );
  }

  const defaultVehicleId = await getDefaultVehicleId();
  const now = new Date().toISOString();
  const records: RefuelRecord[] = rows.map((r) => ({
    id: generateUUID(),
    vehicleId: (r.vehicleId as string) || defaultVehicleId,
    date: excelDateToString(r.date),
    currentMileage: toNumber(r.currentMileage),
    fuelAmount: toNumber(r.fuelAmount),
    unitPrice: toNumber(r.unitPrice),
    totalCost: toNumber(r.totalCost),
    fuelType: parseFuelType(r.fuelType),
    stationName: toString(r.stationName),
    isFullTank: parseBool(r.isFullTank),
    isLowFuelLight: parseBool(r.isLowFuelLight),
    isMissedPrevious: parseBool(r.isMissedPrevious),
    calculatedConsumption: r.calculatedConsumption != null ? toNumber(r.calculatedConsumption) : null,
    calculatedCostPerKm: r.calculatedCostPerKm != null ? toNumber(r.calculatedCostPerKm) : null,
    algorithmUsed: null,
    note: toString(r.note),
    createdAt: now,
    updatedAt: now,
  }));

  await db.refuelRecords.bulkAdd(records);
  await recalcMissing(records[0]?.vehicleId || defaultVehicleId);
  return records.length;
}

// ==================== CSV 导入逻辑 ====================

async function importCSV(file: File): Promise<number> {
  const text = await file.text();
  const workbook = XLSX.read(text, { type: 'string', raw: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('CSV 文件中没有数据');

  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  if (rawData.length === 0) throw new Error('CSV 文件中没有数据');

  const rows = rawData.map(mapRow);
  const firstRow = rows[0];

  if (!firstRow.date && !firstRow.currentMileage) {
    throw new Error(
      '未识别到日期或里程列。请确保 CSV 表头包含"日期"和"里程"列。',
    );
  }

  const defaultVehicleId = await getDefaultVehicleId();
  const now = new Date().toISOString();
  const records: RefuelRecord[] = rows.map((r) => ({
    id: generateUUID(),
    vehicleId: (r.vehicleId as string) || defaultVehicleId,
    date: excelDateToString(r.date),
    currentMileage: toNumber(r.currentMileage),
    fuelAmount: toNumber(r.fuelAmount),
    unitPrice: toNumber(r.unitPrice),
    totalCost: toNumber(r.totalCost),
    fuelType: parseFuelType(r.fuelType),
    stationName: toString(r.stationName),
    isFullTank: parseBool(r.isFullTank),
    isLowFuelLight: parseBool(r.isLowFuelLight),
    isMissedPrevious: parseBool(r.isMissedPrevious),
    calculatedConsumption: r.calculatedConsumption != null ? toNumber(r.calculatedConsumption) : null,
    calculatedCostPerKm: r.calculatedCostPerKm != null ? toNumber(r.calculatedCostPerKm) : null,
    algorithmUsed: null,
    note: toString(r.note),
    createdAt: now,
    updatedAt: now,
  }));

  await db.refuelRecords.bulkAdd(records);
  await recalcMissing(records[0]?.vehicleId || defaultVehicleId);
  return records.length;
}

// ==================== 页面组件 ====================

export default function SettingsPage() {
  const [importing, setImporting] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [clearPopconfirmOpen, setClearPopconfirmOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [pwdSubmitting, setPwdSubmitting] = useState(false);
  const [pwdForm] = Form.useForm();
  const logout = useAuthStore((s) => s.logout);
  const changePassword = useAuthStore((s) => s.changePassword);

  const handleExportCSV = useCallback(async () => {
    try {
      const records = await db.refuelRecords.toArray();
      if (records.length === 0) {
        message.warning('暂无数据可导出');
        return;
      }
      const csv = generateCSV(records);
      const timestamp = new Date().toISOString().slice(0, 10);
      downloadFile(csv, `bobo油耗-加油记录-${timestamp}.csv`, 'text/csv;charset=utf-8');
      message.success(`已导出 ${records.length} 条记录`);
    } catch (err) {
      message.error('导出失败');
      console.error(err);
    }
  }, []);

  const handleExportJSON = useCallback(async () => {
    try {
      const records = await db.refuelRecords.toArray();
      if (records.length === 0) {
        message.warning('暂无数据可导出');
        return;
      }
      const json = JSON.stringify(records, null, 2);
      const timestamp = new Date().toISOString().slice(0, 10);
      downloadFile(json, `bobo油耗-加油记录-${timestamp}.json`, 'application/json');
      message.success(`已导出 ${records.length} 条记录`);
    } catch (err) {
      message.error('导出失败');
      console.error(err);
    }
  }, []);

  // 统一导入处理（JSON / Excel / CSV）
  const handleImport: UploadProps['beforeUpload'] = useCallback(
    async (file) => {
      setImporting(true);
      try {
        const name = file.name.toLowerCase();
        let count = 0;

        if (name.endsWith('.json')) {
          const text = await file.text();
          count = await importJSON(text);
        } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
          count = await importExcel(file);
        } else if (name.endsWith('.csv')) {
          count = await importCSV(file);
        } else {
          message.error('不支持的文件格式，请选择 JSON、Excel (.xlsx/.xls) 或 CSV 文件');
          setImporting(false);
          return false;
        }

        if (count === 0) {
          message.info('没有新的记录需要导入（可能已存在）');
        } else {
          message.success(`成功导入 ${count} 条记录`);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : '未知错误';
        message.error(`导入失败：${errMsg}`);
        console.error(err);
      } finally {
        setImporting(false);
      }
      return false;
    },
    [],
  );

  const handleClearData = useCallback(async () => {
    try {
      await db.refuelRecords.clear();
      await db.vehicles.clear();
      await db.settings.clear();
      // 删除整个数据库确保彻底清除
      await db.delete();
      message.success('所有数据已清空，即将刷新页面');
      setClearPopconfirmOpen(false);
      setClearConfirmText('');
      setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      message.error('清空数据失败');
      console.error(err);
    }
  }, []);

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-6">
      <Card title="数据导出">
        <Space size="middle" wrap>
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleExportCSV}>
            导出为 CSV
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExportJSON}>
            导出为 JSON
          </Button>
        </Space>
      </Card>

      <Card title="数据导入">
        <Alert
          title="导入说明"
          description={
            <ul className="list-disc pl-4 mt-1 space-y-0.5 text-sm">
              <li><strong>JSON</strong>：支持本应用导出的 JSON 格式，或包含 <code>date</code>、<code>currentMileage</code> 字段��数组</li>
              <li><strong>Excel (.xlsx/.xls)</strong>：第一行为表头，需包含"日期"和"里程"列</li>
              <li><strong>CSV</strong>：同 Excel 格式，需包含"日期"和"里程"列</li>
              <li>导入时自动跳过已存在的记录（按 ID 判断），新记录自动分配 ID</li>
            </ul>
          }
          type="info"
          showIcon
          className="mb-4"
        />
        <Upload
          accept=".json,.xlsx,.xls,.csv"
          showUploadList={false}
          beforeUpload={handleImport}
        >
          <Button icon={<UploadOutlined />} loading={importing} size="large">
            选择文件导入（JSON / Excel / CSV）
          </Button>
        </Upload>

        <div className="mt-4 p-3 bg-gray-50 rounded text-xs text-gray-500">
          <p className="font-medium mb-1">Excel/CSV 表头参考（支持以下列名）：</p>
          <p>日期、里程(km)、加油量(L)、单价(元/L)、总金额(元)、油品、加油站、是否加满、是否亮灯、是否漏记、备注</p>
        </div>
      </Card>

      <Card title="清空数据">
        <div className="space-y-3">
          <Text type="danger">
            此操作将清空所有加油记录和车辆数据，且不可恢复。请谨慎操作。
          </Text>
          <Popconfirm
            title="确认清空数据"
            description={
              <div className="space-y-2 mt-2">
                <div>请输入 <Text strong>确认清空</Text> 以继续：</div>
                <Input
                  value={clearConfirmText}
                  onChange={(e) => setClearConfirmText(e.target.value)}
                  placeholder="输入：确认清空"
                />
              </div>
            }
            open={clearPopconfirmOpen}
            onOpenChange={(open) => {
              setClearPopconfirmOpen(open);
              if (!open) setClearConfirmText('');
            }}
            onConfirm={handleClearData}
            okButtonProps={{
              danger: true,
              disabled: clearConfirmText !== '确认清空',
            }}
            okText="确认清空"
            cancelText="取消"
          >
            <Button danger type="primary" icon={<DeleteOutlined />}>
              清空所有数据
            </Button>
          </Popconfirm>
        </div>
      </Card>

      <Card title="账号管理">
        <Space size="middle" wrap>
          <Button icon={<LockOutlined />} onClick={() => setPasswordModalOpen(true)}>
            修改密码
          </Button>
          <Button icon={<LogoutOutlined />} onClick={logout} danger>
            退出登录
          </Button>
        </Space>
      </Card>

      <Card title="关于">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="应用名称">{APP_NAME}</Descriptions.Item>
          <Descriptions.Item label="版本">{APP_VERSION}</Descriptions.Item>
          <Descriptions.Item label="技术栈">
            React 18 + TypeScript + Ant Design 5 + Recharts + Tailwind CSS + Dexie.js + Zustand
          </Descriptions.Item>
          <Descriptions.Item label="数据存储">浏览器本地 IndexedDB (BoboOilDB)</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 修改密码 Modal */}
      <Modal
        title="修改密码"
        open={passwordModalOpen}
        onCancel={() => { setPasswordModalOpen(false); pwdForm.resetFields(); }}
        footer={null}
        destroyOnClose
      >
        <Form
          form={pwdForm}
          layout="vertical"
          onFinish={async (values) => {
            setPwdSubmitting(true);
            const success = await changePassword(values.oldPassword, values.newPassword);
            setPwdSubmitting(false);
            if (success) {
              message.success('密码修改成功');
              setPasswordModalOpen(false);
              pwdForm.resetFields();
            } else {
              message.error('原密码错误');
            }
          }}
        >
          <Form.Item name="oldPassword" label="原密码" rules={[{ required: true, message: '请输入原密码' }]}>
            <Input.Password placeholder="请输入原密码" />
          </Form.Item>
          <Form.Item name="newPassword" label="新密码" rules={[{ required: true, min: 4, message: '新密码至少4位' }]}>
            <Input.Password placeholder="请输入新密码（至少4位）" />
          </Form.Item>
          <Form.Item
            name="confirm"
            label="确认新密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                  return Promise.reject(new Error('两次密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请确认新密码" />
          </Form.Item>
          <Form.Item className="!mb-0 text-right">
            <Space>
              <Button onClick={() => { setPasswordModalOpen(false); pwdForm.resetFields(); }}>取消</Button>
              <Button type="primary" htmlType="submit" loading={pwdSubmitting}>确认修改</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
