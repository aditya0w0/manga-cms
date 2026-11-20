import { describe, it, expect } from "vitest";
import { isPrivateOrRestrictedIp, validateSafeUrl } from "@/lib/security/safe-fetch";

describe("SSRF Prevention & URL Safety Engine", () => {
  it("detects and blocks loopback and private IPv4 addresses", () => {
    expect(isPrivateOrRestrictedIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrRestrictedIp("127.0.0.2")).toBe(true);
    expect(isPrivateOrRestrictedIp("10.0.0.1")).toBe(true);
    expect(isPrivateOrRestrictedIp("10.255.255.255")).toBe(true);
    expect(isPrivateOrRestrictedIp("172.16.0.1")).toBe(true);
    expect(isPrivateOrRestrictedIp("172.31.255.255")).toBe(true);
    expect(isPrivateOrRestrictedIp("192.168.1.1")).toBe(true);
  });

  it("detects and blocks cloud metadata link-local address (AWS/GCP/Azure 169.254.169.254)", () => {
    expect(isPrivateOrRestrictedIp("169.254.169.254")).toBe(true);
    expect(isPrivateOrRestrictedIp("169.254.1.1")).toBe(true);
  });

  it("detects and blocks restricted IPv6 ranges", () => {
    expect(isPrivateOrRestrictedIp("::1")).toBe(true);
    expect(isPrivateOrRestrictedIp("fc00::1")).toBe(true);
    expect(isPrivateOrRestrictedIp("fe80::1")).toBe(true);
    expect(isPrivateOrRestrictedIp("::ffff:127.0.0.1")).toBe(true);
  });

  it("permits standard public internet IP addresses", () => {
    expect(isPrivateOrRestrictedIp("8.8.8.8")).toBe(false);
    expect(isPrivateOrRestrictedIp("1.1.1.1")).toBe(false);
    expect(isPrivateOrRestrictedIp("104.26.0.1")).toBe(false);
  });

  it("rejects malicious or invalid URL schemes", async () => {
    const fileUrl = await validateSafeUrl("file:///etc/passwd");
    expect(fileUrl.safe).toBe(false);
    expect(fileUrl.error).toContain("Disallowed URL protocol");

    const gopherUrl = await validateSafeUrl("gopher://127.0.0.1:6379");
    expect(gopherUrl.safe).toBe(false);

    const invalidSyntax = await validateSafeUrl("not-a-valid-url");
    expect(invalidSyntax.safe).toBe(false);
  });

  it("blocks direct requests to localhost and private literals", async () => {
    const localhostResult = await validateSafeUrl("http://localhost:3000/api");
    expect(localhostResult.safe).toBe(false);

    const ipResult = await validateSafeUrl("http://192.168.0.1:8080/admin");
    expect(ipResult.safe).toBe(false);
  });
});
