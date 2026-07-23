import { create } from 'zustand';
import { db } from '@/db';

interface AuthState {
  isLoggedIn: boolean;
  isFirstTime: boolean;
  loading: boolean;
  error: string | null;

  checkAuth: () => Promise<void>;
  setPassword: (password: string) => Promise<void>;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
}

// SHA-256 哈希
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isLoggedIn: false,
  isFirstTime: true,
  loading: true,
  error: null,

  checkAuth: async () => {
    try {
      const users = await db.users.toArray();
      const hasUser = users.length > 0;
      // 检查 sessionStorage 中是否有登录标记
      const sessionAuth = sessionStorage.getItem('bobo_auth');
      set({
        isFirstTime: !hasUser,
        isLoggedIn: hasUser && sessionAuth === 'true',
        loading: false,
      });
    } catch {
      set({ isFirstTime: true, isLoggedIn: false, loading: false });
    }
  },

  setPassword: async (password: string) => {
    if (password.length < 4) {
      set({ error: '密码至少4位' });
      return;
    }
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(password);
    await db.users.add({
      id: 'default',
      passwordHash,
      createdAt: now,
      updatedAt: now,
    });
    sessionStorage.setItem('bobo_auth', 'true');
    set({ isLoggedIn: true, isFirstTime: false, error: null });
  },

  login: async (password: string) => {
    const user = await db.users.get('default');
    if (!user) {
      set({ error: '请先设置密码' });
      return false;
    }
    const inputHash = await hashPassword(password);
    if (inputHash === user.passwordHash) {
      sessionStorage.setItem('bobo_auth', 'true');
      set({ isLoggedIn: true, error: null });
      return true;
    }
    set({ error: '密码错误' });
    return false;
  },

  logout: () => {
    sessionStorage.removeItem('bobo_auth');
    set({ isLoggedIn: false });
  },

  changePassword: async (oldPassword: string, newPassword: string) => {
    if (newPassword.length < 4) {
      set({ error: '新密码至少4位' });
      return false;
    }
    const user = await db.users.get('default');
    if (!user) return false;
    const oldHash = await hashPassword(oldPassword);
    if (oldHash !== user.passwordHash) {
      set({ error: '原密码错误' });
      return false;
    }
    const newHash = await hashPassword(newPassword);
    await db.users.update('default', {
      passwordHash: newHash,
      updatedAt: new Date().toISOString(),
    });
    set({ error: null });
    return true;
  },
}));
