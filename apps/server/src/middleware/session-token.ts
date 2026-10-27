import * as crypto from 'node:crypto';
import { SessionTokenPayload, UserRole } from '@inklly/shared';

const ISSUER = 'inklly-api';
const DEVELOPMENT_SECRET = 'inklly_super_secret_jwt_key_development_only_change_in_prod';
const ALLOWED_ROLES: UserRole[] = [
  'PLATFORM_OWNER',
  'PLATFORM_ADMIN',
  'MERCHANT_OWNER',
  'SHOP_MANAGER',
  'SHOP_STAFF',
  'DEVELOPER',
  'CUSTOMER',
];

// Local/test processes get an ephemeral key when no key is configured. Production
// must provide a stable, high-entropy JWT_SECRET shared by every API instance.
const ephemeralDevelopmentSecret = crypto.randomBytes(32).toString('hex');

function signingKey(): Buffer {
  const configuredSecret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!configuredSecret || configuredSecret === DEVELOPMENT_SECRET || Buffer.byteLength(configuredSecret) < 32) {
      throw new Error('Production requires a JWT_SECRET of at least 32 bytes that is not the example development value');
    }
    return Buffer.from(configuredSecret, 'utf8');
  }

  return Buffer.from(configuredSecret || ephemeralDevelopmentSecret, 'utf8');
}

export function assertSessionSecretConfigured(): void {
  signingKey();
}

function encode(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

export function createSessionToken(payload: Omit<SessionTokenPayload, 'iat' | 'exp'>): string {
  const now = Math.floor(Date.now() / 1000);
  const header = encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = encode(
    JSON.stringify({
      ...payload,
      iss: ISSUER,
      iat: now,
      exp: now + 86400 * 7,
    })
  );
  const input = `${header}.${body}`;
  const signature = crypto.createHmac('sha256', signingKey()).update(input).digest();
  return `${input}.${encode(signature)}`;
}

export function verifySessionToken(token: string): SessionTokenPayload | 'expired' | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) return null;

  try {
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
    if (header.alg !== 'HS256' || header.typ !== 'JWT') return null;

    const suppliedSignature = Buffer.from(encodedSignature, 'base64url');
    const expectedSignature = crypto
      .createHmac('sha256', signingKey())
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest();
    if (
      suppliedSignature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(suppliedSignature, expectedSignature)
    ) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (
      payload.iss !== ISSUER ||
      typeof payload.userId !== 'string' ||
      !payload.userId ||
      typeof payload.email !== 'string' ||
      !payload.email ||
      !ALLOWED_ROLES.includes(payload.role) ||
      !Array.isArray(payload.permissions) ||
      !payload.permissions.every((permission: unknown) => typeof permission === 'string') ||
      !Number.isInteger(payload.iat) ||
      !Number.isInteger(payload.exp) ||
      payload.iat > now + 60 ||
      payload.exp <= payload.iat ||
      (payload.shopId !== undefined && typeof payload.shopId !== 'string') ||
      (payload.organizationId !== undefined && typeof payload.organizationId !== 'string')
    ) {
      return null;
    }
    if (payload.exp <= now) return 'expired';

    const { iss: _issuer, ...session } = payload;
    return session as SessionTokenPayload;
  } catch {
    return null;
  }
}
