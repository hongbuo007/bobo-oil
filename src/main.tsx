import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from '@/App';
import { seedDemoData } from '@/db/seeds';

// 初始化演示数据（仅在数据库为空时）
seedDemoData().catch(console.error);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
