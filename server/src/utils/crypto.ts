import crypto from 'crypto';

function getEncryptionKey(): Buffer {
  const secret = process.env.SYNC_ENCRYPTION_KEY || process.env.JWT_SECRET || 'clg-app-fallback-encryption-salt-2026';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts plain text using AES-256-GCM.
 * Output format: iv_hex:auth_tag_hex:ciphertext_hex
 */
export function encryptData(plainText: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts AES-256-GCM encrypted string.
 */
export function decryptData(cipherText: string): string {
  if (!cipherText || !cipherText.includes(':')) {
    throw new Error('Invalid encrypted data format');
  }

  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted token string');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
