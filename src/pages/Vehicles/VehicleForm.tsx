import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Select,
  InputNumber,
  DatePicker,
  Button,
  message,
  Spin,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useVehicleStore } from '@/stores/useVehicleStore';
import type { VehicleFormData } from '@/models/vehicle';
import type { VehicleType, TransmissionType, FuelType } from '@/models/vehicle';
import { VEHICLE_TYPES, FUEL_TYPES, TRANSMISSION_TYPES } from '@/config/constants';

const vehicleTypeOptions = Object.entries(VEHICLE_TYPES).map(([value, label]) => ({
  value,
  label,
}));

const fuelTypeOptions = FUEL_TYPES.map((t) => ({ value: t, label: t }));

const transmissionTypeOptions = Object.entries(TRANSMISSION_TYPES).map(([value, label]) => ({
  value,
  label,
}));

export default function VehicleForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const { vehicles, loading, addVehicle, updateVehicle, loadVehicles } = useVehicleStore();
  const [form] = Form.useForm<VehicleFormData>();
  const [submitting, setSubmitting] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);

  useEffect(() => {
    if (isEdit) {
      setPageLoading(true);
      loadVehicles().then(() => {
        setPageLoading(false);
      });
    }
  }, [isEdit, loadVehicles]);

  useEffect(() => {
    if (isEdit && id && vehicles.length > 0) {
      const vehicle = vehicles.find((v) => v.id === id);
      if (vehicle) {
        form.setFieldsValue({
          name: vehicle.name,
          brand: vehicle.brand,
          model: vehicle.model,
          vehicleType: vehicle.vehicleType,
          licensePlate: vehicle.licensePlate,
          engineCapacity: vehicle.engineCapacity,
          transmission: vehicle.transmission,
          fuelType: vehicle.fuelType,
          fuelTankCapacity: vehicle.fuelTankCapacity,
          purchaseDate: vehicle.purchaseDate,
          imageUrl: vehicle.imageUrl,
        });
      }
    }
  }, [isEdit, id, vehicles, form]);

  const handleSubmit = async (values: VehicleFormData) => {
    setSubmitting(true);
    try {
      if (isEdit && id) {
        await updateVehicle(id, values);
        message.success('车辆信息已更新');
      } else {
        await addVehicle(values);
        message.success('车辆添加成功');
      }
      navigate('/vehicles');
    } catch {
      message.error(isEdit ? '更新失败' : '添加失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (isEdit && pageLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spin size="large" description="加载车辆信息..." />
      </div>
    );
  }

  if (isEdit && !vehicles.find((v) => v.id === id)) {
    return (
      <div className="p-4 text-center py-20">
        <p className="text-gray-400 mb-4">车辆不存在</p>
        <Button onClick={() => navigate('/vehicles')}>返回车辆列表</Button>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/vehicles')}
        />
        <h1 className="text-lg font-bold text-gray-800 m-0">
          {isEdit ? '编辑车辆' : '添加车辆'}
        </h1>
      </div>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            vehicleType: 'fuel' as VehicleType,
            fuelType: '92#' as FuelType,
            transmission: 'AT' as TransmissionType,
          }}
          scrollToFirstError
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0">
            <Form.Item
              name="name"
              label="车辆昵称"
              rules={[{ required: true, message: '请输入车辆昵称' }]}
            >
              <Input placeholder="例如：小白、大白" maxLength={20} />
            </Form.Item>

            <Form.Item
              name="licensePlate"
              label="车牌号"
              rules={[{ required: true, message: '请输入车牌号' }]}
            >
              <Input placeholder="例如：京A12345" maxLength={10} />
            </Form.Item>

            <Form.Item
              name="brand"
              label="品牌"
              rules={[{ required: true, message: '请输入品牌' }]}
            >
              <Input placeholder="例如：丰田" maxLength={30} />
            </Form.Item>

            <Form.Item
              name="model"
              label="车型"
              rules={[{ required: true, message: '请输入车型' }]}
            >
              <Input placeholder="例如：卡罗拉 2023款 1.2T" maxLength={50} />
            </Form.Item>

            <Form.Item
              name="vehicleType"
              label="车辆类型"
              rules={[{ required: true, message: '请选择车辆类型' }]}
            >
              <Select options={vehicleTypeOptions} placeholder="请选择车辆类型" />
            </Form.Item>

            <Form.Item
              name="fuelType"
              label="油品类型"
              rules={[{ required: true, message: '请选择油品类型' }]}
            >
              <Select options={fuelTypeOptions} placeholder="请选择油品类型" />
            </Form.Item>

            <Form.Item
              name="engineCapacity"
              label="排量(L)"
              rules={[{ required: true, message: '请输入排量' }]}
            >
              <InputNumber
                min={0}
                step={0.1}
                placeholder="例如：1.2"
                className="w-full"
              />
            </Form.Item>

            <Form.Item
              name="transmission"
              label="变速箱"
            >
              <Select
                options={transmissionTypeOptions}
                placeholder="请选择变速箱类型"
                allowClear
              />
            </Form.Item>

            <Form.Item
              name="fuelTankCapacity"
              label="油箱容量(L)"
              rules={[{ required: true, message: '请输入油箱容量' }]}
            >
              <InputNumber
                min={1}
                placeholder="例如：50"
                className="w-full"
              />
            </Form.Item>

            <Form.Item
              name="purchaseDate"
              label="购车日期"
              rules={[{ required: true, message: '请选择购车日期' }]}
              getValueFromEvent={(date: dayjs.Dayjs | null) =>
                date ? date.format('YYYY-MM-DD') : ''
              }
              getValueProps={(value: string) => ({
                value: value ? dayjs(value) : null,
              })}
            >
              <DatePicker className="w-full" placeholder="请选择购车日期" />
            </Form.Item>
          </div>

          <Form.Item className="mt-6 mb-0">
            <div className="flex gap-4 justify-end">
              <Button onClick={() => navigate('/vehicles')}>取消</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                {isEdit ? '保存修改' : '添加车辆'}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
