import { describe, it, expect } from "vitest";
import { generateId, sign, verify } from "../src/lib/crypto.js";

describe("crypto", () => {
  it("generates a hex ID of the requested byte length", async () => {
    const id = await generateId(16);
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it("round-trips a signed value", async () => {
    const signed = await sign("some-nonce", "test-secret");
    expect(await verify(signed, "test-secret")).toBe("some-nonce");
  });

  it("rejects a tampered value", async () => {
    const signed = await sign("some-nonce", "test-secret");
    const tampered = signed.replace("some-nonce", "other-nonce");
    expect(await verify(tampered, "test-secret")).toBeNull();
  });

  it("rejects a value signed with a different secret", async () => {
    const signed = await sign("some-nonce", "secret-a");
    expect(await verify(signed, "secret-b")).toBeNull();
  });

  it("rejects an unsigned value", async () => {
    expect(await verify("no-signature-here", "test-secret")).toBeNull();
  });
});
