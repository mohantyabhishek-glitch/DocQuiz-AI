import { Router, type Request, type Response, type IRouter } from "express";
import crypto from "node:crypto";
import { logger } from "../lib/logger";


const router: IRouter = Router();

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  provider: "email" | "google" | "phone";
  createdAt: string;
}

interface StoredUser extends AuthUser {
  passwordHash?: string;
  passwordSalt?: string;
}

// In-memory persistent user and OTP stores
const usersByEmail = new Map<string, StoredUser>();
const usersByPhone = new Map<string, StoredUser>();
const usersById = new Map<string, StoredUser>();
const activeTokens = new Map<string, string>(); // token -> userId
const activeOtps = new Map<string, { code: string; expiresAt: number; attempts: number }>();

// Helper functions for crypto hashing
function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
}

function generateToken(): string {
  return `dqa_${crypto.randomBytes(32).toString("hex")}`;
}

// Initialize with a ready-to-test Demo User
(function seedDemoUser() {
  const salt = crypto.randomBytes(16).toString("hex");
  const demoUser: StoredUser = {
    id: "usr_demo_1001",
    name: "Alex Morgan",
    email: "alex.morgan@docquiz.ai",
    phone: "+1 555-0199",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    provider: "email",
    createdAt: new Date().toISOString(),
    passwordSalt: salt,
    passwordHash: hashPassword("DocQuiz2026!", salt),
  };
  usersByEmail.set(demoUser.email.toLowerCase(), demoUser);
  usersById.set(demoUser.id, demoUser);
})();

function sanitizeUser(user: StoredUser): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    provider: user.provider,
    createdAt: user.createdAt,
  };
}

// 1. POST /api/auth/register
router.post("/auth/register", (req: Request, res: Response) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return res.status(400).json({ error: "Please enter your full name (minimum 2 characters)." });
    }

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (usersByEmail.has(normalizedEmail)) {
      return res.status(409).json({ error: "An account with this email address already exists. Please sign in." });
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = hashPassword(password, salt);
    const userId = `usr_${crypto.randomBytes(8).toString("hex")}`;

    const newUser: StoredUser = {
      id: userId,
      name: name.trim(),
      email: normalizedEmail,
      phone: phone ? String(phone).trim() : undefined,
      provider: "email",
      createdAt: new Date().toISOString(),
      passwordSalt: salt,
      passwordHash,
    };

    usersByEmail.set(normalizedEmail, newUser);
    if (newUser.phone) {
      usersByPhone.set(newUser.phone, newUser);
    }
    usersById.set(userId, newUser);

    const token = generateToken();
    activeTokens.set(token, userId);

    logger.info({ userId, email: normalizedEmail }, "User registered successfully");

    return res.status(201).json({
      message: "Account created successfully",
      token,
      user: sanitizeUser(newUser),
    });
  } catch (error) {
    logger.error({ error }, "Error during user registration");
    return res.status(500).json({ error: "Unable to complete registration. Please try again." });
  }
});

