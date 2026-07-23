// API 请求封装
// 后端地址：同域部署时为空，独立部署时设置完整 URL
const API_BASE = '/api';

let authToken: string | null = localStorage.getItem('bobo_token');

export function setToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('bobo_token', token);
  } else {
    localStorage.removeItem('bobo_token');
  }
}

export function getToken(): string | null {
  return authToken || localStorage.getItem('bobo_token');
}

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || '请求失败');
  }

  return data;
}

// 检查后端是否可用
let serverAvailable: boolean | null = null;

export async function checkServer(): Promise<boolean> {
  if (serverAvailable !== null) return serverAvailable;
  try {
    const res = await fetch(`${API_BASE}/auth/status`, { signal: AbortSignal.timeout(3000) });
    serverAvailable = res.ok;
  } catch {
    serverAvailable = false;
  }
  return serverAvailable;
}

export async function resetServerCheck() {
  serverAvailable = null;
}

// Auth API
export const authApi = {
  status: () => request('/auth/status'),
  register: (password: string) => request('/auth/register', { method: 'POST', body: JSON.stringify({ password }) }),
  login: (password: string) => request('/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
  changePassword: (oldPassword: string, newPassword: string) =>
    request('/auth/password', { method: 'PUT', body: JSON.stringify({ oldPassword, newPassword }) }),
};

// Vehicles API
export const vehiclesApi = {
  list: () => request('/vehicles'),
  create: (data: any) => request('/vehicles', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request(`/vehicles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => request(`/vehicles/${id}`, { method: 'DELETE' }),
};

// Refuels API
export const refuelsApi = {
  list: (vehicleId?: string) => request(`/refuels${vehicleId ? `?vehicleId=${vehicleId}` : ''}`),
  create: (data: any) => request('/refuels', { method: 'POST', body: JSON.stringify(data) }),
  import: (records: any[]) => request('/refuels/import', { method: 'POST', body: JSON.stringify({ records }) }),
  update: (id: string, data: any) => request(`/refuels/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => request(`/refuels/${id}`, { method: 'DELETE' }),
};
