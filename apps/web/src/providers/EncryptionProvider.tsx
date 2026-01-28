'use client';

import { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { encryptionService, type EncryptionMetadata, type EncryptedContent, type RoomKeyInfo } from '@/lib/encryption/service';

interface EncryptionContextValue {
  isAvailable: boolean;

  // Key management
  deriveKeyForRoom: (roomCode: string, password: string) => Promise<EncryptionMetadata>;
  deriveKeyWithSalt: (roomCode: string, password: string, salt: string, keyHash: string) => Promise<boolean>;
  hasKeyForRoom: (roomCode: string) => boolean;
  getKeyInfoForRoom: (roomCode: string) => RoomKeyInfo | undefined;
  clearKeyForRoom: (roomCode: string) => void;
  clearAllKeys: () => void;

  // Encryption operations
  encryptString: (roomCode: string, text: string) => Promise<EncryptedContent>;
  decryptString: (roomCode: string, encryptedContent: EncryptedContent) => Promise<string>;
  encryptJSON: <T>(roomCode: string, data: T) => Promise<EncryptedContent>;
  decryptJSON: <T>(roomCode: string, encryptedContent: EncryptedContent) => Promise<T>;
  encryptFile: (roomCode: string, file: File) => Promise<{ file: File; iv: string; originalName: string; originalType: string }>;
  decryptFile: (roomCode: string, encryptedFile: File, iv: string, originalName: string, originalType: string) => Promise<File>;
  encryptBlob: (roomCode: string, blob: Blob) => Promise<{ blob: Blob; iv: string }>;
  decryptBlob: (roomCode: string, encryptedBlob: Blob, iv: string, originalType: string) => Promise<Blob>;
}

const EncryptionContext = createContext<EncryptionContextValue | null>(null);

export function EncryptionProvider({ children }: { children: React.ReactNode }) {
  const [isAvailable, setIsAvailable] = useState(false);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    setIsAvailable(encryptionService.isAvailable());
  }, []);

  const deriveKeyForRoom = useCallback(async (roomCode: string, password: string) => {
    const result = await encryptionService.deriveKeyForRoom(roomCode, password);
    forceUpdate(n => n + 1);
    return result;
  }, []);

  const deriveKeyWithSalt = useCallback(async (roomCode: string, password: string, salt: string, keyHash: string) => {
    const result = await encryptionService.deriveKeyWithSalt(roomCode, password, salt, keyHash);
    if (result) {
      forceUpdate(n => n + 1);
    }
    return result;
  }, []);

  const hasKeyForRoom = useCallback((roomCode: string) => {
    return encryptionService.hasKeyForRoom(roomCode);
  }, []);

  const getKeyInfoForRoom = useCallback((roomCode: string) => {
    return encryptionService.getKeyInfoForRoom(roomCode);
  }, []);

  const clearKeyForRoom = useCallback((roomCode: string) => {
    encryptionService.clearKeyForRoom(roomCode);
    forceUpdate(n => n + 1);
  }, []);

  const clearAllKeys = useCallback(() => {
    encryptionService.clearAllKeys();
    forceUpdate(n => n + 1);
  }, []);

  const encryptString = useCallback((roomCode: string, text: string) => {
    return encryptionService.encryptString(roomCode, text);
  }, []);

  const decryptString = useCallback((roomCode: string, encryptedContent: EncryptedContent) => {
    return encryptionService.decryptString(roomCode, encryptedContent);
  }, []);

  const encryptJSON = useCallback(<T,>(roomCode: string, data: T) => {
    return encryptionService.encryptJSON(roomCode, data);
  }, []);

  const decryptJSON = useCallback(<T,>(roomCode: string, encryptedContent: EncryptedContent) => {
    return encryptionService.decryptJSON<T>(roomCode, encryptedContent);
  }, []);

  const encryptFile = useCallback((roomCode: string, file: File) => {
    return encryptionService.encryptFile(roomCode, file);
  }, []);

  const decryptFile = useCallback((
    roomCode: string,
    encryptedFile: File,
    iv: string,
    originalName: string,
    originalType: string
  ) => {
    return encryptionService.decryptFile(roomCode, encryptedFile, iv, originalName, originalType);
  }, []);

  const encryptBlob = useCallback((roomCode: string, blob: Blob) => {
    return encryptionService.encryptBlob(roomCode, blob);
  }, []);

  const decryptBlob = useCallback((roomCode: string, encryptedBlob: Blob, iv: string, originalType: string) => {
    return encryptionService.decryptBlob(roomCode, encryptedBlob, iv, originalType);
  }, []);

  const value: EncryptionContextValue = {
    isAvailable,
    deriveKeyForRoom,
    deriveKeyWithSalt,
    hasKeyForRoom,
    getKeyInfoForRoom,
    clearKeyForRoom,
    clearAllKeys,
    encryptString,
    decryptString,
    encryptJSON,
    decryptJSON,
    encryptFile,
    decryptFile,
    encryptBlob,
    decryptBlob,
  };

  return (
    <EncryptionContext.Provider value={value}>
      {children}
    </EncryptionContext.Provider>
  );
}

export function useEncryption() {
  const context = useContext(EncryptionContext);
  if (!context) {
    throw new Error('useEncryption must be used within an EncryptionProvider');
  }
  return context;
}
