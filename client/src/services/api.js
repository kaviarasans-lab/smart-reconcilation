import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  getUsers: () => api.get('/auth/users'),
};

// Upload
export const uploadAPI = {
  upload: (formData) =>
    api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getAll: (params) => api.get('/upload', { params }),
  getPreview: (id) => api.get(`/upload/${id}/preview`),
  saveMapping: (id, mapping) => api.put(`/upload/${id}/mapping`, { mapping }),
  getStatus: (id) => api.get(`/upload/${id}/status`),
};

// Reconciliation
export const reconciliationAPI = {
  run: (uploadJobId) => api.post(`/reconciliation/run/${uploadJobId}`),
  getResults: (uploadJobId, params) => api.get(`/reconciliation/${uploadJobId}`, { params }),
  getSummary: (uploadJobId) => api.get(`/reconciliation/${uploadJobId}/summary`),
  resolve: (id, data) => api.put(`/reconciliation/${id}/resolve`, data),
};

// Dashboard
export const dashboardAPI = {
  getSummary: (params) => api.get('/dashboard/summary', { params }),
  getChart: (params) => api.get('/dashboard/chart', { params }),
  getFilters: () => api.get('/dashboard/filters'),
};

// Audit
export const auditAPI = {
  getEntityAudit: (entityId) => api.get(`/audit/entity/${entityId}`),
  getAll: (params) => api.get('/audit', { params }),
};

export default api;
