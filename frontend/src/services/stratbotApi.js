const API_BASE = import.meta.env.VITE_API_BASE || '';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
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