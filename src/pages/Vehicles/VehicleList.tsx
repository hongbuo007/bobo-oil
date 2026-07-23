import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Dropdown, Popconfirm, message, Spin } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  CarOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useVehicleStore } from '@/stores/useVehicleStore';
import type { Vehicle } from '@/models/vehicle';
import { VEHICLE_TYPES } from '@/config/constants';
import { formatMileage } from '@/utils/format';
import EmptyState from '@/components/common/EmptyState';

export default function VehicleList() {
  const navigate = useNavigate();
  const { vehicles, loading, loadVehicles, deleteVehicle } = useVehicleStore();

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  const handleDelete = async (id: string) => {
    try {
      await deleteVehicle(id);
      message.success('车辆已删除');
    } catch {
      message.error('删除失败');
    }
  };

  const actionMenuItems = (vehicle: Vehicle): MenuProps['items'] => [
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: '编辑',
      onClick: () => navigate(`/vehicles/${vehicle.id}/edit`),
    },
    { type: 'divider' },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: (
        <Popconfirm
          title="确认删除"
          description={`确定要删除「${vehicle.name}」吗？该车辆的所有加油记录也将被删除。`}
          onConfirm={(e) => {
            e?.stopPropagation();
            handleDelete(vehicle.id);
          }}
          onCancel={(e) => e?.stopPropagation()}
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <span onClick={(e) => e.stopPropagation()}>删除</span>
        </Popconfirm>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!vehicles || vehicles.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          icon={<CarOutlined style={{ fontSize: 64, color: '#bfbfbf' }} />}
          title="还没有添加车辆"
          description="添加您的第一辆车，开始记录油耗数据"
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
        <h1 className="text-lg font-bold text-gray-800 m-0">我的车辆</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {vehicles.map((vehicle) => (
          <Card
            key={vehicle.id}
            hoverable
            className="cursor-pointer"
            onClick={() => navigate(`/vehicles/${vehicle.id}/edit`)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <CarOutlined className="text-blue-500 text-lg" />
                  <span className="text-base font-semibold text-gray-800 truncate">
                    {vehicle.brand} {vehicle.model}
                  </span>
                </div>
                <div className="text-sm text-gray-500 mb-1">{vehicle.licensePlate}</div>
                <div className="text-sm text-gray-400">
                  {formatMileage(vehicle.currentMileage)}
                </div>
                <div className="mt-2">
                  <span className="inline-block bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded">
                    {VEHICLE_TYPES[vehicle.vehicleType] || vehicle.vehicleType}
                  </span>
                </div>
              </div>
              <Dropdown menu={{ items: actionMenuItems(vehicle) }} trigger={['click']}>
                <Button
                  type="text"
                  icon={<MoreOutlined />}
                  onClick={(e) => e.stopPropagation()}
                  className="text-gray-400 hover:text-gray-600"
                />
              </Dropdown>
            </div>
          </Card>
        ))}
      </div>

      <Button
        type="primary"
        shape="circle"
        size="large"
        icon={<PlusOutlined />}
        className="fixed bottom-6 right-6 shadow-lg z-10"
        style={{ width: 56, height: 56 }}
        onClick={() => navigate('/vehicles/add')}
      />
    </div>
  );
}
