import { ENCRYPTION } from '@airshare/shared';
import { CryptoUtils } from './utils';
import type { DerivedKey } from './types';

export class KeyDerivation {
  /**
   * Derive an encryption key from a password using PBKDF2
   */
  static async deriveKey(password: string, salt?: Uint8Array): Promise<DerivedKey> {
    const useSalt = salt || CryptoUtils.generateSalt();

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      CryptoUtils.stringToArrayBuffer(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // Derive the actual encryption key
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: useSalt,
        iterations: ENCRYPTION.pbkdf2Iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      {
        name: ENCRYPTION.algorithm,
        length: ENCRYPTION.keyLength,
      },
      false, // Not extractable for security
      ['encrypt', 'decrypt']
    );

    return { key, salt: useSalt };
  }

  /**
   * Derive a key from password with an existing salt (for decryption)
   */
  static async deriveKeyWithSalt(password: string, saltBase64: string): Promise<CryptoKey> {
    const salt = CryptoUtils.base64ToUint8Array(saltBase64);
    const { key } = await this.deriveKey(password, salt);
    return key;
  }

  /**
   * Generate a random encryption key (not derived from password)
   */
  static async generateRandomKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
      {
        name: ENCRYPTION.algorithm,
        length: ENCRYPTION.keyLength,
      },
      true, // Extractable so we can export it
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Export a key to raw bytes (for storage/transmission when needed)
   */
  static async exportKey(key: CryptoKey): Promise<ArrayBuffer> {
    return crypto.subtle.exportKey('raw', key);
  }

  /**
   * Import a key from raw bytes
   */
  static async importKey(keyData: ArrayBuffer): Promise<CryptoKey> {
    return crypto.subtle.importKey(
      'raw',
      keyData,
      {
        name: ENCRYPTION.algorithm,
        length: ENCRYPTION.keyLength,
      },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Create a key hash for verification (not the key itself)
   * Used to verify if a password is correct without storing the key
   */
  static async createKeyHash(key: CryptoKey): Promise<string> {
    // Create a deterministic hash by encrypting a known value
    const testData = CryptoUtils.stringToArrayBuffer('airshare-key-verification');
    const iv = new Uint8Array(ENCRYPTION.ivLength); // Zero IV for deterministic output

    const encrypted = await crypto.subtle.encrypt(
      {
        name: ENCRYPTION.algorithm,
        iv,
        tagLength: ENCRYPTION.tagLength,
      },
      key,
      testData
    );

    return CryptoUtils.sha256Hex(encrypted);
  }

  /**
   * Verify if a password produces the expected key hash
   */
  static async verifyPassword(
    password: string,
    saltBase64: string,
    expectedHash: string
  ): Promise<boolean> {
    try {
      const key = await this.deriveKeyWithSalt(password, saltBase64);
      const hash = await this.createKeyHash(key);
      return CryptoUtils.secureCompare(hash, expectedHash);
    } catch {
      return false;
    }
  }

  /**
   * Wrap a key with another key (for secure key storage)
   */
  static async wrapKey(keyToWrap: CryptoKey, wrappingKey: CryptoKey): Promise<ArrayBuffer> {
    const iv = CryptoUtils.generateIV();

    const wrapped = await crypto.subtle.wrapKey('raw', keyToWrap, wrappingKey, {
      name: ENCRYPTION.algorithm,
      iv,
      tagLength: ENCRYPTION.tagLength,
    });

    // Prepend IV to wrapped key
    const result = new Uint8Array(iv.length + wrapped.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(wrapped), iv.length);

    return result.buffer;
  }

  /**
   * Unwrap a key that was wrapped with wrapKey
   */
  static async unwrapKey(
    wrappedKeyWithIV: ArrayBuffer,
    unwrappingKey: CryptoKey
  ): Promise<CryptoKey> {
    const data = new Uint8Array(wrappedKeyWithIV);
    const iv = data.slice(0, ENCRYPTION.ivLength);
    const wrappedKey = data.slice(ENCRYPTION.ivLength);

    return crypto.subtle.unwrapKey(
      'raw',
      wrappedKey,
      unwrappingKey,
      {
        name: ENCRYPTION.algorithm,
        iv,
        tagLength: ENCRYPTION.tagLength,
      },
      {
        name: ENCRYPTION.algorithm,
        length: ENCRYPTION.keyLength,
      },
      false,
      ['encrypt', 'decrypt']
    );
  }
}
