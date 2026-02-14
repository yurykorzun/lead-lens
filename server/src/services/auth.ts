import bcrypt from 'bcrypt';
import jwt, { type SignOptions } from 'jsonwebtoken';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface TokenPayload {
  sub: string;
  role: string;
  sfField?: string;
  sfValue?: string;
}

export function createSessionToken(userId: string, role: string, sfField?: string, sfValue?: string): string {
  const payload: TokenPayload = { sub: userId, role };
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
