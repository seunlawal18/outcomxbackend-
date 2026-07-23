import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { verifyMessage, isAddress } from 'viem';
import db, { SQL_NOW } from '../db/client';
import config from '../config';
import { requireAuth } from '../middleware/auth';
import {
  generateToken, blacklistToken, getStartingBalance,
  createWalletNonce, consumeWalletNonce,
} from '../services/authService';
import { sendVerificationEmail } from '../services/emailService';
import { DbUser, DbWallet, toApiUser } from '../types';

const router = Router();

// Auth-specific rate limiter: 20 requests per 15 minutes per IP
// Applied only to register/login/logout — NOT to /me or /profile
// because the frontend calls /me on every page load.
// In development the limit is relaxed to 200 to avoid blocking during testing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later' },
});

// Apply rate limiter only to the routes that need brute-force protection
router.post('/register',             authLimiter);
router.post('/login',                authLimiter);
router.post('/logout',               authLimiter);
router.post('/verify-email',         authLimiter);
router.post('/resend-verification',  authLimiter);
router.post('/wallet/nonce',         authLimiter);
router.post('/wallet/verify',        authLimiter);

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const REGIONS = ['nigeria', 'ghana', 'kenya', 'uk', 'usa', 'europe', 'southafrica', 'other'] as const;

const registerSchema = z.object({
  email:    z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name:     z.string().min(3, 'Name must be at least 3 characters'),
  region:   z.enum(REGIONS, { errorMap: () => ({ message: 'Invalid region' }) }),
});

const loginSchema = z.object({
  email:    z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const profileSchema = z.object({
  name:     z.string().min(3).optional(),
  username: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/, 'Username may only contain lowercase letters, numbers, and underscores').optional(),
  bio:      z.string().max(500).optional(),
  avatar:   z.string().url('Avatar must be a valid URL').optional(),
  region:   z.enum(REGIONS).optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateUsername(email: string): string {
  const base = email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .slice(0, 20);
  return base;
}

// email/username/address columns are CITEXT (case-insensitive by type), so
// plain `=` comparisons are already case-insensitive — no COLLATE needed.
async function isUsernameTaken(username: string, excludeId?: number): Promise<boolean> {
  const query = excludeId
    ? await db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, excludeId)
    : await db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  return !!query;
}

// ─── POST /register ───────────────────────────────────────────────────────────

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    return;
  }

  const { email, password, name, region } = parsed.data;

  // Validate password: at least 1 uppercase and 1 number
  if (!/[A-Z]/.test(password)) {
    res.status(400).json({ success: false, error: 'Password must contain at least one uppercase letter' });
    return;
  }
  if (!/[0-9]/.test(password)) {
    res.status(400).json({ success: false, error: 'Password must contain at least one number' });
    return;
  }

  // Validate name has at least 2 words
  const nameParts = name.trim().split(/\s+/);
  if (nameParts.length < 2) {
    res.status(400).json({ success: false, error: 'Name must contain at least two words' });
    return;
  }

  // Check email not already registered
  const existingEmail = await db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(email);
  if (existingEmail) {
    res.status(409).json({ success: false, error: 'Email is already registered' });
    return;
  }

  // Generate unique username
  let username = generateUsername(email);
  if (await isUsernameTaken(username)) {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    username = `${username}_${suffix}`;
  }

  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  const balance = getStartingBalance();

  const result = await db.prepare(`
    INSERT INTO users (email, password_hash, name, username, region, balance)
    VALUES (?, ?, ?, ?, ?, ?)
    RETURNING id
  `).run(email, passwordHash, name.trim(), username, region, balance);

  const user = (await db
    .prepare<DbUser>('SELECT * FROM users WHERE id = ?')
    .get(result.lastInsertRowid))!;

  // Send verification email — non-blocking, don't fail registration if email fails
  try {
    const code      = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await db.prepare(
      'INSERT INTO email_verifications (user_id, code, expires_at) VALUES (?, ?, ?)',
    ).run(user.id, code, expiresAt);
    await sendVerificationEmail(email, name.trim(), code);
  } catch (e) {
    console.warn('Email send skipped:', e);
  }

  const token = generateToken(user.id, user.is_admin === 1);

  res.status(201).json({ success: true, data: { token, user: toApiUser(user) } });
});

