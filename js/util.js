// Small shared helpers.

// Letters and digits that are hard to mix up when read aloud (no 0/o, 1/l/i).
const ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

// A random, unguessable id. 20 characters from 31 symbols is about 99 bits.
export function randomId(length = 20) {
  const bytes = new Uint8Array(length * 2);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < bytes.length && out.length < length; i++) {
    // Reject values that would bias the pick toward the start of the alphabet.
    if (bytes[i] < 248) out += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
  }
  return out.length === length ? out : out + randomId(length - out.length);
}

// Reject with `label` if `promise` has not settled within `ms`.
export function withTimeout(promise, ms, label = 'timeout') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
