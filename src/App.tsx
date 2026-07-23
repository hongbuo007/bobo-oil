import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Spin } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppLayout from '@/components/layout/AppLayout';
import { useAuthStore } from '@/stores/useAuthStore';
import { useVehicleStore } from '@/stores/useVehicleStore';

const LoginPage = lazy(() => import('@/pages/LoginPage'));
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
    <div className="flex items-center justify-center min-h-screen">
      <Spin size="large" />
    </div>
  );
}

function ProtectedRoutes() {
  const loadVehicles = useVehicleStore((s) => s.loadVehicles);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  return (
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
  );
}

export default function App() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const loading = useAuthStore((s) => s.loading);
  const checkAuth = useAuthStore((s) => s.checkAuth);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (loading) {
    return (
      <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#1890FF' } }}>
        <Loading />
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{ token: { colorPrimary: '#1890FF' } }}
    >
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="*"
              element={
                isLoggedIn ? <ProtectedRoutes /> : <Navigate to="/login" replace />
              }
            />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ConfigProvider>
  );
}
