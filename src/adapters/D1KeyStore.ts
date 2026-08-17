import type { D1Database } from "@cloudflare/workers-types";
import { IKeyStore, KeyProvider } from "../ports/IKeyStore.js";
import { encrypt, decrypt } from "../lib/encryption.js";

// Per-user provider API keys, encrypted at rest with AES-GCM (BRG-143). Keys
// are never returned or logged in plaintext outside decrypt()'s return value.
export class D1KeyStore implements IKeyStore {
  constructor(
    private readonly db: D1Database,
    private readonly userId: string,
    private readonly encryptionSecret: string,
  ) {}

  async setKey(provider: KeyProvider, apiKey: string): Promise<void> {
    const encrypted = await encrypt(apiKey, this.encryptionSecret);
    await this.db
      .prepare(
        `INSERT INTO user_provider_keys (user_id, provider, encrypted_key, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (user_id, provider) DO UPDATE SET encrypted_key = excluded.encrypted_key, updated_at = excluded.updated_at`,
      )
      .bind(this.userId, provider, encrypted, new Date().toISOString())
      .run();
  }

  async getKey(provider: KeyProvider): Promise<string | null> {
    const row = await this.db
      .prepare(
        `SELECT encrypted_key FROM user_provider_keys WHERE user_id = ? AND provider = ?`,
      )
      .bind(this.userId, provider)
      .first<{ encrypted_key: string }>();

    if (!row) return null;
    return decrypt(row.encrypted_key, this.encryptionSecret);
  }
}
