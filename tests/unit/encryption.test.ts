import { describe, it, expect } from "vitest";
import { encryptCredential, decryptCredential } from "@/lib/security/encryption";

describe("AES-256-GCM Symmetric Encryption", () => {
  it("encrypts and recovers plaintext credentials cleanly", () => {
    const rawApiKey = "Bearer test_live_sk_983742894729384729";
    const encrypted = encryptCredential(rawApiKey);

    expect(encrypted).not.toEqual(rawApiKey);
    expect(encrypted.split(":")).toHaveLength(3);

    const decrypted = decryptCredential(encrypted);
    expect(decrypted).toBe(rawApiKey);
  });

  it("handles complex tokens and unicode content", () => {
    const secret = "Basic token_with_specialchars!@#$%^&*()_+=~`{}[]|;:,.<>?/:こんにちは世界";
    const encrypted = encryptCredential(secret);
    const decrypted = decryptCredential(encrypted);
    expect(decrypted).toBe(secret);
  });

  it("handles empty or falsy inputs gracefully", () => {
    expect(encryptCredential("")).toBe("");
    expect(decryptCredential("")).toBe("");
  });

  it("generates different ciphertexts for identical plaintext due to random IV", () => {
    const secret = "super_secret_api_token";
    const enc1 = encryptCredential(secret);
    const enc2 = encryptCredential(secret);

    expect(enc1).not.toBe(enc2);
    expect(decryptCredential(enc1)).toBe(secret);
    expect(decryptCredential(enc2)).toBe(secret);
  });

  it("detects ciphertext tampering and fails securely without throwing", () => {
    const secret = "critical_password_or_token";
    const encrypted = encryptCredential(secret);
    const parts = encrypted.split(":");

    // Tamper with ciphertext
    const tamperedCipher = parts[0] + ":" + parts[1] + ":" + Buffer.from("corrupted").toString("base64");
    expect(decryptCredential(tamperedCipher)).toBe("");

    // Tamper with auth tag
    const tamperedTag = parts[0] + ":" + Buffer.from("bad_auth_tag_16b").toString("base64") + ":" + parts[2];
    expect(decryptCredential(tamperedTag)).toBe("");
  });
});
