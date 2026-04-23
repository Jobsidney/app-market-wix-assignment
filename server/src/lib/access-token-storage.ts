import { decrypt, encrypt } from "./crypto.js";

function looksEncrypted(value: string): boolean {
  const parts = value.split(":");
  return parts.length === 3 && parts.every((p) => /^[0-9a-f]+$/i.test(p));
}

export function decodeAccessTokenFromStorage(stored: string): string {
  if (looksEncrypted(stored)) {
    try {
      return decrypt(stored);
    } catch {
      return stored;
    }
  }
  return stored;
}

export function encodeAccessTokenForStorage(token: string): string {
  return encrypt(token);
}
