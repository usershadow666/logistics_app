const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://logistics-app-j78n.onrender.com',
});
