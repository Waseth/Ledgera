const BASE = process.env.REACT_APP_API_URL || '';

let authToken = localStorage.getItem('auth_token');
let currentUser = JSON.parse(localStorage.getItem('ledgera-user') || 'null');
let isRefreshing = false;
let refreshSubscribers = [];

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

function onTokenRefreshed(token) {
  refreshSubscribers.forEach(callback => callback(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(callback) {
  refreshSubscribers.push(callback);
}

async function refreshToken() {
  if (!authToken) return null;

  try {
    const response = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
        authToken = data.token;
        return data.token;
      }
    }
    return null;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return null;
  }
}

async function request(method, path, body, requiresAuth = true, retryCount = 0) {
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

    // Handle token expiry - attempt to refresh once
    if (res.status === 401 && requiresAuth && retryCount === 0) {
      console.log('Token expired, attempting to refresh...');

      // Try to refresh the token
      const newToken = await refreshToken();

      if (newToken) {
        console.log('Token refreshed successfully, retrying request...');
        // Retry the original request with the new token
        return request(method, path, body, requiresAuth, retryCount + 1);
      } else {
        // Refresh failed, clear session and redirect to login
        console.log('Token refresh failed, redirecting to login...');
        setAuthToken(null, null);
        window.location.href = '/login';
        throw new Error('Session expired. Please login again.');
      }
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

// Function to check if token is about to expire and refresh proactively
export function setupTokenRefresh() {
  const token = localStorage.getItem('auth_token');
  if (!token) return;

  try {
    // Decode token to check expiration
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expTime = payload.exp * 1000; // Convert to milliseconds
    const currentTime = Date.now();
    const timeUntilExpiry = expTime - currentTime;

    // If token expires in less than 1 hour, refresh it proactively
    if (timeUntilExpiry < 60 * 60 * 1000 && timeUntilExpiry > 0) {
      console.log('Token expiring soon, refreshing proactively...');
      refreshToken().then(newToken => {
        if (newToken && currentUser) {
          localStorage.setItem('auth_token', newToken);
          authToken = newToken;
        }
      });
    }
  } catch (e) {
    console.error('Failed to decode token:', e);
  }
}

// Set up proactive token refresh on page load
if (typeof window !== 'undefined') {
  setupTokenRefresh();
  // Also set up periodic check every 5 minutes
  setInterval(setupTokenRefresh, 5 * 60 * 1000);
}

export const api = {
  get: (path, requiresAuth = true) => request('GET', path, undefined, requiresAuth),
  post: (path, body, requiresAuth = true) => request('POST', path, body, requiresAuth),
  put: (path, body, requiresAuth = true) => request('PUT', path, body, requiresAuth),
  delete: (path, requiresAuth = true) => request('DELETE', path, undefined, requiresAuth),
  login,
  logout,
  getCurrentUser,
  setAuthToken,
  refreshToken,
};