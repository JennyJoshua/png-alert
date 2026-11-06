import { assertEquals, assertNotEquals, assertRejects } from "jsr:@std/assert@1.0.14";
import { base64url, decryptVerifier, encryptVerifier, sha256Hex } from "./social-oauth-crypto.ts";

Deno.test("SHA-256 produces the expected state digest", async () => {
  assertEquals(
    await sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

Deno.test("base64url encoding is URL-safe and unpadded", () => {
  const encoded = base64url(new Uint8Array([251, 255, 239]));
  assertEquals(encoded, "-__v");
  assertEquals(encoded.includes("="), false);
});

Deno.test("PKCE verifier encryption round-trips and rejects tampering", async () => {
  const previous = Deno.env.get("SOCIAL_OAUTH_ENCRYPTION_KEY");
  const keyBytes = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
  let binary = "";
  for (const byte of keyBytes) binary += String.fromCharCode(byte);
  Deno.env.set("SOCIAL_OAUTH_ENCRYPTION_KEY", btoa(binary));
  try {
    const verifier = "test-pkce-verifier-with-sufficient-entropy";
    const encrypted = await encryptVerifier(verifier);
    assertEquals(await decryptVerifier(encrypted), verifier);
    const tampered = encrypted.slice(0, -1) + (encrypted.endsWith("A") ? "B" : "A");
    assertNotEquals(tampered, encrypted);
    await assertRejects(() => decryptVerifier(tampered));
  } finally {
    if (previous === undefined) Deno.env.delete("SOCIAL_OAUTH_ENCRYPTION_KEY");
    else Deno.env.set("SOCIAL_OAUTH_ENCRYPTION_KEY", previous);
  }
});
