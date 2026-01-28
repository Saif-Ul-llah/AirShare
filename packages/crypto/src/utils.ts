import { ENCRYPTION } from '@airshare/shared';

export class CryptoUtils {
  private static encoder = new TextEncoder();
  private static decoder = new TextDecoder();

  /**
   * Generate cryptographically secure random bytes
   */
  static generateRandomBytes(length: number): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(length));
  }

  /**
   * Generate a random IV for AES-GCM (12 bytes / 96 bits)
   */
  static generateIV(): Uint8Array {
    return this.generateRandomBytes(ENCRYPTION.ivLength);
  }

  /**
   * Generate a random salt for key derivation
   */
  static generateSalt(): Uint8Array {
    return this.generateRandomBytes(ENCRYPTION.saltLength);
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Convert Uint8Array to base64 string
   */
  static uint8ArrayToBase64(array: Uint8Array): string {
    return this.arrayBufferToBase64(array.buffer);
  }

  /**
   * Convert base64 string to Uint8Array
   */
  static base64ToUint8Array(base64: string): Uint8Array {
    return new Uint8Array(this.base64ToArrayBuffer(base64));
  }

  /**
   * Convert string to ArrayBuffer
   */
  static stringToArrayBuffer(str: string): ArrayBuffer {
    return this.encoder.encode(str).buffer;
  }

  /**
   * Convert ArrayBuffer to string
   */
  static arrayBufferToString(buffer: ArrayBuffer): string {
    return this.decoder.decode(buffer);
  }

  /**
   * Convert ArrayBuffer to hex string
   */
  static arrayBufferToHex(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Convert hex string to ArrayBuffer
   */
  static hexToArrayBuffer(hex: string): ArrayBuffer {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes.buffer;
  }

  /**
   * Calculate SHA-256 hash of data
   */
  static async sha256(data: ArrayBuffer | string): Promise<ArrayBuffer> {
    const buffer = typeof data === 'string' ? this.stringToArrayBuffer(data) : data;
    return crypto.subtle.digest('SHA-256', buffer);
  }

  /**
   * Calculate SHA-256 hash and return as hex string
   */
  static async sha256Hex(data: ArrayBuffer | string): Promise<string> {
    const hash = await this.sha256(data);
    return this.arrayBufferToHex(hash);
  }

  /**
   * Calculate checksum for file integrity verification
   */
  static async calculateChecksum(data: ArrayBuffer): Promise<string> {
    return this.sha256Hex(data);
  }

  /**
   * Securely compare two strings (constant-time comparison)
   */
  static secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Generate a random room code
   */
  static generateRoomCode(length: number = 8): string {
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const randomBytes = this.generateRandomBytes(length);
    let code = '';
    for (let i = 0; i < length; i++) {
      code += charset[randomBytes[i] % charset.length];
    }
    return code;
  }

  /**
   * Check if Web Crypto API is available
   */
  static isWebCryptoAvailable(): boolean {
    return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
  }
}
