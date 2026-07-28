import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Popconfirm, message, Card, Space, Tag, Row, Col } from 'antd';
import { PlusOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
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
    const totalCost = records.reduce((sum, r) => sum + (r.actualCost ?? r.totalCost ?? 0), 0);
    const totalDiscount = records.reduce((sum, r) => sum + (r.discount || 0), 0);
    return { totalAmount, totalCost, totalDiscount };
  }, [records]);

  const columns: ColumnsType<RefuelRecord> = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 110,
      render: (date: string) => <span className="font-medium">{formatDate(date)}</span>,
      sorter: (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      defaultSortOrder: 'descend',
    },
    {
      title: '里程',
      dataIndex: 'currentMileage',
      key: 'currentMileage',
      width: 105,
      render: (val: number) => formatMileage(val),
    },
    {
      title: '加油量',
      dataIndex: 'fuelAmount',
      key: 'fuelAmount',
      width: 90,
      render: (val: number) => `${val.toFixed(2)} L`,
    },
    {
      title: '单价',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      width: 85,
      render: (val: number) => <span className="text-gray-500">{formatMoney(val)}</span>,
    },
    {
      title: '实付金额',
      key: 'totalCost',
      width: 110,
      render: (_: unknown, r: RefuelRecord) => {
        const actual = r.actualCost ?? r.totalCost ?? 0;
        return (
          <span>
            <span className="font-semibold">{formatMoney(actual)}</span>
            {r.discount > 0 && (
              <span className="text-xs text-green-600 ml-1">省{r.discount.toFixed(0)}</span>
            )}
          </span>
        );
      },
      sorter: (a: RefuelRecord, b: RefuelRecord) =>
        (a.actualCost ?? a.totalCost ?? 0) - (b.actualCost ?? b.totalCost ?? 0),
    },
    {
      title: '油耗',
      dataIndex: 'calculatedConsumption',
      key: 'calculatedConsumption',
      width: 120,
      render: (val: number | null) => {
        if (val === null) return <span className="text-gray-300">--</span>;
        return (
          <span className={`font-semibold ${getConsumptionColorClass(val)}`}>
            {formatConsumption(val)}
          </span>
        );
      },
    },
    {
      title: '算法',
      dataIndex: 'algorithmUsed',
      key: 'algorithmUsed',
      width: 130,
      render: (val: number | null) => {
        if (val === null) return <span className="text-gray-300">--</span>;
        return (
          <Tag color="processing">{ALGORITHM_NAMES[val] || `算法${val}`}</Tag>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/refuel/${record.id}`)}
          />
          <Popconfirm
            title="确认删除"
            description="确定要删除这条加油记录吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (!currentVehicleId || !currentVehicle) {
    return (
      <div className="p-4 page-enter">
        <EmptyState
          title="请先添加车辆"
          description="您需要先添加一辆车，才能记录加油数据"
          action={
            <Button type="primary" size="large" onClick={() => navigate('/vehicles/add')}>
              添加车辆
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="p-4 page-enter">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 m-0">加油记录</h1>
          <p className="text-sm text-gray-400 mt-1 m-0">
            {currentVehicle.brand} {currentVehicle.model} · {currentVehicle.licensePlate}
          </p>
        </div>
        <Button
          type="primary"
          size="large"
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
            <Button type="primary" size="large" onClick={() => navigate('/refuel/add')}>
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
            scroll={{ x: 950 }}
            pagination={{
              pageSize: 15,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条记录`,
              pageSizeOptions: ['10', '15', '20', '50'],
            }}
          />

          {records.length > 0 && (
            <Row gutter={[16, 16]} className="mt-4">
              <Col xs={12} sm={6}>
                <Card size="small" className="text-center">
                  <div className="text-xs text-gray-400 mb-1">累计加油量</div>
                  <div className="text-lg font-bold text-blue-600">{summary.totalAmount.toFixed(1)} L</div>
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small" className="text-center">
                  <div className="text-xs text-gray-400 mb-1">累计实付</div>
                  <div className="text-lg font-bold text-orange-500">{formatMoney(summary.totalCost)}</div>
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small" className="text-center">
                  <div className="text-xs text-gray-400 mb-1">累计优惠</div>
                  <div className="text-lg font-bold text-green-600">{formatMoney(summary.totalDiscount)}</div>
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small" className="text-center">
                  <div className="text-xs text-gray-400 mb-1">记录次数</div>
                  <div className="text-lg font-bold text-gray-700">{records.length} 次</div>
                </Card>
              </Col>
            </Row>
          )}
        </>
      )}
    </div>
  );
}
