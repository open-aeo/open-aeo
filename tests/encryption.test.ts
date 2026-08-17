import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "../src/lib/encryption.js";

describe("encryption", () => {
  it("round-trips a plaintext string", async () => {
    const stored = await encrypt("sk-live-abc123", "test-secret");
    expect(await decrypt(stored, "test-secret")).toBe("sk-live-abc123");
  });

  it("produces a different ciphertext each time (fresh salt/iv)", async () => {
    const a = await encrypt("sk-live-abc123", "test-secret");
    const b = await encrypt("sk-live-abc123", "test-secret");
    expect(a).not.toBe(b);
  });

  it("fails to decrypt with the wrong secret", async () => {
    const stored = await encrypt("sk-live-abc123", "test-secret");
    await expect(decrypt(stored, "wrong-secret")).rejects.toThrow();
  });

  it("rejects a malformed stored value", async () => {
    await expect(decrypt("not-the-right-format", "test-secret")).rejects.toThrow(
      "Invalid encrypted value format",
    );
  });
});
