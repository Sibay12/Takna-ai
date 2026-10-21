import { describe, expect, it } from "vitest";
import { validateRelativePath } from "../utils/paths";

describe("file path validation", () => {
  it("accepts normal project paths", () => {
    for (const p of ["index.html", "css/styles.css", "src/components/App.tsx", "README.md"]) {
      expect(validateRelativePath(p)).toBe(p);
    }
  });
  it("rejects traversal, absolute, windows, hidden, empty and deep paths", () => {
    const bad = ["../x", "a/../b", "/etc/passwd", "C:/x", "a\\b", "a//b", "a/", ".env", "./a", "a/./b", "", "a\0b", "a/b/c/d/e/f/g/h/i.txt", "x".repeat(201), "a b.txt"];
    for (const p of bad) expect(() => validateRelativePath(p), JSON.stringify(p)).toThrow();
  });
});
