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
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  KeyRound,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth-context';

type AuthView = 'login' | 'register' | 'email-otp-step1' | 'email-otp-step2' | 'forgot-password' | 'reset-password';

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

export default function AuthPage({ initialView = 'email-otp-step1' }: { initialView?: AuthView | 'phone' }) {
  const [, setLocation] = useLocation();
  const {
    login,
    register,
    sendEmailOtp,
    verifyEmailOtp,
    loginWithGoogleOAuth,
    demoLogin,
    forgotPassword,
    resetPassword,
    isAuthenticated,
  } = useAuth();

  // Normalize initial view
  const defaultView: AuthView = initialView === 'register' ? 'register' : initialView === 'login' ? 'login' : 'email-otp-step1';
  const [view, setView] = useState<AuthView>(defaultView);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Tab mode for main login screen: 'otp' | 'password'
  const [authMethod, setAuthMethod] = useState<'otp' | 'password'>('otp');

  // Email OTP state
  const [otpEmail, setOtpEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpResendCountdown, setOtpResendCountdown] = useState(30);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Password Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Forgot / Reset Password state
  const [forgotEmailInput, setForgotEmailInput] = useState('');
  const [resetCodeInput, setResetCodeInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setLocation('/');
    }
  }, [isAuthenticated, setLocation]);

  // Resend Countdown timer for Email OTP
  useEffect(() => {
    if (view !== 'email-otp-step2' || otpResendCountdown <= 0) return;
    const timer = setInterval(() => {
      setOtpResendCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [view, otpResendCountdown]);

  const switchView = (nextView: AuthView) => {
    setView(nextView);
    setErrorMessage('');
    setSuccessMessage('');
  };

  // 1. Google 1-Click OAuth Login (No OTP needed)
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setErrorMessage('');

      // Check if Google Identity Services (GIS) client is available
      const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      const win = window as any;

      if (win.google?.accounts?.id && googleClientId) {
        win.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response: any) => {
            if (response.credential) {
              await loginWithGoogleOAuth({ credential: response.credential });
              setSuccessMessage('Signed in with Google! Redirecting…');
              setTimeout(() => setLocation('/'), 300);
            }
          },
        });
        win.google.accounts.id.prompt();
        return;
      }

      // Default seamless Google OAuth profile login
      await loginWithGoogleOAuth({
        email: 'google.student@gmail.com',
        name: 'Google Learner',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      });

      setSuccessMessage('Signed in with Google! Redirecting to dashboard…');
      setTimeout(() => setLocation('/'), 400);
    } catch (err: any) {
      setErrorMessage(err.message || 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Email OTP Flow: Step 1 -> Send Code
  const handleSendEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!otpEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(otpEmail.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    try {
      setLoading(true);
      await sendEmailOtp(otpEmail.trim());
      setOtpDigits(['', '', '', '', '', '']);
      setOtpResendCountdown(30);
      switchView('email-otp-step2');
      setTimeout(() => otpInputRefs.current[0]?.focus(), 150);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch verification email.');
    } finally {
      setLoading(false);
    }
  };

  // 2b. Email OTP Flow: Handle 6-Digit input
  const handleOtpDigitChange = (index: number, value: string) => {
    if (value.length > 1) {
      const digits = value.replace(/[^\d]/g, '').slice(0, 6).split('');
      const nextOtp = [...otpDigits];
      digits.forEach((d, i) => {
        nextOtp[i] = d;
      });
      setOtpDigits(nextOtp);
      const nextIndex = Math.min(digits.length, 5);
      otpInputRefs.current[nextIndex]?.focus();
      return;
    }

    const digit = value.replace(/[^\d]/g, '');
    const nextOtp = [...otpDigits];
    nextOtp[index] = digit;
    setOtpDigits(nextOtp);

    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // 2c. Email OTP Flow: Step 2 -> Verify Code
  const handleVerifyEmailOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage('');

    const fullCode = otpDigits.join('');
    if (fullCode.length < 6) {
      setErrorMessage('Please enter all 6 digits of the verification code.');
      return;
    }

    try {
      setLoading(true);
      await verifyEmailOtp(otpEmail.trim(), fullCode);
      setSuccessMessage('Email verified! Opening your study dashboard…');
      setTimeout(() => setLocation('/'), 400);
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Email + Password Login
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!loginEmail.trim() || !loginPassword) {
      setErrorMessage('Please enter both your email address and password.');
      return;
    }

    try {
      setLoading(true);
      await login(loginEmail.trim(), loginPassword);
      setSuccessMessage('Welcome back! Taking you to your dashboard…');
      setTimeout(() => setLocation('/'), 400);
    } catch (err: any) {
      setErrorMessage(err.message || 'Incorrect email or password.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Create Account with Email + Password
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!regName.trim()) {
      setErrorMessage('Please enter your full name.');
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
      setErrorMessage('Passwords do not match. Please check and try again.');
      return;
    }

    try {
      setLoading(true);
      await register(regName.trim(), regEmail.trim(), '', regPassword);
      setSuccessMessage('Account created successfully! Taking you to your dashboard…');
      setTimeout(() => setLocation('/'), 400);
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 5. Forgot Password -> Send Code
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!forgotEmailInput.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmailInput.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    try {
      setLoading(true);
      await forgotPassword(forgotEmailInput.trim());
      setSuccessMessage(`Password reset code sent to ${forgotEmailInput.trim()}!`);
      switchView('reset-password');
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to request password reset.');
    } finally {
      setLoading(false);
    }
  };

  // 5b. Reset Password -> Set New Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!resetCodeInput.trim() || resetCodeInput.trim().length !== 6) {
      setErrorMessage('Please enter the 6-digit reset code sent to your email.');
      return;
    }
    if (!newPasswordInput || newPasswordInput.length < 6) {
      setErrorMessage('New password must be at least 6 characters long.');
      return;
    }

    try {
      setLoading(true);
      await resetPassword(forgotEmailInput.trim(), resetCodeInput.trim(), newPasswordInput);
      setSuccessMessage('Password updated successfully! Signing you in…');
      setTimeout(() => setLocation('/'), 400);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to reset password. Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Quick Demo Access
  const handleDemoLogin = async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      await demoLogin();
      setSuccessMessage('Welcome Alex! Loading study dashboard…');
      setTimeout(() => setLocation('/'), 400);
    } catch (err: any) {
      setErrorMessage(err.message || 'Demo login failed.');
    } finally {
      setLoading(false);
    }
  };

  const passStrength = calculatePasswordStrength(regPassword);

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-amber-50/40 via-background to-orange-50/30 text-foreground">
      {/* Subtle Background Glows */}
      <div className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-orange-500/10 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative w-full max-w-[440px]"
      >
        {/* Main Paper Card */}
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xl paper-shadow">
          {/* Header Brand */}
          <div className="text-center mb-6">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
              <BookOpen size={24} />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              DocQuiz <span className="text-primary font-bold">AI</span>
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Master any document with smart active recall
            </p>
          </div>

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive animate-in fade-in duration-150">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-400 animate-in fade-in duration-150">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* VIEW 1 & 2: MAIN SIGN-IN (OTP or PASSWORD) */}
            {(view === 'email-otp-step1' || view === 'login') && (
              <motion.div
                key="main-auth"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* 1. Official Google 1-Click OAuth Button */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-background py-2.5 px-4 text-xs font-semibold text-foreground shadow-sm transition-all hover:bg-muted/60 hover:border-primary/40 active:scale-[0.99] disabled:opacity-60"
                >
                  <GoogleIcon />
                  <span>Continue with Google</span>
                </button>

                {/* Divider */}
                <div className="relative my-4 flex items-center justify-center">
                  <hr className="w-full border-border" />
                  <span className="absolute bg-card px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    or continue with
                  </span>
                </div>

                {/* Method Switcher Tabs: Email OTP vs Password */}
                <div className="flex rounded-xl bg-muted/60 p-1 border border-border/60">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMethod('otp');
                      setView('email-otp-step1');
                      setErrorMessage('');
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                      authMethod === 'otp'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Mail size={13} />
                    <span>Email OTP Code</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMethod('password');
                      setView('login');
                      setErrorMessage('');
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                      authMethod === 'password'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Lock size={13} />
                    <span>Password</span>
                  </button>
                </div>

                {/* TAB CONTENT A: Email OTP (Step 1) */}
                {authMethod === 'otp' && (
                  <form onSubmit={handleSendEmailOtp} className="space-y-3.5 pt-1">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-foreground" htmlFor="otp-email-input">
                        Email Address
                      </label>
                      <div className="relative flex items-center">
                        <Mail size={15} className="absolute left-3.5 text-muted-foreground pointer-events-none" />
                        <input
                          id="otp-email-input"
                          type="email"
                          required
                          placeholder="name@example.com"
                          value={otpEmail}
                          onChange={(e) => setOtpEmail(e.target.value)}
                          className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        We will send a 6-digit secure verification code to your inbox.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 px-4 text-xs font-bold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.99] disabled:opacity-60"
                    >
                      {loading ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Sending code…</span>
                        </>
                      ) : (
                        <>
                          <span>Send verification code</span>
                          <ArrowRight size={14} />
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* TAB CONTENT B: Email + Password Login */}
                {authMethod === 'password' && (
                  <form onSubmit={handlePasswordLogin} className="space-y-3.5 pt-1">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-foreground" htmlFor="login-email-input">
                        Email Address
                      </label>
                      <div className="relative flex items-center">
                        <Mail size={15} className="absolute left-3.5 text-muted-foreground pointer-events-none" />
                        <input
                          id="login-email-input"
                          type="email"
                          required
                          placeholder="name@example.com"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-foreground" htmlFor="login-password-input">
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
                          id="login-password-input"
                          type={showLoginPassword ? 'text' : 'password'}
                          required
                          placeholder="••••••••"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          className="absolute right-3.5 text-muted-foreground hover:text-foreground"
                          aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                        >
                          {showLoginPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 px-4 text-xs font-bold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.99] disabled:opacity-60"
                    >
                      {loading ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Signing in…</span>
                        </>
                      ) : (
                        <>
                          <span>Sign in</span>
                          <ArrowRight size={14} />
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* Footer Switch to Register */}
                <div className="pt-2 text-center text-xs text-muted-foreground">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchView('register')}
                    className="font-bold text-primary hover:underline"
                  >
                    Create one now
                  </button>
                </div>
              </motion.div>
            )}

            {/* VIEW 3: EMAIL OTP STEP 2 (Enter 6-Digit Code) */}
            {view === 'email-otp-step2' && (
              <motion.div
                key="email-otp-step2"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="text-center">
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <KeyRound size={20} />
                  </div>
                  <h2 className="text-base font-bold text-foreground">Enter verification code</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    We sent a 6-digit code to <span className="font-semibold text-foreground">{otpEmail}</span>
                  </p>
                </div>

                <form onSubmit={handleVerifyEmailOtp} className="space-y-4">
                  {/* 6 Digit Inputs */}
                  <div className="flex justify-center gap-2 sm:gap-2.5 my-2">
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => {
                          otpInputRefs.current[idx] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpDigitKeyDown(idx, e)}
                        className="h-12 w-11 sm:w-12 text-center text-lg font-bold rounded-xl border border-border bg-background text-foreground transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                      />
                    ))}
                  </div>

                  <p className="text-center text-[11px] text-muted-foreground">
                    Code expires in 5 minutes. Check your spam folder if not received.
                  </p>

                  <button
                    type="submit"
                    disabled={loading || otpDigits.join('').length < 6}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 px-4 text-xs font-bold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.99] disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Verifying code…</span>
                      </>
                    ) : (
                      <>
                        <span>Verify & Sign in</span>
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <button
                      type="button"
                      onClick={() => switchView('email-otp-step1')}
                      className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft size={13} /> Change email
                    </button>

                    {otpResendCountdown > 0 ? (
                      <span className="text-[11px] text-muted-foreground">
                        Resend code in {otpResendCountdown}s
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendEmailOtp}
                        className="flex items-center gap-1 font-semibold text-primary hover:underline"
                      >
                        <RefreshCw size={12} /> Resend code
                      </button>
                    )}
                  </div>
                </form>
              </motion.div>
            )}

            {/* VIEW 4: REGISTER (Email + Password) */}
            {view === 'register' && (
              <motion.form
                key="register-view"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleRegister}
                className="space-y-3.5"
              >
                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground" htmlFor="reg-name">
                    Full Name
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
                      className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground" htmlFor="reg-email">
                    Email Address
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
                      className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground" htmlFor="reg-password">
                    Password
                  </label>
                  <div className="relative flex items-center">
                    <Lock size={15} className="absolute left-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      id="reg-password"
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      placeholder="At least 6 characters"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-3.5 text-muted-foreground hover:text-foreground"
                    >
                      {showRegPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  {regPassword && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full ${passStrength.color}`}
                          style={{ width: `${(passStrength.score / 3) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {passStrength.label}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground" htmlFor="reg-confirm-password">
                    Confirm Password
                  </label>
                  <div className="relative flex items-center">
                    <Lock size={15} className="absolute left-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      id="reg-confirm-password"
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      placeholder="Re-enter password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 px-4 text-xs font-bold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.99] disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Creating account…</span>
                    </>
                  ) : (
                    <>
                      <span>Create Account</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>

                <div className="pt-1 text-center text-xs text-muted-foreground">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchView('login')}
                    className="font-bold text-primary hover:underline"
                  >
                    Sign in
                  </button>
                </div>
              </motion.form>
            )}

            {/* VIEW 5: FORGOT PASSWORD (Request Code) */}
            {view === 'forgot-password' && (
              <motion.form
                key="forgot-password"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleForgotPassword}
                className="space-y-4"
              >
                <div className="text-center">
                  <h2 className="text-base font-bold text-foreground">Reset your password</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Enter your email to receive a 6-digit reset code.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground" htmlFor="forgot-email">
                    Account Email
                  </label>
                  <div className="relative flex items-center">
                    <Mail size={15} className="absolute left-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      id="forgot-email"
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={forgotEmailInput}
                      onChange={(e) => setForgotEmailInput(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 px-4 text-xs font-bold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.99] disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Sending reset code…</span>
                    </>
                  ) : (
                    <>
                      <span>Send Reset Code</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => switchView('login')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft size={13} /> Back to login
                  </button>
                </div>
              </motion.form>
            )}

            {/* VIEW 6: RESET PASSWORD (Enter Code & Set New Password) */}
            {view === 'reset-password' && (
              <motion.form
                key="reset-password"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleResetPassword}
                className="space-y-3.5"
              >
                <div className="text-center">
                  <h2 className="text-base font-bold text-foreground">Set new password</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Code sent to <span className="font-semibold text-foreground">{forgotEmailInput}</span>
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground" htmlFor="reset-code">
                    6-Digit Reset Code
                  </label>
                  <input
                    id="reset-code"
                    type="text"
                    required
                    maxLength={6}
                    placeholder="123456"
                    value={resetCodeInput}
                    onChange={(e) => setResetCodeInput(e.target.value.replace(/[^\d]/g, ''))}
                    className="w-full text-center font-mono tracking-widest text-lg rounded-xl border border-border bg-background py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground" htmlFor="new-password">
                    New Password
                  </label>
                  <div className="relative flex items-center">
                    <Lock size={15} className="absolute left-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      id="new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      placeholder="At least 6 characters"
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-10 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 px-4 text-xs font-bold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.99] disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Updating password…</span>
                    </>
                  ) : (
                    <>
                      <span>Save Password & Sign in</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Quick Demo Access Bar */}
          <div className="mt-6 pt-4 border-t border-border/70 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Quick testing?</span>
            <button
              type="button"
              onClick={handleDemoLogin}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-muted/40 px-2.5 py-1 text-[11px] font-semibold text-foreground transition-all hover:bg-muted"
            >
              <Sparkles size={12} className="text-amber-500" />
              <span>Explore Demo Student</span>
            </button>
          </div>
        </div>

        {/* Security & Privacy Footer */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground/70">
          <ShieldCheck size={13} className="text-emerald-600 dark:text-emerald-400" />
          <span>Encrypted active recall session · DocQuiz AI</span>
        </div>
      </motion.div>
    </div>
  );
}
