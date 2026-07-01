/**
 * VidZee AES-CBC decryption + key derivation.
 *
 * Ported from cinepro-org/core's src/providers/vidzee/decrypt.ts.
 *
 * Two functions:
 *   1. deriveKey(e) — derives the AES-CBC key from the /api-key endpoint response
 *      using AES-GCM decryption with a hardcoded SHA-256 key.
 *   2. decrypt(encryptedData, decryptionKey) — decrypts stream links using AES-CBC.
 */

import { webcrypto } from 'crypto';

const subtle = webcrypto.subtle;

function getKeyBytes(key: string): Uint8Array {
  // Treat key as UTF-8 string (like CryptoJS), pad/truncate to 32 bytes
  const encoded = new TextEncoder().encode(key);
  const result = new Uint8Array(32);
  result.set(encoded.slice(0, 32));
  return result;
}

export async function deriveVidZeeKey(e: string): Promise<string> {
  try {
    if (!e) return '';

    const base64ToBytes = (val: string): Uint8Array => {
      const t = Buffer.from(val.replace(/\s+/g, ''), 'base64');
      return new Uint8Array(t);
    };

    const t = base64ToBytes(e);
    if (t.length <= 28) return '';

    const n = t.slice(0, 12); // iv
    const r = t.slice(12, 28); // auth tag
    const a = t.slice(28); // ciphertext

    // AES-GCM expects ciphertext + auth tag concatenated
    const i = new Uint8Array(a.length + r.length);
    i.set(a, 0);
    i.set(r, a.length);

    const encoder = new TextEncoder();
    const l = await subtle.digest('SHA-256', encoder.encode('4f2a9c7d1e8b3a6f0d5c2e9a7b1f4d8c'));

    const o = await subtle.importKey('raw', l, { name: 'AES-GCM' }, false, ['decrypt']);

    const c = await subtle.decrypt(
      { name: 'AES-GCM', iv: n, tagLength: 128 },
      o,
      i,
    );

    return new TextDecoder().decode(c);
  } catch {
    return '';
  }
}

export async function decryptVidZee(encryptedData: string, decryptionKey: string): Promise<string> {
  try {
    if (!encryptedData || !decryptionKey) return '';

    // Step 1: decode outer base64
    const decoded = Buffer.from(encryptedData, 'base64').toString('utf-8');
    const [ivBase64, cipherBase64] = decoded.split(':');
    if (!ivBase64 || !cipherBase64) return '';

    // Step 2: decode IV and ciphertext
    const iv = Uint8Array.from(Buffer.from(ivBase64, 'base64'));
    const cipherBytes = Uint8Array.from(Buffer.from(cipherBase64, 'base64'));

    // Step 3: key handling (CryptoJS-style: UTF-8 padded to 32 bytes)
    const keyBytes = getKeyBytes(decryptionKey);

    const cryptoKey = await subtle.importKey('raw', keyBytes, { name: 'AES-CBC' }, false, ['decrypt']);

    // Step 4: decrypt
    const decrypted = await subtle.decrypt({ name: 'AES-CBC', iv }, cryptoKey, cipherBytes);

    return new TextDecoder().decode(decrypted);
  } catch {
    return '';
  }
}