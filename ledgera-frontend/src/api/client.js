const BASE = process.env.REACT_APP_API_URL || '';

async function request(method, path, body) {
  const opts = {
    method,
    credentials: 'include',
    headers: {},
  };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE}${path}`, opts);

  // Handle session expiry
  if (res.status === 401) {
    localStorage.removeItem('ledgera-user');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data.error || (data.errors && data.errors.join(' ')) || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  // Automatically extract data if it's a common response format
  // If the response has a 'data' property that is an array or object, return that
  // Otherwise return the whole response
  if (data.data !== undefined) {
    return data.data;
  }

  // Handle paginated responses
  if (data.items !== undefined && Array.isArray(data.items)) {
    return data.items;
  }

  // Handle responses with results array
  if (data.results !== undefined && Array.isArray(data.results)) {
    return data.results;
  }

  return data;
}

export const api = {
  get:    (path)        => request('GET',  path),
  post:   (path, body)  => request('POST', path, body),
  delete: (path)        => request('DELETE', path),
};