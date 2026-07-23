import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Select,
  InputNumber,
  DatePicker,
  Switch,
  Button,
  message,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useVehicleStore } from '@/stores/useVehicleStore';
import { useRefuelStore } from '@/stores/useRefuelStore';
import type { RefuelFormData } from '@/models/refuel';
import { FUEL_TYPES } from '@/config/constants';

const fuelTypeOptions = FUEL_TYPES.map((t) => ({ value: t, label: t }));

export default function AddRefuel() {
  const navigate = useNavigate();
  const { currentVehicleId, getCurrentVehicle, loadVehicles } = useVehicleStore();
  const { records, loadRecords, addRecord } = useRefuelStore();

  const [form] = Form.useForm<RefuelFormData>();
  const [submitting, setSubmitting] = useState(false);
  const [totalCostManual, setTotalCostManual] = useState(false);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  useEffect(() => {
    if (currentVehicleId) {
      loadRecords(currentVehicleId);
    }
  }, [currentVehicleId, loadRecords]);

  const currentVehicle = getCurrentVehicle();
  const lastRecord = records.length > 0 ? records[records.length - 1] : null;

  useEffect(() => {
    if (!currentVehicleId) return;
    form.setFieldsValue({
      date: dayjs().format('YYYY-MM-DD'),
      fuelType: currentVehicle?.fuelType || '92#',
      isFullTank: false,
      isLowFuelLight: false,
      isMissedPrevious: false,
    });
  }, [currentVehicleId, currentVehicle, form]);

  const handleTotalCostChange = useCallback(
    (value: number | null) => {
      if (value == null) return;
      setTotalCostManual(true);
      const fuelAmount = form.getFieldValue('fuelAmount');
      const unitPrice = form.getFieldValue('unitPrice');

      if (fuelAmount != null && fuelAmount > 0) {
        const newUnitPrice = Math.round((value / fuelAmount) * 1000) / 1000;
        form.setFieldsValue({ unitPrice: newUnitPrice });
      } else if (unitPrice != null && unitPrice > 0) {
        const newFuelAmount = Math.round((value / unitPrice) * 100) / 100;
        form.setFieldsValue({ fuelAmount: newFuelAmount });
      }
    },
    [form]
  );

  const handleFuelAmountChangeTriple = useCallback(
    (value: number | null) => {
      if (value == null) return;
      const unitPrice = form.getFieldValue('unitPrice');
      if (unitPrice != null && unitPrice > 0) {
        form.setFieldsValue({ totalCost: Math.round(value * unitPrice * 100) / 100 });
      }
    },
    [form]
  );

  const handleUnitPriceChangeTriple = useCallback(
    (value: number | null) => {
      if (value == null) return;
      const fuelAmount = form.getFieldValue('fuelAmount');
      if (fuelAmount != null && fuelAmount > 0) {
        form.setFieldsValue({ totalCost: Math.round(fuelAmount * value * 100) / 100 });
      }
    },
    [form]
  );

  const handleSubmit = async (values: RefuelFormData) => {
    if (!currentVehicleId) {
      message.error('请先选择车辆');
      return;
    }
    setSubmitting(true);
    try {
      await addRecord({
        ...values,
        vehicleId: currentVehicleId,
        stationName: values.stationName || '',
        note: values.note || '',
      });
      message.success('加油记录添加成功');
      navigate('/refuel');
    } catch {
      message.error('添加失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentVehicleId || !currentVehicle) {
    return (
      <div className="p-4 text-center py-20">
        <p className="text-gray-400 mb-4">请先添加车辆</p>
        <Button onClick={() => navigate('/vehicles/add')}>添加车辆</Button>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/refuel')}
        />
        <h1 className="text-lg font-bold text-gray-800 m-0">添加加油记录</h1>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        scrollToFirstError
      >
        <Card title="基本信息" className="mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0">
            <Form.Item
              name="date"
              label="加油日期"
              rules={[{ required: true, message: '请选择加油日期' }]}
              getValueFromEvent={(date: dayjs.Dayjs | null) =>
                date ? date.format('YYYY-MM-DD') : ''
              }
              getValueProps={(value: string) => ({
                value: value ? dayjs(value) : null,
              })}
            >
              <DatePicker className="w-full" />
            </Form.Item>

            <Form.Item
              name="currentMileage"
              label="当前里程(km)"
              rules={[{ required: true, message: '请输入当前里程' }]}
            >
              <InputNumber
                min={0}
                className="w-full"
                placeholder={lastRecord ? `上次里程：${lastRecord.currentMileage} km` : '请输入当前里程'}
              />
            </Form.Item>

            <Form.Item
              name="stationName"
              label="加油站名称"
            >
              <Input placeholder="例如：中石化北苑加油站" maxLength={50} />
            </Form.Item>

            <Form.Item
              name="fuelType"
              label="油品类型"
              rules={[{ required: true, message: '请选择油品类型' }]}
            >
              <Select options={fuelTypeOptions} placeholder="请选择油品类型" />
            </Form.Item>
          </div>
        </Card>

        <Card title="加油数据" className="mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-0">
            <Form.Item
              name="fuelAmount"
              label="加油量(L)"
              rules={[{ required: true, message: '请输入加油量' }]}
            >
              <InputNumber
                min={0}
                step={0.01}
                className="w-full"
                placeholder="0.00"
                onChange={handleFuelAmountChangeTriple}
              />
            </Form.Item>

            <Form.Item
              name="unitPrice"
              label="单价(元/L)"
              rules={[{ required: true, message: '请输入单价' }]}
            >
              <InputNumber
                min={0}
                step={0.01}
                className="w-full"
                placeholder={lastRecord ? `上次：${lastRecord.unitPrice.toFixed(2)}` : '0.00'}
                onChange={handleUnitPriceChangeTriple}
              />
            </Form.Item>

            <Form.Item
              name="totalCost"
              label="总金额(元)"
              rules={[{ required: true, message: '请输入总金额' }]}
            >
              <InputNumber
                min={0}
                step={0.01}
                className="w-full"
                placeholder="自动计算或手动输入"
                onChange={handleTotalCostChange}
                onFocus={() => {
                  const fa = form.getFieldValue('fuelAmount');
                  const up = form.getFieldValue('unitPrice');
                  if (fa == null && up == null) {
                    setTotalCostManual(true);
                  }
                }}
              />
            </Form.Item>
          </div>
        </Card>

        <Card title="状态标记" className="mb-4">
          <div className="flex flex-col gap-4">
            <Form.Item
              name="isFullTank"
              label="是否加满/跳枪"
              valuePropName="checked"
              className="mb-0"
            >
              <Switch />
            </Form.Item>

            <Form.Item
              name="isLowFuelLight"
              label="加油前油灯是否亮"
              valuePropName="checked"
              className="mb-0"
            >
              <Switch />
            </Form.Item>

            <Form.Item
              name="isMissedPrevious"
              label="是否漏记上次"
              valuePropName="checked"
              className="mb-0"
            >
              <Switch />
            </Form.Item>
          </div>
        </Card>

        <Card title="备注" className="mb-4">
          <Form.Item name="note" className="mb-0">
            <Input.TextArea
              rows={3}
              placeholder="记录加油时的其他信息（可选）"
              maxLength={200}
              showCount
            />
          </Form.Item>
        </Card>

        <div className="flex gap-4 justify-end">
          <Button onClick={() => navigate('/refuel')}>取消</Button>
          <Button type="primary" htmlType="submit" loading={submitting}>
            添加记录
          </Button>
        </div>
      </Form>
    </div>
  );
}
