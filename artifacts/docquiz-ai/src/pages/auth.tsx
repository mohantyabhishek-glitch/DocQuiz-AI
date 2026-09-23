import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Lock,
  Mail,
  User,
  Phone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  X,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth-context';

type AuthView = 'login' | 'register' | 'phone-step1' | 'phone-step2' | 'forgot-password' | 'forgot-success';

const COUNTRY_CODES = [
  { code: '+1', country: 'US / CA', flag: '🇺🇸' },
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+81', country: 'Japan', flag: '🇯🇵' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
];

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="shrink-0" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function calculatePasswordStrength(pass: string): { score: number; label: string; color: string } {
  if (!pass) return { score: 0, label: '', color: 'bg-muted' };
  let score = 0;
  if (pass.length >= 6) score += 1;
  if (pass.length >= 10) score += 1;
  if (/[A-Z]/.test(pass)) score += 1;
  if (/[0-9]/.test(pass)) score += 1;
  if (/[^A-Za-z0-9]/.test(pass)) score += 1;

  if (score <= 2) return { score: 1, label: 'Weak', color: 'bg-destructive' };
  if (score <= 3) return { score: 2, label: 'Medium', color: 'bg-amber-500' };
  return { score: 3, label: 'Strong', color: 'bg-emerald-500' };
}

