import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ENVELOPE_PREFIX = 'inklly:enc:v1:webhook:';
const PURPOSE = 'inklly:v1:developer-webhook';

type Envelope = { iv: string; tag: string; ciphertext: string };

function encryptionKey(): Buffer {
  const encoded = (process.env.RAZORPAY_CREDENTIALS_ENCRYPTION_KEY || '').trim();
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32 || key.toString('base64') !== encoded) {
    throw new Error('A valid RAZORPAY_CREDENTIALS_ENCRYPTION_KEY is required to encrypt webhook secrets.');
  }
  return key;
}

export function isEncryptedWebhookSecret(value: string): boolean {
  return value.startsWith(ENVELOPE_PREFIX);
}

export function encryptWebhookSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(PURPOSE, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const envelope: Envelope = {
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
  return `${ENVELOPE_PREFIX}${Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64')}`;
}

export function decryptWebhookSecret(stored: string): string {
  if (!isEncryptedWebhookSecret(stored)) throw new Error('Webhook secret is not encrypted.');
  const envelope = JSON.parse(Buffer.from(stored.slice(ENVELOPE_PREFIX.length), 'base64').toString('utf8')) as Envelope;
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(envelope.iv, 'base64'));
  decipher.setAAD(Buffer.from(PURPOSE, 'utf8'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}
