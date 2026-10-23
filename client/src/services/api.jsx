import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('wm_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const token = localStorage.getItem('wm_token');
    // Ignore failures from requests belonging to an account that has since logged out.
    if (error.response?.status === 401 && token
      && error.config?.headers?.Authorization === `Bearer ${token}`) {
      window.dispatchEvent(new Event('wm-session-expired'));
    }
    return Promise.reject(error);
  }
);

export default api;
