import type { Request, Response, NextFunction } from 'express';
import { verifySessionToken } from '../services/auth.js';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userRole?: string;
  userName?: string;
  sfField?: string;
  sfValue?: string;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing token' } });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = verifySessionToken(token);
    req.userId = payload.sub;
    req.userRole = payload.role;
    req.userName = payload.name;
    req.sfField = payload.sfField;
    req.sfValue = payload.sfValue;
    next();
  } catch {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'admin') {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
    return;
  }
  next();
}
