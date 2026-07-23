import { useState, useCallback, useRef } from 'react';
import { Card, Button, Upload, Popconfirm, Input, message, Space, Divider, Descriptions, Typography } from 'antd';
import { DownloadOutlined, UploadOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { db } from '@/db';
import { APP_NAME, APP_VERSION } from '@/config/constants';
import type { RefuelRecord } from '@/models/refuel';
import type { Vehicle } from '@/models/vehicle';

const { Text, Title } = Typography;

function generateCSV(records: RefuelRecord[]): string {
  const headers = [
    '日期', '里程(km)', '加油量(L)', '单价(元/L)', '总金额(元)',
    '油品', '加油站', '是否加满', '是否亮灯', '油耗(L/100km)',
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

function validateRefuelRecord(data: unknown): data is RefuelRecord[] {
  if (!Array.isArray(data)) return false;
  return data.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof item.id === 'string' &&
      typeof item.vehicleId === 'string' &&
      typeof item.date === 'string' &&
      typeof item.currentMileage === 'number' &&
      typeof item.fuelAmount === 'number' &&
      typeof item.unitPrice === 'number' &&
      typeof item.totalCost === 'number',
  );
}

export default function SettingsPage() {
  const [importing, setImporting] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [clearPopconfirmOpen, setClearPopconfirmOpen] = useState(false);

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

  const handleImport: UploadProps['beforeUpload'] = useCallback(
    (file) => {
      setImporting(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string;
          const data = JSON.parse(text);
          if (!validateRefuelRecord(data)) {
            message.error('文件格式不正确，请检查文件内容');
            setImporting(false);
            return;
          }

          const existingIds = new Set(
            (await db.refuelRecords.toArray()).map((r) => r.id),
          );
          const newRecords = data.filter((r) => !existingIds.has(r.id));

          if (newRecords.length === 0) {
            message.info('没有新的记录需要导入');
            setImporting(false);
            return;
          }

          await db.refuelRecords.bulkAdd(newRecords);
          message.success(`成功导入 ${newRecords.length} 条记录`);
        } catch (err) {
          message.error('导入失败，请检查文件格式');
          console.error(err);
        } finally {
          setImporting(false);
        }
      };
      reader.readAsText(file);
      return false; // 阻止自动上传
    },
    [],
  );

  const handleClearData = useCallback(async () => {
    try {
      await db.refuelRecords.clear();
      await db.vehicles.clear();
      message.success('所有数据已清空');
      setClearPopconfirmOpen(false);
      setClearConfirmText('');
      // 刷新页面以重置状态
      window.location.reload();
    } catch (err) {
      message.error('清空数据失败');
      console.error(err);
    }
  }, []);

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <Card title="数据导出">
        <Space size="middle">
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExportCSV}
          >
            导出为 CSV
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExportJSON}
          >
            导出为 JSON
          </Button>
        </Space>
      </Card>

      <Card title="数据导入">
        <div className="space-y-3">
          <Text type="secondary">
            支持导入 JSON 格式的加油记录文件。导入时将合并数据，已存在的记录（相同 ID）将被跳过。
          </Text>
          <Upload
            accept=".json"
            showUploadList={false}
            beforeUpload={handleImport}
          >
            <Button
              icon={<UploadOutlined />}
              loading={importing}
            >
              选择 JSON 文件导入
            </Button>
          </Upload>
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
            <Button
              danger
              type="primary"
              icon={<DeleteOutlined />}
            >
              清空所有数据
            </Button>
          </Popconfirm>
        </div>
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
    </div>
  );
}
