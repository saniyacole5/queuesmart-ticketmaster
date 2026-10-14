const base = import.meta.env.VITE_API_URL || '/api';
const key = 'queuesmart-token';
export const session = {
  get: () => sessionStorage.getItem(key),
  set: token => sessionStorage.setItem(key, token),
  clear: () => sessionStorage.removeItem(key),
};
export async function api(path, { method = 'GET', body } = {}) {
  const token = session.get();
  const response = await fetch(`${base}${path}`, {
    method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json();
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/login')) window.dispatchEvent(new Event('queuesmart-session-expired'));
    const error = new Error(payload.error?.message || 'Request failed.');
    error.fields = payload.error?.fields || {}; error.status = response.status; throw error;
  }
  return payload.data;
}
