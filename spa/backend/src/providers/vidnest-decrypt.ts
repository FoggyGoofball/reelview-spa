/**
 * VidNest custom base64 decoder.
 * Adapted from cinepro-org/core's VidNest provider decrypt logic.
 *
 * VidNest uses a non-standard alphabet:
 *   'RB0fpH8ZEyVLkv7c2i6MAJ5u3IKFDxlS1NTsnGaqmXYdUrtzjwObCgQP94hoeW+/='
 *
 * The payload is base64url (no padding), and the decoder reproduces
 * the exact browser-side decoding logic.
 */

const VIDNEST_ALPHABET =
  'RB0fpH8ZEyVLkv7c2i6MAJ5u3IKFDxlS1NTsnGaqmXYdUrtzjwObCgQP94hoeW+/=';

const VIDNEST_REVERSE_MAP: Record<string, number> = {};
for (let i = 0; i < VIDNEST_ALPHABET.length; i++) {
  VIDNEST_REVERSE_MAP[VIDNEST_ALPHABET[i]!] = i;
}

function decodeVidnestBase64(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new Error('VidNest: invalid payload');
  }

  // Pad to multiple of 4
  let padded = input;
  const mod = padded.length % 4;
  if (mod !== 0) {
    padded += '='.repeat(4 - mod);
  }

  const bytes: number[] = [];

  for (let i = 0; i < padded.length; i += 4) {
    const chunk = padded.slice(i, i + 4);

    const c0 = VIDNEST_REVERSE_MAP[chunk[0]!] ?? 64;
    const c1 = VIDNEST_REVERSE_MAP[chunk[1]!] ?? 64;
    const c2 = chunk[2] === '=' ? 64 : (VIDNEST_REVERSE_MAP[chunk[2]!] ?? 64);
    const c3 = chunk[3] === '=' ? 64 : (VIDNEST_REVERSE_MAP[chunk[3]!] ?? 64);

    bytes.push(((c0 << 2) | (c1 >> 4)) & 0xff);

    if (c2 !== 64) {
      bytes.push((((c1 & 0x0f) << 4) | (c2 >> 2)) & 0xff);
    }

    if (c3 !== 64) {
      bytes.push((((c2 & 0x03) << 6) | c3) & 0xff);
    }
  }

  const decoder = new TextDecoder();
  return decoder.decode(new Uint8Array(bytes));
}

export function decryptVidNest<T>(payload: string): T {
  try {
    const decoded = decodeVidnestBase64(payload);
    return JSON.parse(decoded) as T;
  } catch {
    throw new Error('VidNest: failed to parse decrypted payload');
  }
}
