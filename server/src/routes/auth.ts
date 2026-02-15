import { Router } from 'express';
import { eq } from 'drizzle-orm';
import type { LoginRequest } from '@lead-lens/shared';
import { getDb } from '../db/index.js';
import { users } from '../db/schema.js';
import { verifyPassword, createSessionToken } from '../services/auth.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password, accessCode } = req.body as LoginRequest;
    const credential = password || accessCode;

    if (!email || !credential) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'Email and password/access code required' } });
      return;
    }

    const db = getDb();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()));

    if (!user) {
      res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } });
      return;
    }

    if (user.status === 'disabled') {
      res.status(403).json({ success: false, error: { code: 'DISABLED', message: 'Account disabled. Contact admin.' } });
      return;
    }

    const valid = await verifyPassword(credential, user.passwordHash);
    if (!valid) {
      res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } });
      return;
    }

    // Update last login
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    const token = createSessionToken(
      user.id,
      user.role,
      user.name ?? undefined,
      user.sfField ?? undefined,
      user.sfValue ?? undefined,
    );

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
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
          name: user.name,
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
