import { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button } from 'antd';
import {
  DashboardOutlined,
  ThunderboltOutlined,
  CarOutlined,
  SettingOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import Header from '@/components/layout/Header';

const { Sider, Content } = Layout;

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/refuel', icon: <ThunderboltOutlined />, label: '加油记录' },
  { key: '/statistics', icon: <BarChartOutlined />, label: '统计报表' },
  { key: '/vehicles', icon: <CarOutlined />, label: '车辆管理' },
  { key: '/settings', icon: <SettingOutlined />, label: '设置' },
];

const tabBarItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/refuel', icon: <ThunderboltOutlined />, label: '加油' },
  { key: '/statistics', icon: <BarChartOutlined />, label: '报表' },
  { key: '/settings', icon: <SettingOutlined />, label: '设置' },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const checkMobile = useCallback(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  useEffect(() => {
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [checkMobile]);

  const selectedKeys = [location.pathname === '/' ? '/dashboard' : `/${location.pathname.split('/')[1]}`];

  const handleMenuClick = (info: { key: string }) => {
    navigate(info.key);
  };

  if (isMobile) {
    return (
      <Layout className="min-h-screen">
        <Header />
        <Content className="flex-1 overflow-auto bg-gray-50 p-4 pb-16">
          <Outlet />
        </Content>
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex justify-around items-center h-14 safe-area-bottom">
          {tabBarItems.map((item) => {
            const isActive = selectedKeys[0] === item.key;
            return (
              <button
                key={item.key}
                onClick={() => handleMenuClick({ key: item.key })}
                className={`flex flex-col items-center justify-center flex-1 h-full text-xs gap-0.5 transition-colors ${
                  isActive ? 'text-blue-500' : 'text-gray-400'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </Layout>
    );
  }

  return (
    <Layout className="min-h-screen">
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        className="!bg-white !border-r !border-gray-100"
        width={220}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-center h-16 border-b border-gray-100">
            <span className={`font-bold text-blue-500 whitespace-nowrap ${collapsed ? 'text-lg' : 'text-xl'}`}>
              {collapsed ? '⛽' : '⛽ bobo油耗'}
            </span>
          </div>

          <Menu
            mode="inline"
            selectedKeys={selectedKeys}
            onClick={handleMenuClick}
            items={menuItems}
            className="flex-1 border-r-0 mt-2"
          />

          <div className="p-4 text-center text-xs text-gray-300 border-t border-gray-100">
            v1.0.0
          </div>
        </div>
      </Sider>

      <Layout>
        <Header />
        <Content className="flex-1 overflow-auto bg-gray-50 p-6">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
