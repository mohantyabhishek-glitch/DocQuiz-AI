export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  provider: 'email' | 'google' | 'phone';
  createdAt: string;
}

export interface AuthResponse {
  message: string;
  token?: string;
  user?: AuthUser;
  error?: string;
  phone?: string;
  expiresInSeconds?: number;
  debugOtp?: string;
}

const API_BASE = '/api/auth';

async function handleResponse<T>(res: Response): Promise<T> {
  let data: any;
  try {
    data = await res.json();
  } catch {
    data = { error: 'Invalid response from server' };
  }

  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
  }

  return data as T;
}

export const authService = {
  async register(name: string, email: string, phone: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, password }),
    });
    return handleResponse<{ token: string; user: AuthUser }>(res);
  },

  async login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse<{ token: string; user: AuthUser }>(res);
  },

  async sendPhoneOtp(countryCode: string, phoneNumber: string): Promise<{ message: string; phone: string; expiresInSeconds: number; debugOtp?: string }> {
    const res = await fetch(`${API_BASE}/phone/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countryCode, phoneNumber }),
    });
    return handleResponse<{ message: string; phone: string; expiresInSeconds: number; debugOtp?: string }>(res);
  },

  async verifyPhoneOtp(countryCode: string, phoneNumber: string, otp: string): Promise<{ token: string; user: AuthUser }> {
    const res = await fetch(`${API_BASE}/phone/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countryCode, phoneNumber, otp }),
    });
    return handleResponse<{ token: string; user: AuthUser }>(res);
  },

  async googleAuth(params?: { email?: string; name?: string; avatarUrl?: string }): Promise<{ token: string; user: AuthUser }> {
    const res = await fetch(`${API_BASE}/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params || {}),
    });
    return handleResponse<{ token: string; user: AuthUser }>(res);
  },

  async forgotPassword(email: string): Promise<{ message: string; email: string; status: string }> {
    const res = await fetch(`${API_BASE}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return handleResponse<{ message: string; email: string; status: string }>(res);
  },

  async getMe(token: string): Promise<{ user: AuthUser }> {
    const res = await fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<{ user: AuthUser }>(res);
  },

  async logout(token?: string | null): Promise<void> {
    if (!token) return;
    try {
      await fetch(`${API_BASE}/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Ignore network errors on logout
    }
  },
};
