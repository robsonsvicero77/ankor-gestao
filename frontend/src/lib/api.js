import axios from 'axios';
import { supabase } from './supabase';

const configuredBackendUrl = process.env.REACT_APP_BACKEND_URL?.trim();
const BACKEND_URL = configuredBackendUrl || (
  process.env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:8000'
);

if (!BACKEND_URL) {
  throw new Error('REACT_APP_BACKEND_URL must be set for production builds.');
}

const API_BASE = `${BACKEND_URL.replace(/\/+$/, '')}/api`;

// Create axios instance
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }
  if (data.session?.access_token) {
    config.headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      supabase.auth.signOut()
        .then(({ error: signOutError }) => {
          if (signOutError) {
            console.error('Error signing out after an expired session:', signOutError);
          }
        })
        .catch((signOutError) => {
          console.error('Error signing out after an expired session:', signOutError);
        });
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  getMe: () => api.get('/auth/me'),
};

// Settings and account preferences API
export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
  updateAvatar: (avatarPath) => api.put('/settings/avatar', { avatar_path: avatarPath }),
  updateOpeningBalance: (data) => api.put('/settings/opening-balance', data),
};

export const adminAccountsApi = {
  list: () => api.get('/admin/accounts'),
  delete: (accountId) => api.delete(`/admin/accounts/${accountId}`),
};

export const alertsApi = {
  upcoming: () => api.get('/alerts/upcoming'),
};

// Balance API
export const balanceApi = {
  setInitial: (data) => api.post('/balance/initial', data),
  createAdjustment: (data) => api.post('/balance/adjustment', data),
};

// Receivables API
export const receivablesApi = {
  list: (status) => api.get('/receivables', { params: { status } }),
  get: (id) => api.get(`/receivables/${id}`),
  create: (data) => api.post('/receivables', data),
  update: (id, data) => api.put(`/receivables/${id}`, data),
  delete: (id) => api.delete(`/receivables/${id}`),
  markPaid: (id) => api.post(`/receivables/${id}/mark-paid`),
};

// Payables API
export const payablesApi = {
  list: (status) => api.get('/payables', { params: { status } }),
  get: (id) => api.get(`/payables/${id}`),
  create: (data) => api.post('/payables', data),
  update: (id, data) => api.put(`/payables/${id}`, data),
  delete: (id) => api.delete(`/payables/${id}`),
  markPaid: (id) => api.post(`/payables/${id}/mark-paid`),
};

// Proposals API
export const proposalsApi = {
  list: (status) => api.get('/proposals', { params: { status_filter: status } }),
  get: (id) => api.get(`/proposals/${id}`),
  create: (data) => api.post('/proposals', data),
  update: (id, data) => api.put(`/proposals/${id}`, data),
  delete: (id) => api.delete(`/proposals/${id}`),
  updateStatus: (id, status) => api.patch(`/proposals/${id}/status`, { status }),
};

// Clients API
export const clientsApi = {
  list: () => api.get('/clients'),
  get: (id) => api.get(`/clients/${id}`),
  create: (data) => api.post('/clients', data),
  update: (id, data) => api.put(`/clients/${id}`, data),
};

// Contracts API
export const contractsApi = {
  list: (status) => api.get('/contracts', { params: { status_filter: status } }),
  get: (id) => api.get(`/contracts/${id}`),
  create: (data) => api.post('/contracts', data),
  update: (id, data) => api.put(`/contracts/${id}`, data),
  updateStatus: (id, status) => api.patch(`/contracts/${id}/status`, { status }),
};

// Dashboard API
export const dashboardApi = {
  get: () => api.get('/dashboard'),
};

// Ledger API
export const ledgerApi = {
  list: (filters = {}) => api.get('/ledger', { params: filters }),
};

// Export API
export const exportApi = {
  receivables: () => `${API_BASE}/export/receivables`,
  payables: () => `${API_BASE}/export/payables`,
  ledger: () => `${API_BASE}/export/ledger`,
  template: (type) => `${API_BASE}/import/template/${type}`,
};

// Import API
export const importApi = {
  receivables: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/receivables', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  payables: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/payables', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
};

// Reminders API
export const remindersApi = {
  send: (receivableId, customMessage) => api.post('/reminders/send', { 
    receivable_id: receivableId, 
    custom_message: customMessage 
  }),
  getUpcoming: () => api.get('/reminders/upcoming'),
  runJob: () => api.post('/jobs/send-reminders'),
};

// Onboarding API
export const onboardingApi = {
  getStatus: () => api.get('/onboarding/status'),
};

export default api;
