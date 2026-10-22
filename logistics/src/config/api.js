// logistics/src/config/api.js
import axios from 'axios';

// Prioritize Vercel's env variable, then fall back directly to your live Render backend
const API_BASE_URL = 
  import.meta.env.VITE_API_URL || 'https://logistics-app-j78n.onrender.com';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Automatically attach Bearer token to all outgoing requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export { API_BASE_URL };
export default api;