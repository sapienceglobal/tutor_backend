import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const PREFIX = 'v1';

/**
 * Derive a 32-byte AES-256 key from PAYOUT_ENCRYPTION_KEY (preferred) or JWT_SECRET.
 * Throws if neither secret is configured at runtime so sensitive payout data is never
 * persisted with a hardcoded key.
 */
function getEncryptionKey() {
  const rawSecret = process.env.PAYOUT_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!rawSecret || String(rawSecret).trim().length < 16) {
    throw new Error(
      'PAYOUT_ENCRYPTION_KEY (or JWT_SECRET with >=16 chars) is required for payout encryption'
    );
  }
  return crypto.createHash('sha256').update(String(rawSecret)).digest();
}

/**
 * Encrypt sensitive payout strings (bank account numbers, tax IDs) using AES-256-GCM.
 */
export function encryptSensitive(plainText) {
  if (plainText === null || plainText === undefined) return null;
  const normalized = String(plainText).trim();
  if (!normalized) return null;

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${PREFIX}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a v1 AES-256-GCM encrypted payload produced by encryptSensitive.
 */
export function decryptSensitive(payload) {
  if (!payload || typeof payload !== 'string') return null;
  const trimmed = payload.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(':');
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new Error('Invalid encrypted payout payload format');
  }

  const [, ivHex, authTagHex, cipherHex] = parts;
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

/**
 * Mask a bank account number leaving only the last 4 digits visible.
 */
export function maskAccountNumber(accountNumber) {
  if (!accountNumber) return '';
  const clean = String(accountNumber).replace(/\s+/g, '');
  if (clean.length <= 4) return '•'.repeat(clean.length);
  const visible = clean.slice(-4);
  const maskedLen = Math.max(4, clean.length - 4);
  return `${'•'.repeat(maskedLen)}${visible}`;
}

/**
 * Mask a UPI ID for display while preserving domain suffix (e.g. ad****@okaxis).
 */
export function maskUpiId(upiId) {
  if (!upiId) return '';
  const clean = String(upiId).trim();
  const atIndex = clean.indexOf('@');
  if (atIndex <= 0) return clean;
  const handle = clean.slice(0, atIndex);
  const provider = clean.slice(atIndex);
  const prefix = handle.slice(0, Math.min(2, handle.length));
  return `${prefix}${'*'.repeat(Math.max(2, handle.length - prefix.length))}${provider}`;
}

