const API_BASE = import.meta.env.VITE_API_BASE || '';

let authToken = null;

export function setAuthToken(token) {
  authToken = token;
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export function fetchModelInfo() {
  return request('/api/model/info');
}

export function fetchModelBenchmark() {
  return request('/api/model/benchmark');
}

export function predictLapDelta(raceState) {
  return request('/api/predict/lap-delta', {
    method: 'POST',
    body: JSON.stringify(raceState),
  });
}

export function fetchHealth() {
  return request('/api/health');
}

export async function login(username, password) {
  const res = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (res.token) {
    setAuthToken(res.token);
  }
  return res;
}

export function logout() {
  setAuthToken(null);
}

export function predictTyreDeg(state) {
  return request('/api/predict/tyre-deg', { method: 'POST', body: JSON.stringify(state) });
}

export function predictPitWindow(state) {
  return request('/api/predict/pit-window', { method: 'POST', body: JSON.stringify(state) });
}

export function getRLStrategy() {
  return request('/api/strategy/rl-agent');
}