// ─── POST /login ──────────────────────────────────────────────────────────────

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    return;
  }

  const { email, password } = parsed.data;

  const user = await db
    .prepare<DbUser>('SELECT * FROM users WHERE email = ?')
    .get(email);

  if (!user) {
    res.status(401).json({ success: false, error: 'Invalid email or password' });
    return;
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    res.status(401).json({ success: false, error: 'Invalid email or password' });
    return;
  }

  const token = generateToken(user.id, user.is_admin === 1);

  res.status(200).json({ success: true, data: { token, user: toApiUser(user) } });
});

// ─── POST /logout ─────────────────────────────────────────────────────────────

router.post('/logout', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const token = req.headers.authorization!.slice(7);

  // Decode to get expiry without re-verifying (already verified by requireAuth)
  const decoded = jwt.decode(token) as { exp?: number } | null;
  const expiresAt = decoded?.exp
    ? new Date(decoded.exp * 1000)
    : new Date(Date.now() + 24 * 60 * 60 * 1000); // fallback: 24h from now

  await blacklistToken(token, expiresAt);

  res.status(200).json({ success: true });
});

// ─── GET /me ──────────────────────────────────────────────────────────────────

router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  // Re-read fresh data from DB
  const user = await db
    .prepare<DbUser>('SELECT * FROM users WHERE id = ?')
    .get(req.user!.id);

  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }

  res.status(200).json({ success: true, data: toApiUser(user) });
});

// ─── PATCH /profile ───────────────────────────────────────────────────────────

router.patch('/profile', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    return;
  }

  const { name, username, bio, avatar, region } = parsed.data;
  const userId = req.user!.id;

  // Check username uniqueness if provided
  if (username && await isUsernameTaken(username, userId)) {
    res.status(409).json({ success: false, error: 'Username is already taken' });
    return;
  }

  // Build dynamic update
  const fields: string[] = [];
  const values: unknown[] = [];

  if (name !== undefined)     { fields.push('name = ?');     values.push(name); }
  if (username !== undefined) { fields.push('username = ?'); values.push(username); }
  if (bio !== undefined)      { fields.push('bio = ?');      values.push(bio); }
  if (avatar !== undefined)   { fields.push('avatar = ?');   values.push(avatar); }
  // region is locale/profile metadata only — no longer tied to balance
  if (region !== undefined)   { fields.push('region = ?');   values.push(region); }

  if (fields.length === 0) {
    res.status(400).json({ success: false, error: 'No fields provided to update' });
    return;
  }

  values.push(userId);
  await db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const updatedUser = (await db
    .prepare<DbUser>('SELECT * FROM users WHERE id = ?')
    .get(userId))!;

  res.status(200).json({ success: true, data: toApiUser(updatedUser) });
});

// ─── POST /verify-email ───────────────────────────────────────────────────────
// Accepts the 6-digit OTP sent to the user's email on registration.
// Marks the user as verified and invalidates the code.

router.post('/verify-email', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { code } = req.body;
  if (!code) {
    res.status(400).json({ success: false, error: 'Code is required' });
    return;
  }

  const userId = req.user!.id;

  interface VerificationRow {
    id: number;
    user_id: number;
    code: string;
    expires_at: string;
    used: number;
  }

  const row = await db.prepare<VerificationRow>(`
    SELECT * FROM email_verifications
    WHERE user_id = ? AND code = ? AND used = 0 AND expires_at > ${SQL_NOW}
    ORDER BY created_at DESC
    LIMIT 1
  `).get(userId, String(code));

  if (!row) {
    res.status(400).json({ success: false, error: 'Invalid or expired code' });
    return;
  }

  await db.transaction(async (tx) => {
    await tx.prepare('UPDATE email_verifications SET used = 1 WHERE id = ?').run(row.id);
    await tx.prepare('UPDATE users SET is_verified = 1 WHERE id = ?').run(userId);
  });

  const user = (await db.prepare<DbUser>('SELECT * FROM users WHERE id = ?').get(userId))!;
  res.status(200).json({ success: true, data: toApiUser(user) });
});

// ─── POST /resend-verification ────────────────────────────────────────────────
// Generates a new OTP and resends the verification email.
// Blocked if user is already verified.

