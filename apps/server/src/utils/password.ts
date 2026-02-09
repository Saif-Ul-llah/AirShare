import crypto from 'crypto';

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const derivedKey = crypto.scryptSync(password, salt, KEY_LENGTH);
  return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  const [saltHex, hashHex] = storedHash.split(':');
  if (!saltHex || !hashHex) {
    return false;
  }

  const salt = Buffer.from(saltHex, 'hex');
  const hash = Buffer.from(hashHex, 'hex');

  const derivedKey = crypto.scryptSync(password, salt, hash.length);

  // Use timingSafeEqual to avoid timing attacks
  return crypto.timingSafeEqual(hash, derivedKey);
}

