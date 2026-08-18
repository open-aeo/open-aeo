import { describe, it, expect } from "vitest";
import { D1KeyStore } from "../src/adapters/D1KeyStore.js";
import { createFakeD1 } from "./helpers/fakeD1.js";

describe("D1KeyStore", () => {
  it("round-trips a set key", async () => {
    const store = new D1KeyStore(createFakeD1(), "user-1", "test-secret");
    await store.setKey("perplexity", "sk-perplexity-abc");
    expect(await store.getKey("perplexity")).toBe("sk-perplexity-abc");
  });

  it("returns null for a key that was never set", async () => {
    const store = new D1KeyStore(createFakeD1(), "user-1", "test-secret");
    expect(await store.getKey("openai")).toBeNull();
  });

  it("overwrites an existing key for the same provider", async () => {
    const store = new D1KeyStore(createFakeD1(), "user-1", "test-secret");
    await store.setKey("perplexity", "sk-old");
    await store.setKey("perplexity", "sk-new");
    expect(await store.getKey("perplexity")).toBe("sk-new");
  });

  it("keeps two users' keys isolated", async () => {
    const db = createFakeD1();
    const storeA = new D1KeyStore(db, "user-a", "test-secret");
    const storeB = new D1KeyStore(db, "user-b", "test-secret");

    await storeA.setKey("perplexity", "sk-user-a");
    await storeB.setKey("perplexity", "sk-user-b");

    expect(await storeA.getKey("perplexity")).toBe("sk-user-a");
    expect(await storeB.getKey("perplexity")).toBe("sk-user-b");
  });

  it("keeps perplexity and openai keys for the same user independent", async () => {
    const store = new D1KeyStore(createFakeD1(), "user-1", "test-secret");
    await store.setKey("perplexity", "sk-perplexity");
    await store.setKey("openai", "sk-openai");

    expect(await store.getKey("perplexity")).toBe("sk-perplexity");
    expect(await store.getKey("openai")).toBe("sk-openai");
  });
});
