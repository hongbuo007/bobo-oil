import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppLayout from '@/components/layout/AppLayout';
import { useVehicleStore } from '@/stores/useVehicleStore';

const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const VehicleListPage = lazy(() => import('@/pages/VehicleListPage'));
const VehicleFormPage = lazy(() => import('@/pages/VehicleFormPage'));
const RefuelPage = lazy(() => import('@/pages/RefuelPage'));
const AddRefuelPage = lazy(() => import('@/pages/AddRefuelPage'));
const RefuelDetailPage = lazy(() => import('@/pages/RefuelDetailPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const StatisticsPage = lazy(() => import('@/pages/StatisticsPage'));

function Loading() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <span className="text-gray-400">加载中...</span>
    </div>
  );
}

export default function App() {
  const loadVehicles = useVehicleStore((s) => s.loadVehicles);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1890FF',
        },
      }}
    >
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/vehicles" element={<VehicleListPage />} />
              <Route path="/vehicles/add" element={<VehicleFormPage />} />
              <Route path="/vehicles/:id/edit" element={<VehicleFormPage />} />
              <Route path="/refuel" element={<RefuelPage />} />
              <Route path="/refuel/add" element={<AddRefuelPage />} />
              <Route path="/refuel/:id" element={<RefuelDetailPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/statistics" element={<StatisticsPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ConfigProvider>
  );
}
