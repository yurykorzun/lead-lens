import { Router } from 'express';
import { eq } from 'drizzle-orm';
import type { LoginRequest, SignupRequest } from '@lead-lens/shared';
import { getDb } from '../db/index.js';
import { users, loanOfficerDirectory } from '../db/schema.js';
import { hashPassword, verifyPassword, createSessionToken } from '../services/auth.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body as SignupRequest;
    if (!email || !password) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'Email and password required' } });
      return;
    }

    const db = getDb();

    // Check allowlist
    const [dirEntry] = await db
      .select()
      .from(loanOfficerDirectory)
      .where(eq(loanOfficerDirectory.email, email.toLowerCase()));

    if (!dirEntry || !dirEntry.active) {
      res.status(403).json({ success: false, error: { code: 'NOT_ALLOWED', message: 'Email not in directory. Contact admin for access.' } });
      return;
    }

    // Check if user already exists
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()));

    if (existing) {
      res.status(409).json({ success: false, error: { code: 'EXISTS', message: 'Account already exists. Please log in.' } });
      return;
    }

    const passwordHash = await hashPassword(password);

    const [user] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        role: dirEntry.role || 'loan_officer',
        status: 'active',
        sfField: dirEntry.sfField,
        sfValue: dirEntry.sfValue,
      })
      .returning();

    const token = createSessionToken(user.id, user.role, user.sfField ?? undefined, user.sfValue ?? undefined);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          status: user.status,
          sfField: user.sfField,
          sfValue: user.sfValue,
          createdAt: user.createdAt?.toISOString(),
        },
        token,
      },
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body as LoginRequest;
    if (!email || !password) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'Email and password required' } });
      return;
    }

    const db = getDb();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()));

    if (!user) {
      res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
      return;
    }

    if (user.status === 'disabled') {
      res.status(403).json({ success: false, error: { code: 'DISABLED', message: 'Account disabled. Contact admin.' } });
      return;
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
      return;
    }

    // Update last login
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    const token = createSessionToken(user.id, user.role, user.sfField ?? undefined, user.sfValue ?? undefined);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          status: user.status,
          sfField: user.sfField,
          sfValue: user.sfValue,
          createdAt: user.createdAt?.toISOString(),
          lastLoginAt: new Date().toISOString(),
        },
        token,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

router.get('/verify', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDb();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.userId!));

    if (!user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not found' } });
      return;
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          status: user.status,
          sfField: user.sfField,
          sfValue: user.sfValue,
          createdAt: user.createdAt?.toISOString(),
          lastLoginAt: user.lastLoginAt?.toISOString(),
        },
      },
    });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

router.post('/logout', async (_req, res) => {
  // JWT is stateless — client just discards the token
  res.json({ success: true, data: { message: 'Logged out' } });
});

export default router;
