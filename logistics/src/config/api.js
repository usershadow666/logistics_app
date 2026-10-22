export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'https://logistics-app-j78n.onrender.com';

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