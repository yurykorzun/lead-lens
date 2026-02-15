import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';

const SALT_ROUNDS = 12;

export function generateAccessCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface TokenPayload {
  sub: string;
  role: string;
  name?: string;
  sfField?: string;
  sfValue?: string;
}

export function createSessionToken(userId: string, role: string, name?: string, sfField?: string, sfValue?: string): string {
  const payload: TokenPayload = { sub: userId, role };
  if (name) payload.name = name;
  if (sfField) payload.sfField = sfField;
  if (sfValue) payload.sfValue = sfValue;
  return jwt.sign(
    payload,
    process.env.APP_JWT_SECRET!,
    { expiresIn: (process.env.APP_JWT_EXPIRES_IN || '8h') as SignOptions['expiresIn'] }
  );
}

export function verifySessionToken(token: string): TokenPayload {
  return jwt.verify(token, process.env.APP_JWT_SECRET!) as TokenPayload;
}
