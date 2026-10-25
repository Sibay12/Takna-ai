import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(10000),
  MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\/.+/, "must be a mongodb:// or mongodb+srv:// URI"),
  MONGODB_DB_NAME: z.string().regex(/^[A-Za-z0-9_-]{1,38}$/, "letters, digits, _ or - only (max 38 chars)"),
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().email(),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
  CORS_ORIGINS: z.string().default(""),
  ADMIN_BOOTSTRAP_SECRET: z.string().min(16).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  KEY_ENCRYPTION_SECRET: z.string().min(32, "at least 32 characters").optional(),
  INITIAL_SUPER_ADMIN_EMAIL: z.string().email().optional(),
  KEEP_ALIVE: z.enum(["true", "false"]).default("true"),
  PING_URL: z.string().url().optional(),
  RENDER_EXTERNAL_URL: z.string().url().optional(),
  GEMINI_MODEL: z.string().regex(/^[A-Za-z0-9._-]{1,60}$/).default("gemini-flash-latest"),
  AI_DAILY_REQUESTS: z.coerce.number().int().min(0).max(100000).default(30),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(64).max(8192).default(2048),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export interface Config {
  nodeEnv: "development" | "test" | "production";
  port: number;
  mongoUri: string;
  dbName: string;
  firebase: { projectId: string; clientEmail: string; privateKey: string };
  corsOrigins: string[];
  adminBootstrapSecret?: string;
  geminiApiKey?: string;
  keyEncryptionSecret?: string;
  initialSuperAdminEmail?: string;
  keepAliveUrl?: string;
  geminiModel: string;
  aiDailyRequests: number;
  aiMaxOutputTokens: number;
  logLevel: string;
}

/** Validates configuration. Error messages list variable names and rules only, never values. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== ""));
  const r = schema.safeParse(cleaned);
  if (!r.success) {
    const problems = r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid configuration -> ${problems.join("; ")}`);
  }
  const d = r.data;
  return {
    nodeEnv: d.NODE_ENV,
    port: d.PORT,
    mongoUri: d.MONGODB_URI,
    dbName: d.MONGODB_DB_NAME,
    firebase: {
      projectId: d.FIREBASE_PROJECT_ID,
      clientEmail: d.FIREBASE_CLIENT_EMAIL,
      privateKey: d.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
    corsOrigins: d.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),
    adminBootstrapSecret: d.ADMIN_BOOTSTRAP_SECRET,
    geminiApiKey: d.GEMINI_API_KEY,
    keyEncryptionSecret: d.KEY_ENCRYPTION_SECRET,
    initialSuperAdminEmail: d.INITIAL_SUPER_ADMIN_EMAIL?.toLowerCase(),
    keepAliveUrl: d.KEEP_ALIVE === "true" && d.NODE_ENV === "production" ? (d.PING_URL ?? d.RENDER_EXTERNAL_URL) : undefined,
    geminiModel: d.GEMINI_MODEL,
    aiDailyRequests: d.AI_DAILY_REQUESTS,
    aiMaxOutputTokens: d.AI_MAX_OUTPUT_TOKENS,
    logLevel: d.LOG_LEVEL,
  };
}
