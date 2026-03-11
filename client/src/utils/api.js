import axios from 'axios';

const isLocal =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.startsWith('10.') ||
  window.location.hostname.startsWith('172.');

const BASE = isLocal
  ? `http://${window.location.hostname}:3001/api`
  : `${import.meta.env.VITE_BACKEND_URL || window.location.origin}/api`;

const api = axios.create({
  baseURL: BASE,
  withCredentials: true,
});

// Token is set externally by authStore and App.jsx — no circular import here.

// Response interceptor: auto-refresh expired access tokens
api.interceptors.response.use(
  res => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const { useAuthStore } = await import('../context/authStore');
        const { refreshToken, setTokens, logout } = useAuthStore.getState();
        if (!refreshToken) { logout(); return Promise.reject(error); }

        const { data } = await axios.post(`${BASE}/auth/refresh`, { refreshToken });
        setTokens(data.accessToken, data.refreshToken);
        original.headers['Authorization'] = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        const { useAuthStore } = await import('../context/authStore');
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default api;