import { Select } from 'antd';
import { useVehicleStore } from '@/stores/useVehicleStore';

export default function Header() {
  const vehicles = useVehicleStore((s) => s.vehicles);
  const currentVehicleId = useVehicleStore((s) => s.currentVehicleId);
  const setCurrentVehicle = useVehicleStore((s) => s.setCurrentVehicle);

  const options = vehicles.map((v) => ({
    value: v.id,
    label: `${v.name}${v.licensePlate ? ` (${v.licensePlate})` : ''}`,
  }));

  return (
    <div className="flex items-center justify-between h-14 px-4 bg-white border-b border-gray-100">
      <div className="flex items-center gap-2">
        <span className="text-lg">⛽</span>
        <span className="text-base font-semibold text-gray-800">bobo油耗</span>
      </div>

      <div>
        <Select
          value={currentVehicleId ?? undefined}
          onChange={setCurrentVehicle}
          placeholder="选择车辆"
          options={options}
          className="w-44"
          size="small"
          allowClear
          notFoundContent="暂无车辆"
        />
      </div>
    </div>
  );
}
