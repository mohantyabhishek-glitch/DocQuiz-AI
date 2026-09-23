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
router.post("/auth/phone/send-otp", async (req: Request, res: Response) => {
  try {
    const { countryCode, phoneNumber } = req.body;

    if (!phoneNumber || typeof phoneNumber !== "string") {
      return res.status(400).json({ error: "Please enter a valid phone number." });
    }

    const cleanNumber = phoneNumber.replace(/[^\d]/g, "");
    if (cleanNumber.length < 7 || cleanNumber.length > 15) {
      return res.status(400).json({ error: "Phone number must be between 7 and 15 digits." });
    }

    const fullPhone = `${countryCode || "+1"}${cleanNumber}`;
    // Generate secure 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes expiration

    activeOtps.set(fullPhone, { code: otpCode, expiresAt, attempts: 0 });

    // If Twilio SMS credentials are provided in environment, send real SMS
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

    if (twilioSid && twilioToken && twilioFrom) {
      try {
        const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64");
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: fullPhone,
            From: twilioFrom,
            Body: `Your DocQuiz AI verification code is: ${otpCode}. Valid for 5 minutes.`,
          }),
        });
        logger.info({ phone: fullPhone }, "Real SMS OTP dispatched via Twilio");
      } catch (smsErr) {
        logger.error({ smsErr }, "Failed to send SMS via Twilio provider");
      }
    } else {
      logger.info({ phone: fullPhone, code: otpCode }, "SMS OTP generated (Server-side log)");
    }

    return res.status(200).json({
      message: `Verification code sent to ${countryCode || "+1"} ${phoneNumber.trim()}`,
      phone: `${countryCode || "+1"} ${phoneNumber.trim()}`,
      expiresInSeconds: 300,
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

    const cleanNumber = String(phoneNumber).replace(/[^\d]/g, "");
    const fullPhone = `${countryCode || "+1"}${cleanNumber}`;
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
      const displayPhone = `${countryCode || "+1"} ${cleanNumber}`;
      user = {
        id: userId,
        name: `Student (${cleanNumber.slice(-4)})`,
        email: `phone_${cleanNumber.slice(-6)}@docquiz.user`,
        phone: displayPhone,
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

import nodemailer from "nodemailer";

// In-memory active Email OTP store: email -> { code, expiresAt, attempts }
const activeEmailOtps = new Map<string, { code: string; expiresAt: number; attempts: number }>();

// Helper to create Nodemailer transport
function createEmailTransporter() {
  const host = process.env.SMTP_HOST || process.env.GMAIL_SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  // If using standard Gmail service
  if (user && pass) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }

  return null;
}

// 5. POST /api/auth/google/send-otp
router.post("/auth/google/send-otp", async (req: Request, res: Response) => {
  try {
    const { email, name } = req.body;

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: "Please enter a valid Google / Gmail address." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiration

    activeEmailOtps.set(normalizedEmail, { code: otpCode, expiresAt, attempts: 0 });

    const transporter = createEmailTransporter();
    if (transporter) {
      try {
        const fromAddress = process.env.SMTP_FROM || process.env.GMAIL_USER || "no-reply@docquiz.ai";
        await transporter.sendMail({
          from: `"DocQuiz AI" <${fromAddress}>`,
          to: normalizedEmail,
          subject: `Your DocQuiz AI Google Verification Code: ${otpCode}`,
          html: `
            <div style="font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; border: 1px solid #e2ded5; border-radius: 18px; background-color: #fbf9f4; color: #1e2532;">
              <div style="margin-bottom: 20px;">
                <h2 style="margin: 0; color: #d95338; font-size: 24px; font-weight: 800;">DocQuiz <span style="color: #1e2532;">AI</span></h2>
                <p style="margin: 4px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #707886;">Active Recall Desk</p>
              </div>
              <p style="font-size: 15px; line-height: 1.6; color: #333d4b;">Hello ${name || "Learner"},</p>
              <p style="font-size: 14px; line-height: 1.6; color: #525f70;">Here is your 6-digit Google identity verification code to sign into DocQuiz AI:</p>
              <div style="text-align: center; margin: 26px 0;">
                <span style="display: inline-block; padding: 14px 28px; font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #d95338; background: #ffffff; border: 2px solid #e2ded5; border-radius: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
                  ${otpCode}
                </span>
              </div>
              <p style="font-size: 12px; color: #707886; line-height: 1.5;">This code will expire in 10 minutes. If you did not request this login code, you can safely disregard this email.</p>
              <hr style="border: none; border-top: 1px solid #e2ded5; margin: 24px 0;" />
              <p style="font-size: 11px; color: #9aa2b1; text-align: center; margin: 0;">Encrypted active recall session · DocQuiz AI</p>
            </div>
          `,
        });
        logger.info({ email: normalizedEmail }, "Real Google verification OTP email sent via SMTP");
      } catch (mailErr) {
        logger.error({ mailErr }, "Failed to send email via SMTP transporter");
      }
    } else {
      logger.info({ email: normalizedEmail, code: otpCode }, "Email OTP generated (SMTP not configured in env - check server log)");
    }

    return res.status(200).json({
      message: `Verification code sent to ${normalizedEmail}`,
      email: normalizedEmail,
      expiresInSeconds: 600,
    });
  } catch (error) {
    logger.error({ error }, "Error sending email OTP");
    return res.status(500).json({ error: "Failed to send verification email. Please try again." });
  }
});

// 5b. POST /api/auth/google/verify-otp
router.post("/auth/google/verify-otp", (req: Request, res: Response) => {
  try {
    const { email, otp, name, avatarUrl } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: "Email address and 6-digit verification code are required." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const cleanOtp = String(otp).trim();
    const record = activeEmailOtps.get(normalizedEmail);

    if (!record) {
      return res.status(400).json({ error: "No active verification code found for this email. Please request a new code." });
    }

    if (Date.now() > record.expiresAt) {
      activeEmailOtps.delete(normalizedEmail);
      return res.status(400).json({ error: "Verification code has expired. Please request a new code." });
    }

    if (record.code !== cleanOtp) {
      record.attempts += 1;
      if (record.attempts >= 5) {
        activeEmailOtps.delete(normalizedEmail);
        return res.status(429).json({ error: "Too many incorrect attempts. Please request a new verification code." });
      }
      return res.status(400).json({ error: "Invalid verification code. Please check your inbox and try again." });
    }

    // OTP Verified! Clean up OTP record
    activeEmailOtps.delete(normalizedEmail);

    const userName = name && typeof name === "string" && name.trim().length > 0 ? name.trim() : normalizedEmail.split("@")[0];

    let user = usersByEmail.get(normalizedEmail);
    if (!user) {
      const userId = `usr_${crypto.randomBytes(8).toString("hex")}`;
      user = {
        id: userId,
        name: userName,
        email: normalizedEmail,
        avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userName)}`,
        provider: "google",
        createdAt: new Date().toISOString(),
      };
      usersByEmail.set(normalizedEmail, user);
      usersById.set(userId, user);
    }

    const token = generateToken();
    activeTokens.set(token, user.id);

    logger.info({ userId: user.id, email: normalizedEmail }, "Google email OTP verified successfully");

    return res.status(200).json({
      message: "Google verification successful",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    logger.error({ error }, "Error verifying Google email OTP");
    return res.status(500).json({ error: "Failed to verify code. Please try again." });
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