router.post('/resend-verification', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const user   = (await db.prepare<DbUser>('SELECT * FROM users WHERE id = ?').get(userId))!;

  if (user.is_verified === 1) {
    res.status(400).json({ success: false, error: 'Email already verified' });
    return;
  }

  const code      = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await db.prepare(
    'INSERT INTO email_verifications (user_id, code, expires_at) VALUES (?, ?, ?)',
  ).run(userId, code, expiresAt);

  const sent = await sendVerificationEmail(user.email, user.name, code);
  if (!sent) {
    res.status(500).json({ success: false, error: 'Failed to send email' });
    return;
  }

  res.status(200).json({ success: true });
});

// ─── Wallet auth ────────────────────────────────────────────────────────────

const nonceSchema  = z.object({ address: z.string() });
const verifySchema = z.object({
  address:   z.string(),
  message:   z.string(),
  signature: z.string(),
});

async function generateWalletUsername(address: string): Promise<string> {
  const base = `wallet_${address.slice(2, 8).toLowerCase()}`;
  return (await isUsernameTaken(base)) ? `${base}_${Math.floor(1000 + Math.random() * 9000)}` : base;
}

// ─── POST /wallet/nonce ─────────────────────────────────────────────────────
// Step 1 of connect-wallet sign-in: issue a one-time message for the wallet
// to sign. Doesn't touch the users table — no account is created yet.

router.post('/wallet/nonce', async (req: Request, res: Response): Promise<void> => {
  const parsed = nonceSchema.safeParse(req.body);
  if (!parsed.success || !isAddress(parsed.data.address)) {
    res.status(400).json({ success: false, error: 'Valid wallet address is required' });
    return;
  }

  const { message } = await createWalletNonce(parsed.data.address);
  res.status(200).json({ success: true, data: { message } });
});

// ─── POST /wallet/verify ────────────────────────────────────────────────────
// Step 2: verify the signature over the exact message we issued, then
// find-or-create the user and issue the same JWT the email flow uses.

router.post('/wallet/verify', async (req: Request, res: Response): Promise<void> => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success || !isAddress(parsed.data.address)) {
    res.status(400).json({ success: false, error: 'Invalid request' });
    return;
  }

  const { address, message, signature } = parsed.data;

  if (!(await consumeWalletNonce(address, message))) {
    res.status(401).json({ success: false, error: 'Nonce missing, expired, or already used' });
    return;
  }

  const validSignature = await verifyMessage({
    address: address as `0x${string}`,
    message,
    signature: signature as `0x${string}`,
  }).catch(() => false);

  if (!validSignature) {
    res.status(401).json({ success: false, error: 'Signature verification failed' });
    return;
  }

  const existingWallet = await db
    .prepare<DbWallet>('SELECT * FROM wallets WHERE address = ?')
    .get(address);

  let user: DbUser;

  if (existingWallet) {
    user = (await db.prepare<DbUser>('SELECT * FROM users WHERE id = ?').get(existingWallet.user_id))!;
  } else {
    // First time this address has signed in — create the account.
    // email/password_hash stay NOT NULL at the DB level, so wallet accounts
    // get an unusable placeholder for both (never used for password login).
    const placeholderEmail = `${address.toLowerCase()}@wallet.outcomx.local`;
    const placeholderHash  = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), config.bcryptRounds);
    const username = await generateWalletUsername(address);
    const balance  = getStartingBalance();

    user = await db.transaction(async (tx) => {
      const result = await tx.prepare(`
        INSERT INTO users (email, password_hash, name, username, region, balance, is_verified)
        VALUES (?, ?, ?, ?, ?, ?, 1)
        RETURNING id
      `).run(placeholderEmail, placeholderHash, `Wallet ${address.slice(0, 6)}`, username, 'other', balance);

      await tx.prepare(`
        INSERT INTO wallets (user_id, chain, address, is_primary) VALUES (?, 'evm', ?, 1)
      `).run(result.lastInsertRowid, address);

      return (await tx.prepare<DbUser>('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid))!;
    });
  }

  const token = generateToken(user.id, user.is_admin === 1);
  res.status(200).json({ success: true, data: { token, user: toApiUser(user, address) } });
});

export default router;
