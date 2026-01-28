import { ENCRYPTION } from '@airshare/shared';
import { CryptoUtils } from './utils';
import type { EncryptionResult, EncryptedBlob, StreamEncryptionChunk } from './types';

export class AESCrypto {
  /**
   * Encrypt data using AES-256-GCM
   */
  static async encrypt(data: ArrayBuffer, key: CryptoKey): Promise<EncryptionResult> {
    const iv = CryptoUtils.generateIV();

    const encrypted = await crypto.subtle.encrypt(
      {
        name: ENCRYPTION.algorithm,
        iv,
        tagLength: ENCRYPTION.tagLength,
      },
      key,
      data
    );

    return {
      encrypted,
      iv: CryptoUtils.uint8ArrayToBase64(iv),
    };
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  static async decrypt(encryptedData: ArrayBuffer, key: CryptoKey, ivBase64: string): Promise<ArrayBuffer> {
    const iv = CryptoUtils.base64ToUint8Array(ivBase64);

    return crypto.subtle.decrypt(
      {
        name: ENCRYPTION.algorithm,
        iv,
        tagLength: ENCRYPTION.tagLength,
      },
      key,
      encryptedData
    );
  }

  /**
   * Encrypt a string
   */
  static async encryptString(text: string, key: CryptoKey): Promise<EncryptionResult> {
    const data = CryptoUtils.stringToArrayBuffer(text);
    return this.encrypt(data, key);
  }

  /**
   * Decrypt to a string
   */
  static async decryptString(encryptedData: ArrayBuffer, key: CryptoKey, ivBase64: string): Promise<string> {
    const decrypted = await this.decrypt(encryptedData, key, ivBase64);
    return CryptoUtils.arrayBufferToString(decrypted);
  }

  /**
   * Encrypt a Blob/File
   */
  static async encryptBlob(blob: Blob, key: CryptoKey): Promise<EncryptedBlob> {
    const arrayBuffer = await blob.arrayBuffer();
    const { encrypted, iv } = await this.encrypt(arrayBuffer, key);

    return {
      blob: new Blob([encrypted], { type: 'application/octet-stream' }),
      iv,
    };
  }

  /**
   * Decrypt a Blob
   */
  static async decryptBlob(
    encryptedBlob: Blob,
    key: CryptoKey,
    ivBase64: string,
    originalType: string
  ): Promise<Blob> {
    const arrayBuffer = await encryptedBlob.arrayBuffer();
    const decrypted = await this.decrypt(arrayBuffer, key, ivBase64);

    return new Blob([decrypted], { type: originalType });
  }

  /**
   * Encrypt a File object, preserving metadata
   */
  static async encryptFile(
    file: File,
    key: CryptoKey
  ): Promise<{ file: File; iv: string; originalName: string; originalType: string }> {
    const { blob, iv } = await this.encryptBlob(file, key);

    // Create a new File with encrypted content
    const encryptedFile = new File([blob], `${file.name}.encrypted`, {
      type: 'application/octet-stream',
    });

    return {
      file: encryptedFile,
      iv,
      originalName: file.name,
      originalType: file.type,
    };
  }

  /**
   * Decrypt a File object
   */
  static async decryptFile(
    encryptedFile: File,
    key: CryptoKey,
    ivBase64: string,
    originalName: string,
    originalType: string
  ): Promise<File> {
    const decryptedBlob = await this.decryptBlob(encryptedFile, key, ivBase64, originalType);

    return new File([decryptedBlob], originalName, {
      type: originalType,
    });
  }

  /**
   * Encrypt data in chunks for streaming (large files)
   */
  static async *encryptStream(
    stream: ReadableStream<Uint8Array>,
    key: CryptoKey,
    chunkSize: number = 64 * 1024
  ): AsyncGenerator<StreamEncryptionChunk> {
    const reader = stream.getReader();
    let buffer = new Uint8Array(0);
    let chunkIndex = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (value) {
          // Append new data to buffer
          const newBuffer = new Uint8Array(buffer.length + value.length);
          newBuffer.set(buffer, 0);
          newBuffer.set(value, buffer.length);
          buffer = newBuffer;
        }

        // Process complete chunks
        while (buffer.length >= chunkSize) {
          const chunk = buffer.slice(0, chunkSize);
          buffer = buffer.slice(chunkSize);

          const { encrypted, iv } = await this.encrypt(chunk.buffer, key);

          yield {
            index: chunkIndex++,
            encrypted,
            iv,
          };
        }

        if (done) {
          // Process remaining data
          if (buffer.length > 0) {
            const { encrypted, iv } = await this.encrypt(buffer.buffer, key);

            yield {
              index: chunkIndex,
              encrypted,
              iv,
            };
          }
          break;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Decrypt chunks back to a stream
   */
  static async *decryptChunks(
    chunks: AsyncIterable<{ encrypted: ArrayBuffer; iv: string }>,
    key: CryptoKey
  ): AsyncGenerator<ArrayBuffer> {
    for await (const chunk of chunks) {
      yield await this.decrypt(chunk.encrypted, key, chunk.iv);
    }
  }

  /**
   * Encrypt JSON data
   */
  static async encryptJSON<T>(data: T, key: CryptoKey): Promise<EncryptionResult> {
    const json = JSON.stringify(data);
    return this.encryptString(json, key);
  }

  /**
   * Decrypt JSON data
   */
  static async decryptJSON<T>(
    encryptedData: ArrayBuffer,
    key: CryptoKey,
    ivBase64: string
  ): Promise<T> {
    const json = await this.decryptString(encryptedData, key, ivBase64);
    return JSON.parse(json) as T;
  }

  /**
   * Create an encrypted package with metadata
   */
  static async createEncryptedPackage(
    data: ArrayBuffer,
    key: CryptoKey,
    metadata?: Record<string, unknown>
  ): Promise<ArrayBuffer> {
    const { encrypted, iv } = await this.encrypt(data, key);

    // Package format: [4 bytes header length][header JSON][encrypted data]
    const header = {
      iv,
      metadata,
      timestamp: Date.now(),
    };

    const headerJson = JSON.stringify(header);
    const headerBytes = CryptoUtils.stringToArrayBuffer(headerJson);
    const headerLength = new Uint32Array([headerBytes.byteLength]);

    const result = new Uint8Array(
      4 + headerBytes.byteLength + encrypted.byteLength
    );

    result.set(new Uint8Array(headerLength.buffer), 0);
    result.set(new Uint8Array(headerBytes), 4);
    result.set(new Uint8Array(encrypted), 4 + headerBytes.byteLength);

    return result.buffer;
  }

  /**
   * Open an encrypted package
   */
  static async openEncryptedPackage(
    packageData: ArrayBuffer,
    key: CryptoKey
  ): Promise<{ data: ArrayBuffer; metadata?: Record<string, unknown>; timestamp: number }> {
    const bytes = new Uint8Array(packageData);

    // Read header length
    const headerLength = new Uint32Array(bytes.slice(0, 4).buffer)[0];

    // Read and parse header
    const headerBytes = bytes.slice(4, 4 + headerLength);
    const headerJson = CryptoUtils.arrayBufferToString(headerBytes.buffer);
    const header = JSON.parse(headerJson);

    // Read and decrypt data
    const encrypted = bytes.slice(4 + headerLength);
    const data = await this.decrypt(encrypted.buffer, key, header.iv);

    return {
      data,
      metadata: header.metadata,
      timestamp: header.timestamp,
    };
  }
}
