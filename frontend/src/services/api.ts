/// <reference types="vite/client" />
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const searchProducts = async (query = '') => {
  const { data } = await api.get('/products/search', { params: { q: query } });
  return data;
};

export const getTrackedProducts = async () => {
  const { data } = await api.get('/tracked-products');
  return data;
};

export const getProductHistory = async (id: number) => {
  const { data } = await api.get(`/tracked-products/${id}/history`);
  return data;
};

export const trackProduct = async (productId: number, targetPrice?: number) => {
  const { data } = await api.post('/tracked-products', { productId, targetPrice });
  return data;
};

export const untrackProduct = async (id: number) => {
  const { data } = await api.delete(`/tracked-products/${id}`);
  return data;
};

export const triggerRefresh = async (id: number) => {
  const { data } = await api.post(`/tracked-products/${id}/scrape`);
  return data;
};

export const getAlerts = async () => {
  const { data } = await api.get('/alerts');
  return data;
};

export const markAlertRead = async (id: number) => {
  const { data } = await api.patch(`/alerts/${id}`, { isRead: true });
  return data;
};

export const markAllAlertsRead = async () => {
  const { data } = await api.post('/alerts/mark-all-read');
  return data;
};

export const getSettings = async () => {
  const { data } = await api.get('/settings');
  return data;
};

export const updateSettings = async (settings: any) => {
  const { data } = await api.patch('/settings', settings);
  return data;
};

export const getActivity = async () => {
  const { data } = await api.get('/activity');
  return data;
};

export default api;
