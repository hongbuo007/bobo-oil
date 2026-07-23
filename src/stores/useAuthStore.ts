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

// 纯 JS SHA-256 实现（不依赖 crypto.subtle，支持 HTTP 环境）
function sha256(message: string): string {
  function rotateRight(n: number, x: number): number {
    return (x >>> n) | (x << (32 - n));
  }

  const K: number[] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const utf8Encode = new TextEncoder().encode(message);
  const bitLength = utf8Encode.length * 8;

  // Padding
  const paddedLength = Math.ceil((utf8Encode.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(utf8Encode);
  padded[utf8Encode.length] = 0x80;

  // Append length in bits as 64-bit big-endian integer
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 4, bitLength, false);

  let H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  for (let i = 0; i < padded.length; i += 64) {
    const w = new Uint32Array(64);
    for (let t = 0; t < 16; t++) {
      w[t] = view.getUint32(i + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotateRight(7, w[t - 15]) ^ rotateRight(18, w[t - 15]) ^ (w[t - 15] >>> 3);
      const s1 = rotateRight(17, w[t - 2]) ^ rotateRight(19, w[t - 2]) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H;

    for (let t = 0; t < 64; t++) {
      const S1 = rotateRight(6, e) ^ rotateRight(11, e) ^ rotateRight(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
      const S0 = rotateRight(2, a) ^ rotateRight(13, a) ^ rotateRight(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  return H.map((h) => h.toString(16).padStart(8, '0')).join('');
}

function hashPassword(password: string): string {
  return sha256(password);
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
      const sessionAuth = sessionStorage.getItem('bobo_auth');
      set({
        isFirstTime: !hasUser,
        isLoggedIn: hasUser && sessionAuth === 'true',
        loading: false,
      });
    } catch (err) {
      console.error('checkAuth error', err);
      set({ isFirstTime: true, isLoggedIn: false, loading: false });
    }
  },

  setPassword: async (password: string) => {
    if (password.length < 4) {
      set({ error: '密码至少4位' });
      return;
    }
    try {
      const now = new Date().toISOString();
      const passwordHash = hashPassword(password);
      await db.users.add({
        id: 'default',
        passwordHash,
        createdAt: now,
        updatedAt: now,
      });
      sessionStorage.setItem('bobo_auth', 'true');
      set({ isLoggedIn: true, isFirstTime: false, error: null });
    } catch (err) {
      console.error('setPassword error', err);
      set({ error: '设置密码失败' });
    }
  },

  login: async (password: string) => {
    try {
      const user = await db.users.get('default');
      if (!user) {
        set({ error: '请先设置密码' });
        return false;
      }
      const inputHash = hashPassword(password);
      if (inputHash === user.passwordHash) {
        sessionStorage.setItem('bobo_auth', 'true');
        set({ isLoggedIn: true, error: null });
        return true;
      }
      set({ error: '密码错误' });
      return false;
    } catch (err) {
      console.error('login error', err);
      set({ error: '登录失败' });
      return false;
    }
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
    try {
      const user = await db.users.get('default');
      if (!user) return false;
      const oldHash = hashPassword(oldPassword);
      if (oldHash !== user.passwordHash) {
        set({ error: '原密码错误' });
        return false;
      }
      const newHash = hashPassword(newPassword);
      await db.users.update('default', {
        passwordHash: newHash,
        updatedAt: new Date().toISOString(),
      });
      set({ error: null });
      return true;
    } catch (err) {
      console.error('changePassword error', err);
      set({ error: '修改密码失败' });
      return false;
    }
  },
}));
