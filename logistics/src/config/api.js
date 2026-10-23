export const API_BASE_URL =
  typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? (import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:5000')
    : (import.meta.env.VITE_API_URL || 'https://logistics-app-j78n.onrender.com');

// Helper to prevent mixed content errors from legacy local DB entries
export const getSafeImageUrl = (url) => {
  if (!url) return '/placeholder.png';
  if (url.includes('localhost:5000')) {
    return `${API_BASE_URL}${url.split('localhost:5000')[1]}`;
  }
  if (url.startsWith('/uploads')) {
    return `${API_BASE_URL}${url}`;
  }
  return url;
};

export default API_BASE_URL;