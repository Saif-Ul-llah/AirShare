export interface EncryptedData {
  ciphertext: ArrayBuffer;
  iv: Uint8Array;
  tag?: Uint8Array;
}

export interface EncryptedBlob {
  blob: Blob;
  iv: string; // base64 encoded
}

export interface DerivedKey {
  key: CryptoKey;
  salt: Uint8Array;
}

export interface EncryptionResult {
  encrypted: ArrayBuffer;
  iv: string; // base64 encoded
}

export interface DecryptionResult {
  decrypted: ArrayBuffer;
}

export interface StreamEncryptionChunk {
  index: number;
  encrypted: ArrayBuffer;
  iv: string;
}
