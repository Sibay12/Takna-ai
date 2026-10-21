import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (f !== "tests") walk(p, out); }
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

describe("no destructive database operations in application source", () => {
  const files = walk(join(__dirname, ".."));
  const forbidden = [/dropDatabase/, /\.drop\s*\(/, /dropCollection/, /renameCollection/, /deleteMany\(\s*\{\s*\}\s*\)/, /\.collection\(\s*["'`]/];
  it("contains none of the forbidden patterns", () => {
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const re of forbidden) {
        // collections.ts is the single place allowed to call db.collection(), with a variable name
        expect(re.test(src), `${file} matches ${re}`).toBe(false);
      }
    }
  });
});
