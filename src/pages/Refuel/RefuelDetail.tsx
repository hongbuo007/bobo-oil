import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Button, Descriptions, Tag, Spin, Empty } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useRefuelStore } from '@/stores/useRefuelStore';
import { useVehicleStore } from '@/stores/useVehicleStore';
import type { RefuelRecord } from '@/models/refuel';
import {
  formatDate,
  formatMileage,
  formatMoney,
  formatConsumption,
  formatCostPerKm,
} from '@/utils/format';
import { ALGORITHM_NAMES } from '@/config/constants';
import StatCard from '@/components/common/StatCard';

export default function RefuelDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const { records, loading, loadRecords } = useRefuelStore();
  const { currentVehicleId, getCurrentVehicle, loadVehicles } = useVehicleStore();

  const [record, setRecord] = useState<RefuelRecord | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  useEffect(() => {
    if (currentVehicleId) {
      loadRecords(currentVehicleId);
    }
  }, [currentVehicleId, loadRecords]);

  useEffect(() => {
    if (!loading && records.length > 0 && id) {
      const found = records.find((r) => r.id === id);
      if (found) {
        setRecord(found);
      } else {
        setNotFound(true);
      }
    } else if (!loading && records.length === 0 && id) {
      setNotFound(true);
    }
  }, [loading, records, id]);

  const currentVehicle = getCurrentVehicle();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spin size="large" description="加载中..." />
      </div>
    );
  }

  if (notFound || !record) {
    return (
      <div className="p-4 text-center py-20">
        <Empty description="记录不存在" />
        <Button className="mt-4" onClick={() => navigate('/refuel')}>
          返回加油记录
        </Button>
      </div>
    );
  }

  const hasConsumption = record.calculatedConsumption !== null;

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/refuel')}
        />
        <h1 className="text-lg font-bold text-gray-800 m-0">加油详情</h1>
      </div>

      <Card title="基本信息" className="mb-4">
        <Descriptions column={{ xs: 1, sm: 2 }} size="small">
          <Descriptions.Item label="加油日期">
            {formatDate(record.date)}
          </Descriptions.Item>
          <Descriptions.Item label="当前里程">
            {formatMileage(record.currentMileage)}
          </Descriptions.Item>
          <Descriptions.Item label="加油站">
            {record.stationName || '--'}
          </Descriptions.Item>
          <Descriptions.Item label="油品类型">
            <Tag color="blue">{record.fuelType}</Tag>
          </Descriptions.Item>
          {currentVehicle && (
            <>
              <Descriptions.Item label="车辆">
                {currentVehicle.brand} {currentVehicle.model}
              </Descriptions.Item>
              <Descriptions.Item label="车牌号">
                {currentVehicle.licensePlate}
              </Descriptions.Item>
            </>
          )}
        </Descriptions>
      </Card>

      <Card title="加油数据" className="mb-4">
        <Descriptions column={{ xs: 1, sm: 3 }} size="small">
          <Descriptions.Item label="加油量">
            <span className="text-base font-semibold">{record.fuelAmount.toFixed(2)} L</span>
          </Descriptions.Item>
          <Descriptions.Item label="单价">
            <span className="text-base font-semibold">{formatMoney(record.unitPrice)}/L</span>
          </Descriptions.Item>
          <Descriptions.Item label="总金额">
            <span className="text-base font-semibold text-orange-500">
              {formatMoney(record.totalCost)}
            </span>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="计算结果" className="mb-4">
        {hasConsumption ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="油耗"
              value={record.calculatedConsumption!.toFixed(2)}
              unit="L/100km"
              color="green"
            />
            <StatCard
              title="每公里成本"
              value={record.calculatedCostPerKm!.toFixed(2)}
              unit="元/km"
              prefix="¥"
              color="blue"
            />
            <StatCard
              title="计算算法"
              value={
                record.algorithmUsed
                  ? ALGORITHM_NAMES[record.algorithmUsed] || `算法${record.algorithmUsed}`
                  : '--'
              }
              color="orange"
            />
          </div>
        ) : (
          <div className="text-center py-6 text-gray-400">
            暂无油耗计算结果（需要至少两条记录才能计算）
          </div>
        )}
      </Card>

      <Card title="状态标记" className="mb-4">
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">是否加满/跳枪：</span>
            {record.isFullTank ? (
              <Tag icon={<CheckCircleOutlined />} color="success">是</Tag>
            ) : (
              <Tag icon={<CloseCircleOutlined />} color="default">否</Tag>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">油灯是否亮：</span>
            {record.isLowFuelLight ? (
              <Tag icon={<CheckCircleOutlined />} color="warning">是</Tag>
            ) : (
              <Tag icon={<CloseCircleOutlined />} color="default">否</Tag>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">是否漏记上次：</span>
            {record.isMissedPrevious ? (
              <Tag icon={<CheckCircleOutlined />} color="error">是</Tag>
            ) : (
              <Tag icon={<CloseCircleOutlined />} color="default">否</Tag>
            )}
          </div>
        </div>
      </Card>

      {record.note && (
        <Card title="备注" className="mb-4">
          <p className="text-sm text-gray-600 whitespace-pre-wrap m-0">{record.note}</p>
        </Card>
      )}

      <div className="flex justify-center mt-6">
        <Button onClick={() => navigate('/refuel')}>返回记录列表</Button>
      </div>
    </div>
  );
}
