import axios from 'axios';

const api = axios.create({
  // O Vite usará o proxy que configuramos para mandar pro Node (porta 3000)
  baseURL: '/api' 
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;