'use client';

import { AESCrypto, KeyDerivation, CryptoUtils } from '@airshare/crypto';
import type { EncryptionResult } from '@airshare/crypto';

export interface EncryptionMetadata {
  salt: string;
  keyHash: string;
}

export interface EncryptedContent {
  data: string; // base64 encoded encrypted data
  iv: string;
}

export interface RoomKeyInfo {
  key: CryptoKey;
  salt: string;
  keyHash: string;
}

export class EncryptionService {
  private roomKeys: Map<string, RoomKeyInfo> = new Map();

  /**
   * Check if Web Crypto API is available
   */
  isAvailable(): boolean {
    return CryptoUtils.isWebCryptoAvailable();
  }

  /**
   * Derive and store a key for a room from password
   */
  async deriveKeyForRoom(roomCode: string, password: string): Promise<EncryptionMetadata> {
    const { key, salt } = await KeyDerivation.deriveKey(password);
    const saltBase64 = CryptoUtils.uint8ArrayToBase64(salt);
    const keyHash = await KeyDerivation.createKeyHash(key);

    this.roomKeys.set(roomCode, {
      key,
      salt: saltBase64,
      keyHash,
    });

    return {
      salt: saltBase64,
      keyHash,
    };
  }

  /**
   * Derive key using existing salt (for joining encrypted rooms)
   */
  async deriveKeyWithSalt(
    roomCode: string,
    password: string,
    saltBase64: string,
    expectedKeyHash: string
  ): Promise<boolean> {
    const isValid = await KeyDerivation.verifyPassword(password, saltBase64, expectedKeyHash);

    if (!isValid) {
      return false;
    }

    const key = await KeyDerivation.deriveKeyWithSalt(password, saltBase64);

    this.roomKeys.set(roomCode, {
      key,
      salt: saltBase64,
      keyHash: expectedKeyHash,
    });

    return true;
  }

  /**
   * Check if room has a key loaded
   */
  hasKeyForRoom(roomCode: string): boolean {
    return this.roomKeys.has(roomCode);
  }

  /**
   * Get key info for a room
   */
  getKeyInfoForRoom(roomCode: string): RoomKeyInfo | undefined {
    return this.roomKeys.get(roomCode);
  }

  /**
   * Clear key for a room (when leaving)
   */
  clearKeyForRoom(roomCode: string): void {
    this.roomKeys.delete(roomCode);
  }

  /**
   * Clear all keys
   */
  clearAllKeys(): void {
    this.roomKeys.clear();
  }

  /**
   * Encrypt a string for a room
   */
  async encryptString(roomCode: string, text: string): Promise<EncryptedContent> {
    const keyInfo = this.roomKeys.get(roomCode);
    if (!keyInfo) {
      throw new Error('No encryption key available for this room');
    }

    const { encrypted, iv } = await AESCrypto.encryptString(text, keyInfo.key);

    return {
      data: CryptoUtils.arrayBufferToBase64(encrypted),
      iv,
    };
  }

  /**
   * Decrypt a string for a room
   */
  async decryptString(roomCode: string, encryptedContent: EncryptedContent): Promise<string> {
    const keyInfo = this.roomKeys.get(roomCode);
    if (!keyInfo) {
      throw new Error('No encryption key available for this room');
    }

    const encryptedData = CryptoUtils.base64ToArrayBuffer(encryptedContent.data);
    return AESCrypto.decryptString(encryptedData, keyInfo.key, encryptedContent.iv);
  }

  /**
   * Encrypt JSON data for a room
   */
  async encryptJSON<T>(roomCode: string, data: T): Promise<EncryptedContent> {
    const keyInfo = this.roomKeys.get(roomCode);
    if (!keyInfo) {
      throw new Error('No encryption key available for this room');
    }

    const { encrypted, iv } = await AESCrypto.encryptJSON(data, keyInfo.key);

    return {
      data: CryptoUtils.arrayBufferToBase64(encrypted),
      iv,
    };
  }

  /**
   * Decrypt JSON data for a room
   */
  async decryptJSON<T>(roomCode: string, encryptedContent: EncryptedContent): Promise<T> {
    const keyInfo = this.roomKeys.get(roomCode);
    if (!keyInfo) {
      throw new Error('No encryption key available for this room');
    }

    const encryptedData = CryptoUtils.base64ToArrayBuffer(encryptedContent.data);
    return AESCrypto.decryptJSON<T>(encryptedData, keyInfo.key, encryptedContent.iv);
  }

  /**
   * Encrypt a file for a room
   */
  async encryptFile(
    roomCode: string,
    file: File
  ): Promise<{ file: File; iv: string; originalName: string; originalType: string }> {
    const keyInfo = this.roomKeys.get(roomCode);
    if (!keyInfo) {
      throw new Error('No encryption key available for this room');
    }

    return AESCrypto.encryptFile(file, keyInfo.key);
  }

  /**
   * Decrypt a file for a room
   */
  async decryptFile(
    roomCode: string,
    encryptedFile: File,
    iv: string,
    originalName: string,
    originalType: string
  ): Promise<File> {
    const keyInfo = this.roomKeys.get(roomCode);
    if (!keyInfo) {
      throw new Error('No encryption key available for this room');
    }

    return AESCrypto.decryptFile(encryptedFile, keyInfo.key, iv, originalName, originalType);
  }

  /**
   * Encrypt a blob for a room
   */
  async encryptBlob(roomCode: string, blob: Blob): Promise<{ blob: Blob; iv: string }> {
    const keyInfo = this.roomKeys.get(roomCode);
    if (!keyInfo) {
      throw new Error('No encryption key available for this room');
    }

    return AESCrypto.encryptBlob(blob, keyInfo.key);
  }

  /**
   * Decrypt a blob for a room
   */
  async decryptBlob(
    roomCode: string,
    encryptedBlob: Blob,
    iv: string,
    originalType: string
  ): Promise<Blob> {
    const keyInfo = this.roomKeys.get(roomCode);
    if (!keyInfo) {
      throw new Error('No encryption key available for this room');
    }

    return AESCrypto.decryptBlob(encryptedBlob, keyInfo.key, iv, originalType);
  }
}

// Singleton instance
export const encryptionService = new EncryptionService();
