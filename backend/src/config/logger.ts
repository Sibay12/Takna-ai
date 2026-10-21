import pino, { type DestinationStream, type Logger } from "pino";

export const REDACT_PATHS = [
  "req.headers.authorization",
  "headers.authorization",
  "authorization",
  "password",
  "token",
  "idToken",
  "apiKey",
  "privateKey",
  "content",
  "*.password",
  "*.token",
  "*.idToken",
  "*.apiKey",
  "*.privateKey",
  "*.content",
  "MONGODB_URI",
  "GEMINI_API_KEY",
  "FIREBASE_PRIVATE_KEY",
  "ADMIN_BOOTSTRAP_SECRET",
];

export function createLogger(level = "info", stream?: DestinationStream): Logger {
  return pino({ level, redact: { paths: REDACT_PATHS, censor: "[REDACTED]" } }, stream);
}

/** Removes credentials embedded in connection strings from free text. */
export function scrubSecrets(text: string): string {
  return text.replace(/(mongodb(?:\+srv)?:\/\/)[^@\s/]+@/gi, "$1[REDACTED]@");
}
