import axios from 'axios';
import useAssembleiaStore from '../store/useAssembleiaStore';

const API_BASE_URL = window.ENV_CONFIG?.API_URL || import.meta.env.VITE_API_URL || '';

const client = axios.create({
  baseURL: API_BASE_URL,
});

client.interceptors.request.use((config) => {
  const token = useAssembleiaStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default client;
