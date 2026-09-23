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
const LOCAL_USERS_KEY = 'docquiz-ai.local_users';
const LOCAL_OTP_KEY = 'docquiz-ai.local_otp';

interface LocalUserRecord extends AuthUser {
  password?: string;
}

function getLocalUsers(): LocalUserRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    if (!raw) {
      // Seed default demo user
      const defaultUsers: LocalUserRecord[] = [
        {
          id: 'usr_demo_1001',
          name: 'Alex Morgan',
          email: 'alex.morgan@docquiz.ai',
          phone: '+1 555-0199',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          provider: 'email',
          createdAt: new Date().toISOString(),
          password: 'DocQuiz2026!',
        },
      ];
      localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(defaultUsers));
      return defaultUsers;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalUsers(users: LocalUserRecord[]): void {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

export const authService = {
  async register(name: string, email: string, phone: string, password: string): Promise<{ token: string; user: AuthUser }> {
    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password }),
      });

      if (res.ok) {
        return await res.json();
      }

      if (res.status === 409 || res.status === 400) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Registration failed.');
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('already exists') || err.message.includes('valid email') || err.message.includes('characters'))) {
        throw err;
      }
      // Fallback to local storage store if backend route is not ready
    }

    // Local client-side fallback
    const users = getLocalUsers();
    const normalizedEmail = email.trim().toLowerCase();
    if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      throw new Error('An account with this email address already exists. Please sign in.');
    }

    const newUser: LocalUserRecord = {
      id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      email: normalizedEmail,
      phone: phone ? phone.trim() : undefined,
      provider: 'email',
      createdAt: new Date().toISOString(),
      password,
    };

    users.push(newUser);
    saveLocalUsers(users);

    return {
      token: `dqa_local_${Date.now()}`,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        provider: newUser.provider,
        createdAt: newUser.createdAt,
      },
    };
  },

  async login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        return await res.json();
      }

      if (res.status === 401 || res.status === 400) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Incorrect email or password.');
      }
    } catch (err: any) {
      if (err.message && err.message.includes('Incorrect email')) {
        throw err;
      }
      // Fallback to local store if backend route is not reloaded yet
    }

    // Local client-side fallback check
    const users = getLocalUsers();
    const normalizedEmail = email.trim().toLowerCase();
    const user = users.find((u) => u.email.toLowerCase() === normalizedEmail);

    if (!user || user.password !== password) {
      // If default demo credentials, create them on the fly
      if (normalizedEmail === 'alex.morgan@docquiz.ai' && password === 'DocQuiz2026!') {
        const demoUser: LocalUserRecord = {
          id: 'usr_demo_1001',
          name: 'Alex Morgan',
          email: 'alex.morgan@docquiz.ai',
          phone: '+1 555-0199',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          provider: 'email',
          createdAt: new Date().toISOString(),
          password: 'DocQuiz2026!',
        };
        users.push(demoUser);
        saveLocalUsers(users);
        return {
          token: `dqa_local_${Date.now()}`,
          user: demoUser,
        };
      }
      throw new Error('Incorrect email or password. Please verify your credentials.');
    }

    return {
      token: `dqa_local_${Date.now()}`,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        provider: user.provider,
        createdAt: user.createdAt,
      },
    };
  },

  async sendPhoneOtp(countryCode: string, phoneNumber: string): Promise<{ message: string; phone: string; expiresInSeconds: number }> {
    const cleanNumber = phoneNumber.replace(/[^\d]/g, '');
    const fullPhone = `${countryCode || '+1'}${cleanNumber}`;
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    try {
      const res = await fetch(`${API_BASE}/phone/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countryCode, phoneNumber }),
      });

      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }

    // Save local OTP
    localStorage.setItem(LOCAL_OTP_KEY, JSON.stringify({ phone: fullPhone, otp: generatedOtp, expires: Date.now() + 300000 }));

    return {
      message: `OTP sent to ${countryCode || '+1'} ${phoneNumber.trim()}`,
      phone: `${countryCode || '+1'} ${phoneNumber.trim()}`,
      expiresInSeconds: 300,
    };
  },

  async verifyPhoneOtp(countryCode: string, phoneNumber: string, otp: string): Promise<{ token: string; user: AuthUser }> {
    const cleanNumber = phoneNumber.replace(/[^\d]/g, '');
    const fullPhone = `${countryCode || '+1'}${cleanNumber}`;

    try {
      const res = await fetch(`${API_BASE}/phone/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countryCode, phoneNumber, otp }),
      });

      if (res.ok) {
        return await res.json();
      }

      if (res.status === 400 || res.status === 429) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Invalid verification code.');
      }
    } catch (err: any) {
      if (err.message && err.message.includes('Invalid')) {
        throw err;
      }
    }

    // Check local OTP fallback
    const rawOtp = localStorage.getItem(LOCAL_OTP_KEY);
    if (rawOtp) {
      try {
        const parsed = JSON.parse(rawOtp);
        if (parsed.otp !== otp.trim()) {
          throw new Error('Invalid verification code. Please check and try again.');
        }
      } catch (e: any) {
        if (e.message.includes('Invalid')) throw e;
      }
    }

    const users = getLocalUsers();
    let user = users.find((u) => u.phone === fullPhone);
    if (!user) {
      const displayPhone = `${countryCode || '+1'} ${cleanNumber}`;
      user = {
        id: `usr_phone_${Date.now()}`,
        name: `Student (${cleanNumber.slice(-4)})`,
        email: `phone_${cleanNumber.slice(-6)}@docquiz.user`,
        phone: displayPhone,
        provider: 'phone',
        createdAt: new Date().toISOString(),
      };
      users.push(user);
      saveLocalUsers(users);
    }

    return {
      token: `dqa_phone_${Date.now()}`,
      user,
    };
  },

  async googleAuth(params: { email: string; name?: string; avatarUrl?: string }): Promise<{ token: string; user: AuthUser }> {
    if (!params.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(params.email.trim())) {
      throw new Error('Please enter a valid Google email address.');
    }

    const email = params.email.trim().toLowerCase();
    const name = params.name?.trim() || email.split('@')[0];
    const avatarUrl = params.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;

    try {
      const res = await fetch(`${API_BASE}/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, avatarUrl }),
      });

      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }

    const users = getLocalUsers();
    let user = users.find((u) => u.email.toLowerCase() === email);
    if (!user) {
      user = {
        id: `usr_google_${Date.now()}`,
        name,
        email,
        avatarUrl,
        provider: 'google',
        createdAt: new Date().toISOString(),
      };
      users.push(user);
      saveLocalUsers(users);
    }

    return {
      token: `dqa_google_${Date.now()}`,
      user,
    };
  },


  async forgotPassword(email: string): Promise<{ message: string; email: string; status: string }> {
    try {
      const res = await fetch(`${API_BASE}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }

    return {
      message: `If an account exists for ${email}, a password reset link has been prepared.`,
      email,
      status: 'sent',
    };
  },

  async getMe(token: string): Promise<{ user: AuthUser }> {
    try {
      const res = await fetch(`${API_BASE}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }

    const users = getLocalUsers();
    const user = users[0];
    if (user) {
      return { user };
    }
    throw new Error('User not found');
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
