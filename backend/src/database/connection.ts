import { MongoClient, type Db } from "mongodb";
import type { Logger } from "pino";
import type { DbProvider } from "../types";
import { unavailable } from "../utils/errors";
import { initializeDatabase } from "./initialize";

export class DbManager implements DbProvider {
  private client?: MongoClient;
  private db?: Db;
  private ready = false;
  private closed = false;

  constructor(private readonly uri: string, private readonly dbName: string, private readonly log: Logger) {}

  isReady(): boolean {
    return this.ready && !!this.db;
  }

  getDb(): Db {
    if (!this.ready || !this.db) throw unavailable("Database unavailable", "database_unavailable");
    return this.db;
  }

  async connect(): Promise<void> {
    const client = new MongoClient(this.uri, { serverSelectionTimeoutMS: 8000, maxPoolSize: 10, appName: "takna-ai" });
    await client.connect();
    this.client = client;
    this.db = client.db(this.dbName); // explicit database; never the URI default
    await initializeDatabase(this.db, this.log);
    this.ready = true;
  }

  /** Background connect with backoff so /health works during cold start or DB outage. */
  async connectWithRetry(): Promise<void> {
    let delay = 2000;
    while (!this.closed && !this.ready) {
      try {
        await this.connect();
        this.log.info("database connected");
      } catch (e) {
        this.ready = false;
        this.log.error({ reason: e instanceof Error ? e.name : "error" }, "database connect failed; retrying");
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(delay * 2, 30000);
      }
    }
  }

  async ping(): Promise<boolean> {
    if (!this.db) return false;
    try {
      await this.db.command({ ping: 1 });
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    this.ready = false;
    await this.client?.close();
  }
}
