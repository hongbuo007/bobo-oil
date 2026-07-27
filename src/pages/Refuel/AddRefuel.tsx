import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Select,
  InputNumber,
  DatePicker,
  Radio,
  Button,
  message,
} from 'antd';
import { ArrowLeftOutlined, CameraOutlined, QuestionCircleOutlined } from '@ant-design/icons';
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
  const [formValues, setFormValues] = useState<any>({});

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
      date: dayjs().format('YYYY-MM-DD HH:mm'),
      fuelType: currentVehicle?.fuelType || '92#',
      isFullTank: true,
      isLowFuelLight: false,
      isMissedPrevious: false,
    });
    setFormValues(form.getFieldsValue());
  }, [currentVehicleId, currentVehicle, form]);

  const onValuesChange = (_: any, all: any) => {
    setFormValues(all);
  };

  // 机显金额 = 机显单价 × 加油量
  const displayTotalCost = useMemo(() => {
    const unitPrice = formValues.unitPrice || 0;
    const fuelAmount = formValues.fuelAmount || 0;
    if (unitPrice > 0 && fuelAmount > 0) {
      return Math.round(unitPrice * fuelAmount * 100) / 100;
    }
    return 0;
  }, [formValues.unitPrice, formValues.fuelAmount]);

  // 实付金额 = 机显金额 - 优惠金额
  const actualCost = useMemo(() => {
    return Math.max(0, (displayTotalCost || 0) - (formValues.discount || 0));
  }, [displayTotalCost, formValues.discount]);

  // 实付单价 = 实付金额 / 加油量
  const actualUnitPrice = useMemo(() => {
    const fuelAmount = formValues.fuelAmount || 0;
    if (actualCost > 0 && fuelAmount > 0) {
      return Math.round((actualCost / fuelAmount) * 1000) / 1000;
    }
    return 0;
  }, [actualCost, formValues.fuelAmount]);

  const handleSubmit = async (values: any) => {
    if (!currentVehicleId) {
      message.error('请先选择车辆');
      return;
    }
    setSubmitting(true);
    try {
      const discount = values.discount || 0;
      const totalCost = displayTotalCost;
      const actualCostValue = totalCost - discount;
      await addRecord({
        ...values,
        vehicleId: currentVehicleId,
        stationName: values.stationName || '',
        note: values.note || '',
        totalCost,
        discount,
        actualCost: actualCostValue > 0 ? actualCostValue : 0,
      } as any);
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
    <div className="p-4 max-w-2xl mx-auto bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/refuel')}
          />
          <h1 className="text-lg font-bold text-gray-800 m-0">{currentVehicle?.name || '添加记录'}</h1>
          <QuestionCircleOutlined className="text-gray-400" />
        </div>
        <Button type="primary" onClick={() => form.submit()} loading={submitting}>
          保存
        </Button>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        onValuesChange={onValuesChange}
        scrollToFirstError
      >
        <Card className="mb-3 shadow-sm">
          <Form.Item
            name="date"
            label="加油时间"
            rules={[{ required: true, message: '请选择加油时间' }]}
            getValueFromEvent={(date: dayjs.Dayjs | null) =>
              date ? date.format('YYYY-MM-DD HH:mm') : ''
            }
            getValueProps={(value: string) => ({
              value: value ? dayjs(value) : null,
            })}
          >
            <DatePicker showTime className="w-full" format="YYYY-MM-DD HH:mm" />
          </Form.Item>

          <Form.Item
            name="currentMileage"
            label="当前里程"
            rules={[{ required: true, message: '请输入当前里程' }]}
          >
            <InputNumber
              min={0}
              className="w-full"
              placeholder="请输入里程"
              addonAfter="公里"
            />
          </Form.Item>
        </Card>

        <Card className="mb-3 shadow-sm">
          {/* 机显单价 × 加油量 = 机显金额 */}
          <div className="flex items-end gap-2 mb-4">
            <Form.Item
              name="unitPrice"
              label="机显单价"
              rules={[{ required: true, message: '请输入单价' }]}
              className="flex-1 mb-0"
            >
              <InputNumber
                min={0}
                step={0.01}
                className="w-full text-lg font-bold"
                placeholder="0.00"
                addonAfter="元/升"
              />
            </Form.Item>
            <span className="text-gray-400 pb-2">×</span>
            <Form.Item
              name="fuelAmount"
              label="加油量"
              rules={[{ required: true, message: '请输入加油量' }]}
              className="flex-1 mb-0"
            >
              <InputNumber
                min={0}
                step={0.01}
                className="w-full text-lg font-bold"
                placeholder="0.00"
                addonAfter="升"
              />
            </Form.Item>
            <span className="text-gray-400 pb-2">=</span>
            <Form.Item
              label="机显金额"
              className="flex-1 mb-0"
            >
              <InputNumber
                value={displayTotalCost}
                disabled
                className="w-full text-lg font-bold"
                addonAfter="元"
              />
            </Form.Item>
          </div>

          {/* 实付单价 / 优惠金额 / 实付金额 */}
          <div className="flex items-end gap-2">
            <Form.Item label="实付单价" className="flex-1 mb-0">
              <InputNumber
                value={actualUnitPrice}
                disabled
                className="w-full text-green-600 font-bold"
                placeholder="自动计算"
                addonAfter="元/升"
              />
            </Form.Item>
            <Form.Item
              name="discount"
              label="优惠金额"
              initialValue={0}
              className="flex-1 mb-0"
            >
              <InputNumber
                min={0}
                step={0.01}
                className="w-full"
                placeholder="0.00"
                addonAfter="元"
              />
            </Form.Item>
            <Form.Item label="实付金额" className="flex-1 mb-0">
              <InputNumber
                value={actualCost}
                disabled
                className="w-full text-green-600 font-bold"
                addonAfter="元"
              />
            </Form.Item>
          </div>
        </Card>

        <Card className="mb-3 shadow-sm">
          <Form.Item
            name="isFullTank"
            label="是否加满？"
            rules={[{ required: true }]}
            className="mb-4"
          >
            <Radio.Group buttonStyle="solid" className="w-full">
              <Radio.Button value={true} className="w-1/2 text-center">加满</Radio.Button>
              <Radio.Button value={false} className="w-1/2 text-center">没加满</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="isLowFuelLight"
            label="油量警告灯亮了吗？"
            rules={[{ required: true }]}
            className="mb-4"
          >
            <Radio.Group buttonStyle="solid" className="w-full">
              <Radio.Button value={true} className="w-1/2 text-center">油灯亮</Radio.Button>
              <Radio.Button value={false} className="w-1/2 text-center">没有亮</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="stationName"
            label="加油站"
          >
            <Input placeholder="请选择或输入加油站" />
          </Form.Item>

          <Form.Item
            name="fuelType"
            label="燃油标号"
            rules={[{ required: true }]}
          >
            <Select options={fuelTypeOptions} placeholder="请选择燃油标号" />
          </Form.Item>

          <Form.Item
            name="isMissedPrevious"
            label="上次记录了吗"
            rules={[{ required: true }]}
          >
            <Radio.Group buttonStyle="solid" className="w-full">
              <Radio.Button value={false} className="w-1/2 text-center">记录了</Radio.Button>
              <Radio.Button value={true} className="w-1/2 text-center">没记录</Radio.Button>
            </Radio.Group>
          </Form.Item>
        </Card>

        <Card className="mb-3 shadow-sm">
          <Form.Item name="note" label="备注" className="mb-0">
            <Input.TextArea
              rows={3}
              placeholder="请输入备注"
              maxLength={1000}
              showCount
            />
          </Form.Item>
          <div className="mt-4 flex flex-col items-center justify-center py-6 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 cursor-pointer hover:border-blue-300 hover:text-blue-400 transition">
            <CameraOutlined style={{ fontSize: 32 }} />
            <span className="mt-2">拍照备忘</span>
          </div>
        </Card>
      </Form>
    </div>
  );
}