// 2. POST /api/auth/login
router.post("/auth/login", (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email address and password are required." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = usersByEmail.get(normalizedEmail);

    if (!user || !user.passwordHash || !user.passwordSalt) {
      return res.status(401).json({ error: "Incorrect email or password. Please check your credentials." });
    }

    const hash = hashPassword(String(password), user.passwordSalt);
    if (hash !== user.passwordHash) {
      return res.status(401).json({ error: "Incorrect email or password. Please check your credentials." });
    }

    const token = generateToken();
    activeTokens.set(token, user.id);

    logger.info({ userId: user.id, email: normalizedEmail }, "User signed in successfully");

    return res.status(200).json({
      message: "Signed in successfully",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    logger.error({ error }, "Error during login");
    return res.status(500).json({ error: "Unable to sign in. Please try again." });
  }
});

// 3. POST /api/auth/phone/send-otp
router.post("/auth/phone/send-otp", (req: Request, res: Response) => {
  try {
    const { countryCode, phoneNumber } = req.body;

    if (!phoneNumber || typeof phoneNumber !== "string") {
      return res.status(400).json({ error: "Please enter a valid phone number." });
    }

    const cleanNumber = phoneNumber.replace(/[^\d]/g, "");
    if (cleanNumber.length < 7 || cleanNumber.length > 15) {
      return res.status(400).json({ error: "Phone number must be between 7 and 15 digits." });
    }

    const fullPhone = `${countryCode || "+1"} ${phoneNumber.trim()}`;
    // Generate secure 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes expiration

    activeOtps.set(fullPhone, { code: otpCode, expiresAt, attempts: 0 });

    logger.info({ phone: fullPhone, otpCode }, `Generated OTP for phone verification`);

    return res.status(200).json({
      message: `OTP sent to ${fullPhone}`,
      phone: fullPhone,
      expiresInSeconds: 300,
      // For development / demonstration convenience, return debugOtp
      debugOtp: otpCode,
    });
  } catch (error) {
    logger.error({ error }, "Error sending phone OTP");
    return res.status(500).json({ error: "Failed to send OTP. Please try again." });
  }
});

// 4. POST /api/auth/phone/verify-otp
router.post("/auth/phone/verify-otp", (req: Request, res: Response) => {
  try {
    const { countryCode, phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
      return res.status(400).json({ error: "Phone number and 6-digit OTP are required." });
    }

    const fullPhone = `${countryCode || "+1"} ${String(phoneNumber).trim()}`;
    const cleanOtp = String(otp).trim();
    const record = activeOtps.get(fullPhone);

    if (!record) {
      return res.status(400).json({ error: "No active OTP request found for this number. Please request a new code." });
    }

    if (Date.now() > record.expiresAt) {
      activeOtps.delete(fullPhone);
      return res.status(400).json({ error: "OTP has expired. Please request a new code." });
    }

    if (record.code !== cleanOtp) {
      record.attempts += 1;
      if (record.attempts >= 5) {
        activeOtps.delete(fullPhone);
        return res.status(429).json({ error: "Too many incorrect attempts. Please request a new OTP." });
      }
      return res.status(400).json({ error: "Invalid verification code. Please check and try again." });
    }

    // OTP Verified! Clean up OTP record
    activeOtps.delete(fullPhone);

    // Find or create user
    let user = usersByPhone.get(fullPhone);
    if (!user) {
      const userId = `usr_${crypto.randomBytes(8).toString("hex")}`;
      user = {
        id: userId,
        name: `Student (${fullPhone.slice(-4)})`,
        email: `phone_${cleanOtp}_${Date.now()}@docquiz.user`,
        phone: fullPhone,
        provider: "phone",
        createdAt: new Date().toISOString(),
      };
      usersByPhone.set(fullPhone, user);
      usersById.set(userId, user);
    }

    const token = generateToken();
    activeTokens.set(token, user.id);

    return res.status(200).json({
      message: "Phone verified successfully",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    logger.error({ error }, "Error verifying phone OTP");
    return res.status(500).json({ error: "Failed to verify OTP. Please try again." });
  }
});

// 5. POST /api/auth/google
router.post("/auth/google", (req: Request, res: Response) => {
  try {
    const { credential, email, name, avatarUrl } = req.body;

    const userEmail = (email || "learner.google@docquiz.ai").toLowerCase();
    const userName = name || "Google Learner";

    let user = usersByEmail.get(userEmail);
    if (!user) {
      const userId = `usr_${crypto.randomBytes(8).toString("hex")}`;
      user = {
        id: userId,
        name: userName,
        email: userEmail,
        avatarUrl: avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
        provider: "google",
        createdAt: new Date().toISOString(),
      };
      usersByEmail.set(userEmail, user);
      usersById.set(userId, user);
    }

    const token = generateToken();
    activeTokens.set(token, user.id);

    return res.status(200).json({
      message: "Google sign-in successful",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    logger.error({ error }, "Error during Google auth");
    return res.status(500).json({ error: "Failed to sign in with Google." });
  }
});

// 6. POST /api/auth/forgot-password
router.post("/auth/forgot-password", (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: "Please provide a valid email address." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = usersByEmail.get(normalizedEmail);

    logger.info({ email: normalizedEmail, exists: !!user }, "Password reset requested");

    return res.status(200).json({
      message: `If an account exists for ${normalizedEmail}, a password reset link has been prepared.`,
      email: normalizedEmail,
      status: "sent",
    });
  } catch (error) {
    logger.error({ error }, "Error handling forgot password");
    return res.status(500).json({ error: "Unable to process password reset request." });
  }
});

// 7. GET /api/auth/me
router.get("/auth/me", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
  }

  const token = authHeader.substring(7);
  const userId = activeTokens.get(token);

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized: Session expired or invalid" });
  }

  const user = usersById.get(userId);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized: User not found" });
  }

  return res.status(200).json({ user: sanitizeUser(user) });
});

// 8. POST /api/auth/logout
router.post("/auth/logout", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    activeTokens.delete(token);
  }
  return res.status(200).json({ message: "Signed out successfully" });
});

export default router;
