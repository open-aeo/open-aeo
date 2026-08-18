export type KeyProvider = "perplexity" | "openai";

export interface IKeyStore {
  setKey(provider: KeyProvider, apiKey: string): Promise<void>;
  getKey(provider: KeyProvider): Promise<string | null>;
}
