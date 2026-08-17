// HMAC signing helpers for the OAuth anti-CSRF nonce cookie (BRG-143). Web
// Crypto only — no Node crypto module — so this runs unchanged on Workers.

function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToUint8Array(hex: string): Uint8Array {
  const pairs = hex.match(/.{2}/g);
  if (!pairs) return new Uint8Array(0);
  return new Uint8Array(pairs.map((byte) => Number.parseInt(byte, 16)));
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Generate a cryptographically random ID as a hex string. */
export async function generateId(length = 32): Promise<string> {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return uint8ArrayToHex(bytes);
}

/** Sign a value with HMAC-SHA256 and return `<value>.<hmac-hex>`. */
export async function sign(value: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );
  const sigHex = uint8ArrayToHex(new Uint8Array(signature));
  return `${value}.${sigHex}`;
}

/**
 * Verify a signed value produced by `sign`. Returns the original value if
 * valid, or null if the signature is invalid.
 */
export async function verify(
  signed: string,
  secret: string,
): Promise<string | null> {
  const lastDot = signed.lastIndexOf(".");
  if (lastDot === -1) return null;

  const value = signed.slice(0, lastDot);
  const sigHex = signed.slice(lastDot + 1);

  const key = await importHmacKey(secret);
  const encoder = new TextEncoder();
  const sigBytes = hexToUint8Array(sigHex);
  const isValid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes as BufferSource,
    encoder.encode(value),
  );

  return isValid ? value : null;
}
