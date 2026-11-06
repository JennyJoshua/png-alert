const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function encryptionKey(): Promise<CryptoKey> {
  const encodedKey = Deno.env.get("SOCIAL_OAUTH_ENCRYPTION_KEY");
  if (!encodedKey) throw new Error("SERVER_NOT_CONFIGURED");
  const keyBytes = fromBase64(encodedKey);
  if (keyBytes.length !== 32) throw new Error("SERVER_NOT_CONFIGURED");
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptVerifier(verifier: string): Promise<string> {
  const key = await encryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(verifier));
  return `v1.${base64url(iv)}.${base64url(new Uint8Array(encrypted))}`;
}

export async function decryptVerifier(ciphertext: string): Promise<string> {
  const [version, ivText, encryptedText] = ciphertext.split(".");
  if (version !== "v1" || !ivText || !encryptedText) throw new Error("INVALID_OAUTH_ATTEMPT");
  const key = await encryptionKey();
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(ivText) },
    key,
    fromBase64(encryptedText),
  );
  return decoder.decode(plain);
}
