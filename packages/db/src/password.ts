import * as crypto from 'node:crypto';

const SCRYPT_KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH);
  return `scrypt$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export function verifyPassword(password: string, storedHash: string): { valid: boolean; needsRehash: boolean } {
  if (storedHash.startsWith('scrypt$')) {
    const [, saltValue, digestValue] = storedHash.split('$');
    if (!saltValue || !digestValue) return { valid: false, needsRehash: false };
    try {
      const salt = Buffer.from(saltValue, 'base64url');
      const expected = Buffer.from(digestValue, 'base64url');
      if (salt.length !== 16 || expected.length !== SCRYPT_KEY_LENGTH) return { valid: false, needsRehash: false };
      const actual = crypto.scryptSync(password, salt, expected.length);
      return { valid: crypto.timingSafeEqual(actual, expected), needsRehash: false };
    } catch {
      return { valid: false, needsRehash: false };
    }
  }

  // Migrate historical SHA-256 accounts after a successful password check.
  if (/^[a-f0-9]{64}$/i.test(storedHash)) {
    const expected = Buffer.from(storedHash, 'hex');
    const actual = crypto.createHash('sha256').update(password).digest();
    return { valid: crypto.timingSafeEqual(actual, expected), needsRehash: true };
  }
  return { valid: false, needsRehash: false };
}