export default function AuthPage({ initialView = 'login' }: { initialView?: AuthView }) {
  const [, setLocation] = useLocation();
  const { login, register, sendPhoneOtp, verifyPhoneOtp, loginWithGoogle, demoLogin, forgotPassword, isAuthenticated } =
    useAuth();

  const [view, setView] = useState<AuthView>(initialView);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Phone state
  const [countryCode, setCountryCode] = useState('+1');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resendCountdown, setResendCountdown] = useState(30);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Real Google Sign-in Modal state
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState('');
  const [googleNameInput, setGoogleNameInput] = useState('');

  // Forgot Password state
  const [forgotEmail, setForgotEmail] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setLocation('/');
    }
  }, [isAuthenticated, setLocation]);

  // Handle URL route changes matching initialView
  useEffect(() => {
    setView(initialView);
    setErrorMessage('');
    setSuccessMessage('');
  }, [initialView]);

  // Resend Countdown timer for Phone OTP
  useEffect(() => {
    if (view !== 'phone-step2' || resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [view, resendCountdown]);

  const switchView = (newView: AuthView) => {
    setErrorMessage('');
    setSuccessMessage('');
    setView(newView);
  };

  // --- Handlers ---

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!loginEmail.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!loginPassword) {
      setErrorMessage('Please enter your password.');
      return;
    }

    try {
      setLoading(true);
      await login(loginEmail.trim(), loginPassword);
      setSuccessMessage('Welcome back! Redirecting to study desk…');
      setTimeout(() => setLocation('/'), 400);
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to sign in. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!regName.trim() || regName.trim().length < 2) {
      setErrorMessage('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!regEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (regPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter your password.');
      return;
    }

    try {
      setLoading(true);
      await register(regName.trim(), regEmail.trim(), regPhone.trim(), regPassword);
      setSuccessMessage('Account created successfully! Taking you to your study desk…');
      setTimeout(() => setLocation('/'), 400);
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const clean = phoneNumber.replace(/[^\d]/g, '');
    if (clean.length < 7 || clean.length > 15) {
      setErrorMessage('Please enter a valid phone number (7 to 15 digits).');
      return;
    }

    try {
      setLoading(true);
      await sendPhoneOtp(countryCode, phoneNumber.trim());
      setResendCountdown(30);
      setOtp(['', '', '', '', '', '']);
      switchView('phone-step2');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to send OTP code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Pasting multi-digit code
      const digits = value.replace(/[^\d]/g, '').slice(0, 6).split('');
      const newOtp = [...otp];
      digits.forEach((d, i) => {
        newOtp[i] = d;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(digits.length, 5);
      otpInputRefs.current[nextIndex]?.focus();
      return;
    }

    const digit = value.replace(/[^\d]/g, '');
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyPhoneOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const fullOtp = otp.join('');
    if (fullOtp.length < 6) {
      setErrorMessage('Please enter all 6 digits of the SMS verification code.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      await verifyPhoneOtp(countryCode, phoneNumber.trim(), fullOtp);
      setSuccessMessage('Phone verified! Loading your study desk…');
      setTimeout(() => setLocation('/'), 400);
    } catch (err: any) {
      setErrorMessage(err.message || 'Incorrect verification code. Please check your SMS and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleEmailInput.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(googleEmailInput.trim())) {
      setErrorMessage('Please enter your valid Google / Gmail address.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      setShowGoogleModal(false);
      await loginWithGoogle({
        email: googleEmailInput.trim(),
        name: googleNameInput.trim() || googleEmailInput.trim().split('@')[0],
      });
      setSuccessMessage(`Signed in as ${googleEmailInput.trim()}! Loading your desk…`);
      setTimeout(() => setLocation('/'), 400);
    } catch (err: any) {
      setErrorMessage(err.message || 'Google sign-in could not be completed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      await demoLogin();
      setSuccessMessage('Welcome Alex! Loading study desk…');
      setTimeout(() => setLocation('/'), 400);
    } catch (err: any) {
      setErrorMessage(err.message || 'Demo login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!forgotEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    try {
      setLoading(true);
      await forgotPassword(forgotEmail.trim());
      switchView('forgot-success');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit reset request.');
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = calculatePasswordStrength(regPassword);

  return (
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-background px-4 py-8 sm:px-6 md:py-12">
      {/* Background Animated Gradient Blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="ink-grid absolute inset-0 opacity-40" />
        <motion.div
          animate={{
            x: [0, 25, -20, 0],
            y: [0, -30, 20, 0],
            scale: [1, 1.08, 0.95, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-[hsl(var(--accent)/.22)] blur-3xl"
        />
        <motion.div
          animate={{
            x: [0, -30, 20, 0],
            y: [0, 25, -30, 0],
            scale: [1, 0.92, 1.06, 1],
          }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-[hsl(var(--primary)/.16)] blur-3xl"
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-[hsl(var(--secondary)/.05)] blur-3xl" />
      </div>

      {/* Main Auth Container Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-[440px]"
      >
        {/* Brand Header */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2.5">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))] shadow-md">
              <BookOpen size={20} strokeWidth={2.2} />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[hsl(var(--accent))] ring-2 ring-background" />
            </span>
            <div className="text-left">
              <span className="block text-lg font-bold tracking-tight text-foreground">
                DocQuiz <span className="text-primary">AI</span>
              </span>
              <span className="font-mono-ui block text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                active recall desk
              </span>
            </div>
          </div>
        </div>

        {/* Card Body */}
        <div className="overflow-hidden rounded-[26px] border border-border bg-card p-6 shadow-2xl paper-shadow sm:p-8">
          <AnimatePresence mode="wait">
            {/* 1. LOGIN VIEW */}
            {view === 'login' && (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.24, ease: 'easeInOut' }}
              >
                <div className="mb-6">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome back 👋</h1>
                  <p className="mt-1 text-xs text-muted-foreground">Sign in to continue to DocQuiz AI.</p>
                </div>

                {errorMessage && (
                  <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    <AlertCircle size={15} className="mt-0.5 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {successMessage && (
                  <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={15} className="shrink-0" />
                    <span>{successMessage}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-foreground" htmlFor="login-email">
                      Email address
                    </label>
                    <div className="relative flex items-center">
                      <Mail size={15} className="absolute left-3.5 text-muted-foreground pointer-events-none" />
                      <input
                        id="login-email"
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="name@example.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3.5 text-sm text-foreground transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground" htmlFor="login-password">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => switchView('forgot-password')}
                        className="text-[11px] font-semibold text-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative flex items-center">
                      <Lock size={15} className="absolute left-3.5 text-muted-foreground pointer-events-none" />
                      <input
                        id="login-password"
                        type={showLoginPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-10 text-sm text-foreground transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-3 text-muted-foreground hover:text-foreground"
                        aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                      >
                        {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md transition-all hover:bg-primary/95 disabled:opacity-50"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    <span>{loading ? 'Signing in…' : 'Login'}</span>
                  </motion.button>
                </form>

                {/* Divider */}
                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="font-mono-ui text-[10px] uppercase tracking-wider text-muted-foreground">OR</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {/* Social & Alternative Auth */}
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => setShowGoogleModal(true)}
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-background py-2.5 text-xs font-bold text-foreground transition-all hover:border-primary/40 hover:bg-muted/40"
                  >
                    <GoogleIcon />
                    <span>Continue with Google</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => switchView('phone-step1')}
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background py-2.5 text-xs font-bold text-foreground transition-all hover:border-primary/40 hover:bg-muted/40"
                  >
                    <Phone size={15} className="text-muted-foreground" />
                    <span>Continue with Phone Number</span>
                  </button>

                  {/* 1-Click Demo Test Pill */}
                  <button
                    type="button"
                    onClick={handleDemoLogin}
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[hsl(var(--accent)/.5)] bg-[hsl(var(--accent)/.12)] py-2 text-[11px] font-bold text-foreground transition-colors hover:bg-[hsl(var(--accent)/.25)]"
                  >
                    <span>⚡ Quick Demo Account</span>
                    <span className="text-muted-foreground font-normal">(alex.morgan@docquiz.ai)</span>
                  </button>
                </div>

                <p className="mt-6 text-center text-xs text-muted-foreground">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchView('register')}
                    className="font-bold text-primary hover:underline"
                  >
                    Create account
                  </button>
                </p>
              </motion.div>
            )}

            {/* 2. CREATE ACCOUNT (REGISTER) VIEW */}
            {view === 'register' && (
              <motion.div
                key="register"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.24, ease: 'easeInOut' }}
              >
                <div className="mb-6">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Create your DocQuiz AI account 🚀
                  </h1>
                  <p className="mt-1 text-xs text-muted-foreground">Create an account and start learning smarter.</p>
                </div>

                {errorMessage && (
                  <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    <AlertCircle size={15} className="mt-0.5 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <form onSubmit={handleRegister} className="space-y-3.5">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground" htmlFor="reg-name">
                      Full name
                    </label>
                    <div className="relative flex items-center">
                      <User size={15} className="absolute left-3.5 text-muted-foreground pointer-events-none" />
                      <input
                        id="reg-name"
                        type="text"
                        required
                        placeholder="Alex Morgan"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        className="w-full rounded-xl border border-border bg-background py-2 pl-10 pr-3.5 text-sm text-foreground transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground" htmlFor="reg-email">
                      Email address
                    </label>
                    <div className="relative flex items-center">
                      <Mail size={15} className="absolute left-3.5 text-muted-foreground pointer-events-none" />
                      <input
                        id="reg-email"
                        type="email"
                        required
                        placeholder="name@example.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="w-full rounded-xl border border-border bg-background py-2 pl-10 pr-3.5 text-sm text-foreground transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground" htmlFor="reg-phone">
                      Phone number <span className="text-[10px] text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <div className="relative flex items-center">
                      <Phone size={15} className="absolute left-3.5 text-muted-foreground pointer-events-none" />
                      <input
                        id="reg-phone"
                        type="tel"
                        placeholder="+1 555-0199"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        className="w-full rounded-xl border border-border bg-background py-2 pl-10 pr-3.5 text-sm text-foreground transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground" htmlFor="reg-password">
                      Create password
                    </label>
                    <div className="relative flex items-center">
                      <Lock size={15} className="absolute left-3.5 text-muted-foreground pointer-events-none" />
                      <input
                        id="reg-password"
                        type={showRegPassword ? 'text' : 'password'}
                        required
                        placeholder="Min 6 characters"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="w-full rounded-xl border border-border bg-background py-2 pl-10 pr-10 text-sm text-foreground transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3 text-muted-foreground hover:text-foreground"
                      >
                        {showRegPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {/* Password Strength Indicator */}
                    {regPassword && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex h-1 flex-1 gap-1">
                          {[1, 2, 3].map((step) => (
                            <div
                              key={step}
                              className={`h-full flex-1 rounded-full transition-all ${
                                step <= passwordStrength.score ? passwordStrength.color : 'bg-muted'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="font-mono-ui text-[10px] text-muted-foreground">
                          {passwordStrength.label}
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground" htmlFor="reg-confirm">
                      Confirm password
                    </label>
                    <div className="relative flex items-center">
                      <Lock size={15} className="absolute left-3.5 text-muted-foreground pointer-events-none" />
                      <input
                        id="reg-confirm"
                        type={showRegPassword ? 'text' : 'password'}
                        required
                        placeholder="Re-type password"
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        className={`w-full rounded-xl border bg-background py-2 pl-10 pr-3.5 text-sm text-foreground transition-all placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 ${
                          regConfirmPassword && regConfirmPassword !== regPassword
                            ? 'border-destructive focus:ring-destructive/20'
                            : 'border-border focus:border-primary focus:ring-primary/20'
                        }`}
                      />
                    </div>
                    {regConfirmPassword && regConfirmPassword !== regPassword && (
                      <p className="mt-1 text-[11px] text-destructive">Passwords do not match.</p>
                    )}
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    type="submit"
                    disabled={loading}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md transition-all hover:bg-primary/95 disabled:opacity-50"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    <span>{loading ? 'Creating account…' : 'Create Account'}</span>
                  </motion.button>
                </form>

                {/* Divider */}
                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="font-mono-ui text-[10px] uppercase tracking-wider text-muted-foreground">OR</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {/* Social Auth */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setShowGoogleModal(true)}
                    disabled={loading}
                    className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background py-2.5 text-xs font-bold text-foreground transition-all hover:border-primary/40 hover:bg-muted/40"
                  >
                    <GoogleIcon />
                    <span>Google</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => switchView('phone-step1')}
                    disabled={loading}
                    className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background py-2.5 text-xs font-bold text-foreground transition-all hover:border-primary/40 hover:bg-muted/40"
                  >
                    <Phone size={14} className="text-muted-foreground" />
                    <span>Phone</span>
                  </button>
                </div>

                <p className="mt-5 text-center text-xs text-muted-foreground">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchView('login')}
                    className="font-bold text-primary hover:underline"
                  >
                    Sign in
                  </button>
                </p>
              </motion.div>
            )}

            {/* 3. PHONE AUTH - STEP 1 (ENTER PHONE) */}
            {view === 'phone-step1' && (
              <motion.div
                key="phone-step1"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.24, ease: 'easeInOut' }}
              >
                <button
                  type="button"
                  onClick={() => switchView('login')}
                  className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft size={14} /> Back to email sign in
                </button>

                <div className="mb-6">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Continue with Phone Number 📱
                  </h1>
                  <p className="mt-1 text-xs text-muted-foreground">
                    We will send a 6-digit one-time code to verify your device via SMS.
                  </p>
                </div>

                {errorMessage && (
                  <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    <AlertCircle size={15} className="mt-0.5 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <form onSubmit={handleSendPhoneOtp} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-foreground">
                      Country & Phone number
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-bold text-foreground transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        {COUNTRY_CODES.map((item) => (
                          <option key={item.code} value={item.code}>
                            {item.flag} {item.code} ({item.country})
                          </option>
                        ))}
                      </select>

                      <div className="relative flex flex-1 items-center">
                        <Phone size={15} className="absolute left-3.5 text-muted-foreground pointer-events-none" />
                        <input
                          type="tel"
                          required
                          placeholder="555-0199"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3.5 text-sm text-foreground transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md transition-all hover:bg-primary/95 disabled:opacity-50"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                    <span>{loading ? 'Sending code…' : 'Send OTP'}</span>
                  </motion.button>
                </form>
              </motion.div>
            )}

            {/* 4. PHONE AUTH - STEP 2 (VERIFY OTP) */}
            {view === 'phone-step2' && (
              <motion.div
                key="phone-step2"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.24, ease: 'easeInOut' }}
              >
                <button
                  type="button"
                  onClick={() => switchView('phone-step1')}
                  className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft size={14} /> Change phone number
                </button>

                <div className="mb-5">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">Verify your phone number 🔐</h1>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Enter the 6-digit verification code sent to{' '}
                    <span className="font-semibold text-foreground">
                      {countryCode} {phoneNumber}
                    </span>{' '}
                    via SMS.
                  </p>
                </div>

                {errorMessage && (
                  <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    <AlertCircle size={15} className="mt-0.5 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <form onSubmit={handleVerifyPhoneOtp} className="space-y-5">
                  {/* 6-box smooth OTP input */}
                  <div className="flex justify-between gap-2 sm:gap-2.5">
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => {
                          otpInputRefs.current[index] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        className="h-12 w-12 rounded-xl border border-border bg-background text-center text-lg font-bold text-foreground transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                      />
                    ))}
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    type="submit"
                    disabled={loading || otp.join('').length < 6}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md transition-all hover:bg-primary/95 disabled:opacity-40"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                    <span>{loading ? 'Verifying…' : 'Verify OTP'}</span>
                  </motion.button>
                </form>

                <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Didn't receive code?</span>
                  {resendCountdown > 0 ? (
                    <span className="font-mono text-xs text-muted-foreground">
                      Resend in {resendCountdown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendPhoneOtp}
                      disabled={loading}
                      className="font-bold text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <RefreshCw size={12} /> Resend OTP
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* 5. FORGOT PASSWORD VIEW */}
            {view === 'forgot-password' && (
              <motion.div
                key="forgot-password"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.24, ease: 'easeInOut' }}
              >
                <button
                  type="button"
                  onClick={() => switchView('login')}
                  className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft size={14} /> Back to Sign In
                </button>

                <div className="mb-6">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">Forgot your password? 🔑</h1>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Enter your email and we'll help you reset your password.
                  </p>
                </div>

                {errorMessage && (
                  <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    <AlertCircle size={15} className="mt-0.5 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-foreground" htmlFor="forgot-email">
                      Registered email address
                    </label>
                    <div className="relative flex items-center">
                      <Mail size={15} className="absolute left-3.5 text-muted-foreground pointer-events-none" />
                      <input
                        id="forgot-email"
                        type="email"
                        required
                        placeholder="name@example.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3.5 text-sm text-foreground transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md transition-all hover:bg-primary/95 disabled:opacity-50"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                    <span>{loading ? 'Sending link…' : 'Send Reset Link'}</span>
                  </motion.button>
                </form>
              </motion.div>
            )}

            {/* 6. FORGOT PASSWORD SUCCESS VIEW */}
            {view === 'forgot-success' && (
              <motion.div
                key="forgot-success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.24, ease: 'easeInOut' }}
                className="text-center py-3"
              >
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={30} />
                </div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">Check your inbox 📬</h2>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  If an account exists for <span className="font-semibold text-foreground">{forgotEmail}</span>, we
                  have prepared password reset instructions.
                </p>

                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => switchView('login')}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary py-3 text-xs font-bold text-secondary-foreground shadow-sm transition-transform hover:-translate-y-0.5"
                  >
                    <ArrowLeft size={14} /> Back to Login
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Security / Privacy Trust Footer */}
        <div className="mt-6 flex items-center justify-center gap-2 text-center text-[11px] text-muted-foreground/70">
          <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
          <span>Encrypted active recall session · DocQuiz AI</span>
        </div>
      </motion.div>

      {/* Real Google Account Picker Dialog */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl paper-shadow sm:p-7">
            <button
              type="button"
              onClick={() => setShowGoogleModal(false)}
              className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close modal"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted">
                <GoogleIcon />
              </span>
              <div>
                <h3 className="text-lg font-bold">Sign in with Google</h3>
                <p className="text-xs text-muted-foreground">Choose the Google account to use with DocQuiz AI</p>
              </div>
            </div>

            <form onSubmit={handleGoogleSubmit} className="mt-5 space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground" htmlFor="google-email-input">
                  Your Google / Gmail Address
                </label>
                <div className="relative flex items-center">
                  <Mail size={15} className="absolute left-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    id="google-email-input"
                    type="email"
                    required
                    placeholder="yourname@gmail.com"
                    value={googleEmailInput}
                    onChange={(e) => setGoogleEmailInput(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3.5 text-sm text-foreground transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground" htmlFor="google-name-input">
                  Display Name <span className="text-[10px] text-muted-foreground font-normal">(optional)</span>
                </label>
                <div className="relative flex items-center">
                  <User size={15} className="absolute left-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    id="google-name-input"
                    type="text"
                    placeholder="Your Name"
                    value={googleNameInput}
                    onChange={(e) => setGoogleNameInput(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3.5 text-sm text-foreground transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={loading || !googleEmailInput.trim()}
                  className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-bold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                >
                  <GoogleIcon />
                  <span>{loading ? 'Authenticating with Google…' : 'Continue with this Google Account'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowGoogleModal(false)}
                  className="rounded-xl border border-border py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
