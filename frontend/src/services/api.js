import axios from 'axios';


const API_BASE_URL = '';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Items API ──────────────────────────────────────────────────────────────────

export const fetchItems = async (search = '', status = '') => {
  const params = {};
  if (search) params.search = search;
  if (status) params.status = status;
  const { data } = await api.get('/api/items', { params });
  return data;
};

export const fetchItem = async (id) => {
  const { data } = await api.get(`/api/items/${id}`);
  return data;
};

export const createItem = async (item) => {
  const { data } = await api.post('/api/items', item);
  return data;
};

export const updateItem = async (id, item) => {
  const { data } = await api.put(`/api/items/${id}`, item);
  return data;
};

export const deleteItem = async (id) => {
  const { data } = await api.delete(`/api/items/${id}`);
  return data;
};

export default api;
