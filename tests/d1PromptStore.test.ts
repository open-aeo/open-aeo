import { describe, it, expect } from "vitest";
import { D1PromptStore } from "../src/adapters/D1PromptStore.js";
import { createFakeD1 } from "./helpers/fakeD1.js";

describe("D1PromptStore", () => {
  it("creates and lists a prompt", async () => {
    const store = new D1PromptStore(createFakeD1(), "user-1");
    const created = await store.create({
      query: "best crm",
      targetDomain: "example.com",
      brandName: "Example",
      engines: ["perplexity"],
    });

    expect(created.id).toBeTruthy();
    expect(created.createdAt).toBeTruthy();

    const prompts = await store.list();
    expect(prompts).toEqual([created]);
  });

  it("lists newest first", async () => {
    const store = new D1PromptStore(createFakeD1(), "user-1");
    const a = await store.create({
      query: "a",
      targetDomain: "example.com",
      brandName: null,
      engines: ["perplexity"],
    });
    const b = await store.create({
      query: "b",
      targetDomain: "example.com",
      brandName: null,
      engines: ["chatgpt"],
    });

    const prompts = await store.list();
    expect(prompts.map((p) => p.id)).toEqual([b.id, a.id]);
  });

  it("deletes a prompt", async () => {
    const store = new D1PromptStore(createFakeD1(), "user-1");
    const created = await store.create({
      query: "best crm",
      targetDomain: "example.com",
      brandName: null,
      engines: ["perplexity", "chatgpt"],
    });

    await store.delete(created.id);
    expect(await store.list()).toEqual([]);
  });

  it("keeps two users' prompts isolated", async () => {
    const db = createFakeD1();
    const storeA = new D1PromptStore(db, "user-a");
    const storeB = new D1PromptStore(db, "user-b");

    await storeA.create({
      query: "a's query",
      targetDomain: "example.com",
      brandName: null,
      engines: ["perplexity"],
    });
    await storeB.create({
      query: "b's query",
      targetDomain: "example.com",
      brandName: null,
      engines: ["perplexity"],
    });

    expect(await storeA.list()).toHaveLength(1);
    expect((await storeA.list())[0].query).toBe("a's query");
    expect(await storeB.list()).toHaveLength(1);
    expect((await storeB.list())[0].query).toBe("b's query");
  });

  it("a user cannot delete another user's prompt", async () => {
    const db = createFakeD1();
    const storeA = new D1PromptStore(db, "user-a");
    const storeB = new D1PromptStore(db, "user-b");

    const created = await storeA.create({
      query: "a's query",
      targetDomain: "example.com",
      brandName: null,
      engines: ["perplexity"],
    });

    await storeB.delete(created.id);
    expect(await storeA.list()).toHaveLength(1);
  });
});
