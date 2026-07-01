/**
 * Peachify AES-GCM decryption.
 *
 * Ported from cinepro-org/core's src/providers/peachify/decrypt.ts.
 *
 * Payload format: base64url(iv).base64url(ciphertext).base64url(authTag)
 * AES-GCM expects ciphertext + authTag combined into a single buffer.
 */

import { webcrypto } from 'crypto';

const subtle = webcrypto.subtle;

const ENCRYPTION_KEY_HEX =
  'YThmMmExYjVlOWM0NzA4MTRmNmIyYzNhNWQ4ZTdmOWMxYTJiM2M0ZDVlM2Y3YThiOGNhZDFlMmQwYTRkNWM1Yg==';

interface EncryptedPayload {
  iv: Uint8Array;
  ciphertext: Uint8Array;
  authTag: Uint8Array;
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return new Uint8Array(Buffer.from(padded, 'base64'));
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string length');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

async function importDecryptionKey(): Promise<webcrypto.CryptoKey> {
  return subtle.importKey(
    'raw',
    hexToBytes(Buffer.from(ENCRYPTION_KEY_HEX, 'base64').toString('utf-8')),
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );
}

function parsePayload(payload: string): EncryptedPayload {
  const parts = payload.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid payload format. Expected: iv.ciphertext.authTag');
  }
  const [ivPart, ciphertextPart, authTagPart] = parts;
  return {
    iv: base64UrlToBytes(ivPart),
    ciphertext: base64UrlToBytes(ciphertextPart),
    authTag: base64UrlToBytes(authTagPart),
  };
}

export async function decryptPeachifyPayload(payload: string): Promise<any | null> {
  try {
    const { iv, ciphertext, authTag } = parsePayload(payload);

    // AES-GCM expects ciphertext + auth tag concatenated
    const encryptedData = new Uint8Array(ciphertext.length + authTag.length);
    encryptedData.set(ciphertext);
    encryptedData.set(authTag, ciphertext.length);

    const key = await importDecryptionKey();
    const decryptedBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedData,
    );

    const decryptedJson = new TextDecoder().decode(decryptedBuffer);
    return JSON.parse(decryptedJson);
  } catch {
    return null;
  }
}