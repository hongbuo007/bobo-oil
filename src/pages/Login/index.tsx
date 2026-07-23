import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Typography, message, Spin } from 'antd';
import { LockOutlined, CarOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores/useAuthStore';

const { Title, Text } = Typography;

export default function LoginPage() {
  const { isFirstTime, loading, error, checkAuth, setPassword, login } = useAuthStore();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleSetPassword = async (values: { password: string; confirm: string }) => {
    if (values.password !== values.confirm) {
      message.error('两次密码不一致');
      return;
    }
    setSubmitting(true);
    await setPassword(values.password);
    setSubmitting(false);
  };

  const handleLogin = async (values: { password: string }) => {
    setSubmitting(true);
    const success = await login(values.password);
    setSubmitting(false);
    if (!success) {
      message.error('密码错误');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <Card className="w-full max-w-sm shadow-lg" styles={{ body: { padding: '32px' } }}>
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">⛽</div>
          <Title level={3} className="!mb-1">bobo油耗</Title>
          <Text type="secondary">车辆油耗管理系统</Text>
        </div>

        {isFirstTime ? (
          /* 首次设置密码 */
          <Form onFinish={handleSetPassword} layout="vertical" size="large">
            <div className="text-center mb-4">
              <Text>首次使用，请设置登录密码</Text>
            </div>
            <Form.Item
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 4, message: '密码至少4位' },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined className="text-gray-300" />}
                placeholder="设置密码（至少4位）"
              />
            </Form.Item>
            <Form.Item
              name="confirm"
              rules={[
                { required: true, message: '请确认密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次密码不一致'));
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined className="text-gray-300" />}
                placeholder="确认密码"
              />
            </Form.Item>
            <Form.Item className="!mb-0">
              <Button type="primary" htmlType="submit" block loading={submitting}>
                设置密码并进入
              </Button>
            </Form.Item>
          </Form>
        ) : (
          /* 登录 */
          <Form onFinish={handleLogin} layout="vertical" size="large">
            <div className="text-center mb-4">
              <Text>请输入登录密码</Text>
            </div>
            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined className="text-gray-300" />}
                placeholder="请输入密码"
                autoFocus
              />
            </Form.Item>
            <Form.Item className="!mb-0">
              <Button type="primary" htmlType="submit" block loading={submitting}>
                登录
              </Button>
            </Form.Item>
          </Form>
        )}
      </Card>
    </div>
  );
}
