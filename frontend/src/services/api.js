const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

function getToken() {
  return localStorage.getItem('medai_token') || '';
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('medai_token', token);
  } else {
    localStorage.removeItem('medai_token');
  }
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  health: () => request('/api/health'),

  // Auth & Preferences (Module 1, 6, 8)
  register: (payload) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  demoLogin: () => request('/api/auth/demo', { method: 'POST' }),
  me: () => request('/api/auth/me'),
  updatePreferences: (prefs) =>
    request('/api/auth/preferences', { method: 'PUT', body: JSON.stringify(prefs) }),

  // Reports (Modules 2, 3, 8, 13)
  listReports: () => request('/api/reports'),
  getReport: (id) => request(`/api/reports/${id}`),
  deleteReport: (id) => request(`/api/reports/${id}`, { method: 'DELETE' }),
  analyzeReport: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('/api/reports/analyze', { method: 'POST', body: fd });
  },
  createSampleReport: (variant = 'standard') =>
    request('/api/reports/sample', { method: 'POST', body: JSON.stringify({ variant }) }),

  // Dr. Sehat Chat (Modules 4, 6, 7)
  listChatSessions: () => request('/api/chat/sessions'),
  createChatSession: (payload) =>
    request('/api/chat/sessions', { method: 'POST', body: JSON.stringify(payload) }),
  getChatSession: (id) => request(`/api/chat/sessions/${id}`),
  deleteChatSession: (id) => request(`/api/chat/sessions/${id}`, { method: 'DELETE' }),
  sendChatMessage: (sessionId, payload) =>
    request(`/api/chat/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Prescription Explainer (Module 5)
  listPrescriptions: () => request('/api/prescriptions'),
  deletePrescription: (id) => request(`/api/prescriptions/${id}`, { method: 'DELETE' }),
  analyzePrescription: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('/api/prescriptions/analyze', { method: 'POST', body: fd });
  },
  createSamplePrescription: () => request('/api/prescriptions/sample', { method: 'POST' }),

  // Report Comparison (Module 9)
  listComparisons: () => request('/api/comparisons'),
  deleteComparison: (id) => request(`/api/comparisons/${id}`, { method: 'DELETE' }),
  compareReports: (previous_report_id, latest_report_id) =>
    request('/api/comparisons', {
      method: 'POST',
      body: JSON.stringify({ previous_report_id, latest_report_id }),
    }),
  createSampleBaselineReport: () =>
    request('/api/comparisons/sample-baseline', { method: 'POST' }),

  // Diet & Lifestyle Guide (Module 10)
  listLifestylePlans: () => request('/api/lifestyle'),
  generateLifestylePlan: (payload) =>
    request('/api/lifestyle/generate', { method: 'POST', body: JSON.stringify(payload) }),
  deleteLifestylePlan: (id) => request(`/api/lifestyle/${id}`, { method: 'DELETE' }),

  // Medical Dictionary (Module 11)
  featuredDictionaryTerms: () => request('/api/dictionary/featured'),
  searchDictionaryTerm: (q) => request(`/api/dictionary/search?q=${encodeURIComponent(q)}`),

  // Doctor Visit Preparation (Module 12)
  listDoctorPreps: () => request('/api/doctor-prep'),
  generateDoctorPrep: (payload) =>
    request('/api/doctor-prep/generate', { method: 'POST', body: JSON.stringify(payload) }),
  deleteDoctorPrep: (id) => request(`/api/doctor-prep/${id}`, { method: 'DELETE' }),
  findNearbyHealthcare: ({ city, lat, lon, specialty, radius_km = 6 }) => {
    const params = new URLSearchParams();
    if (city) params.set('city', city);
    if (lat != null && lon != null) {
      params.set('lat', String(lat));
      params.set('lon', String(lon));
    }
    if (specialty) params.set('specialty', specialty);
    params.set('radius_km', String(radius_km));
    return request(`/api/doctor-prep/nearby?${params.toString()}`);
  },
  listSavedDoctors: () => request('/api/doctor-prep/doctors'),
  saveDoctor: (payload) =>
    request('/api/doctor-prep/doctors', { method: 'POST', body: JSON.stringify(payload) }),
  deleteDoctor: (id) => request(`/api/doctor-prep/doctors/${id}`, { method: 'DELETE' }),
};
