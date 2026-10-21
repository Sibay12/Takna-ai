import { badRequest } from "./errors";

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Validates a project-relative file path. Rejects absolute paths, drive letters, backslashes,
 * NUL bytes, empty/"."/".." segments, hidden-file segments and overly deep or long paths.
 */
export function validateRelativePath(input: string): string {
  if (typeof input !== "string" || input.length === 0 || input.length > 200) throw badRequest("Invalid file path", "invalid_path");
  if (input.includes("\\") || input.includes("\0") || input.startsWith("/") || /^[A-Za-z]:/.test(input)) {
    throw badRequest("Invalid file path", "invalid_path");
  }
  const segments = input.split("/");
  if (segments.length > 8) throw badRequest("File path too deep", "invalid_path");
  for (const s of segments) {
    if (!SEGMENT.test(s)) throw badRequest("Invalid file path", "invalid_path");
  }
  return segments.join("/");
}
