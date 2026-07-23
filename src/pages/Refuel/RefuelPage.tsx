import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Popconfirm, message, Card, Space, Tag } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useVehicleStore } from '@/stores/useVehicleStore';
import { useRefuelStore } from '@/stores/useRefuelStore';
import type { RefuelRecord } from '@/models/refuel';
import {
  formatDate,
  formatMileage,
  formatMoney,
  formatConsumption,
  getConsumptionColorClass,
} from '@/utils/format';
import { ALGORITHM_NAMES } from '@/config/constants';
import EmptyState from '@/components/common/EmptyState';

export default function RefuelPage() {
  const navigate = useNavigate();
  const { currentVehicleId, vehicles, getCurrentVehicle, loadVehicles } = useVehicleStore();
  const { records, loading, loadRecords, deleteRecord } = useRefuelStore();

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  useEffect(() => {
    if (currentVehicleId) {
      loadRecords(currentVehicleId);
    }
  }, [currentVehicleId, loadRecords]);

  const currentVehicle = getCurrentVehicle();

  const handleDelete = async (id: string) => {
    try {
      await deleteRecord(id);
      message.success('加油记录已删除');
    } catch {
      message.error('删除失败');
    }
  };

  const summary = useMemo(() => {
    const totalAmount = records.reduce((sum, r) => sum + r.fuelAmount, 0);
    const totalCost = records.reduce((sum, r) => sum + r.totalCost, 0);
    return { totalAmount, totalCost };
  }, [records]);

  const columns: ColumnsType<RefuelRecord> = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 110,
      render: (date: string) => formatDate(date),
      sorter: (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      defaultSortOrder: 'descend',
    },
    {
      title: '里程',
      dataIndex: 'currentMileage',
      key: 'currentMileage',
      width: 100,
      render: (val: number) => formatMileage(val),
    },
    {
      title: '加油量(L)',
      dataIndex: 'fuelAmount',
      key: 'fuelAmount',
      width: 100,
      render: (val: number) => val.toFixed(2),
    },
    {
      title: '单价',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      width: 90,
      render: (val: number) => formatMoney(val),
    },
    {
      title: '金额',
      dataIndex: 'totalCost',
      key: 'totalCost',
      width: 100,
      render: (val: number) => formatMoney(val),
      sorter: (a, b) => a.totalCost - b.totalCost,
    },
    {
      title: '油耗',
      dataIndex: 'calculatedConsumption',
      key: 'calculatedConsumption',
      width: 110,
      render: (val: number | null) => {
        if (val === null) return <span className="text-gray-300">--</span>;
        return (
          <span className={`font-medium ${getConsumptionColorClass(val)}`}>
            {formatConsumption(val)}
          </span>
        );
      },
    },
    {
      title: '算法',
      dataIndex: 'algorithmUsed',
      key: 'algorithmUsed',
      width: 120,
      render: (val: number | null) => {
        if (val === null) return <span className="text-gray-300">--</span>;
        return (
          <Tag color="blue">{ALGORITHM_NAMES[val] || `算法${val}`}</Tag>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/refuel/${record.id}`)}
          >
            详情
          </Button>
          <Popconfirm
            title="确认删除"
            description="确定要删除这条加油记录吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (!currentVehicleId || !currentVehicle) {
    return (
      <div className="p-4">
        <EmptyState
          title="请先添加车辆"
          description="您需要先添加一辆车，才能记录加油数据"
          action={
            <Button type="primary" onClick={() => navigate('/vehicles/add')}>
              添加车辆
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-800 m-0">加油记录</h1>
          <p className="text-sm text-gray-400 mt-1 m-0">
            {currentVehicle.brand} {currentVehicle.model} · {currentVehicle.licensePlate}
          </p>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/refuel/add')}
        >
          添加记录
        </Button>
      </div>

      {!loading && records.length === 0 ? (
        <EmptyState
          title="还没有加油记录"
          description="记录您的第一笔加油，开始计算油耗"
          action={
            <Button type="primary" onClick={() => navigate('/refuel/add')}>
              添加第一条记录
            </Button>
          }
        />
      ) : (
        <>
          <Table<RefuelRecord>
            columns={columns}
            dataSource={records}
            rowKey="id"
            loading={loading}
            scroll={{ x: 900 }}
            pagination={{
              pageSize: 15,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条记录`,
              pageSizeOptions: ['10', '15', '20', '50'],
            }}
          />

          {records.length > 0 && (
            <Card className="mt-4" size="small">
              <div className="flex flex-wrap gap-6">
                <div>
                  <span className="text-sm text-gray-400">累计加油量：</span>
                  <span className="text-base font-semibold text-gray-800">
                    {summary.totalAmount.toFixed(2)} L
                  </span>
                </div>
                <div>
                  <span className="text-sm text-gray-400">累计金额：</span>
                  <span className="text-base font-semibold text-orange-500">
                    {formatMoney(summary.totalCost)}
                  </span>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
