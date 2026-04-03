const BASE = process.env.REACT_APP_API_URL || '';

let authToken = localStorage.getItem('auth_token');
let currentUser = JSON.parse(localStorage.getItem('ledgera-user') || 'null');

function setAuthToken(token, user) {
  authToken = token;
  if (token && user) {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('ledgera-user', JSON.stringify(user));
    currentUser = user;
  } else {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('ledgera-user');
    currentUser = null;
  }
}

function getCurrentUser() {
  return currentUser;
}

async function request(method, path, body, requiresAuth = true) {
  // Don't make authenticated requests if no token and requiresAuth is true
  if (requiresAuth && !authToken) {
    throw new Error('No authentication token');
  }

  const headers = {
    'Content-Type': 'application/json',
  };

  if (requiresAuth && authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const opts = {
    method,
    headers,
  };

  if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(`${BASE}${path}`, opts);

    // Handle token expiry - don't redirect, just throw error
    if (res.status === 401) {
      setAuthToken(null, null);
      throw new Error('Session expired. Please login again.');
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data.error || (data.errors && data.errors.join(' ')) || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return data;
  } catch (err) {
    if (err.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your connection.');
    }
    throw err;
  }
}

// Special login function that handles token storage
async function login(email, password) {
  const data = await request('POST', '/auth/login', { email, password }, false);

  if (data.token && data.user) {
    setAuthToken(data.token, data.user);
  }

  return data;
}

async function logout() {
  try {
    await request('POST', '/auth/logout', {}, true);
  } catch (err) {
    console.error('Logout error:', err);
  } finally {
    setAuthToken(null, null);
  }
}

export const api = {
  get: (path, requiresAuth = true) => request('GET', path, undefined, requiresAuth),
  post: (path, body, requiresAuth = true) => request('POST', path, body, requiresAuth),
  put: (path, body, requiresAuth = true) => request('PUT', path, body, requiresAuth),  // ADD THIS LINE
  delete: (path, requiresAuth = true) => request('DELETE', path, undefined, requiresAuth),
  login,
  logout,
  getCurrentUser,
  setAuthToken,
};