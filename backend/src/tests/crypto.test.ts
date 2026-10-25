import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, maskKey } from "../services/crypto";

const secret = "s".repeat(40);
describe("key encryption", () => {
  it("round-trips and never stores plaintext", () => {
    const blob = encryptSecret("sk-live-ABCDEFGH12345678", secret);
    expect(blob).not.toContain("ABCDEFGH");
    expect(decryptSecret(blob, secret)).toBe("sk-live-ABCDEFGH12345678");
  });
  it("uses a fresh IV each time", () => {
    expect(encryptSecret("same", secret)).not.toBe(encryptSecret("same", secret));
  });
  it("fails with a different secret or tampering", () => {
    const blob = encryptSecret("value-value", secret);
    expect(() => decryptSecret(blob, "t".repeat(40))).toThrow();
    expect(() => decryptSecret(blob.slice(0, -2) + "AA", secret)).toThrow();
    expect(() => decryptSecret("garbage", secret)).toThrow();
  });
  it("masks keys", () => {
    expect(maskKey("sk-ant-1234567890abcd")).toBe("••••abcd");
    expect(maskKey("short")).toBe("••••");
  });
});
