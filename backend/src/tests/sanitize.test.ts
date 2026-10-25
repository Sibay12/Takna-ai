import { describe, expect, it } from "vitest";
import { sanitizeReply } from "../services/sanitize";

describe("white-label sanitizer", () => {
  it("rewrites self-introductions and the vendor", () => {
    const r = sanitizeReply("I am Gemini, a large language model trained by Google.");
    expect(r).not.toMatch(/gemini|google/i);
    expect(r).toContain("TAKNA");
    const c = sanitizeReply("I'm Claude, made by Anthropic.");
    expect(c).not.toMatch(/claude|anthropic/i);
    expect(c).toContain("TAKNA AI");
  });
  it("rewrites model names and ids", () => {
    const r = sanitizeReply("Try gemini-1.5-pro, Claude 3.5 Sonnet, claude-sonnet-4, or GPT-4o.");
    expect(r).not.toMatch(/gemini|claude|gpt/i);
  });
  it("rewrites ChatGPT, OpenAI, DeepMind and Google Gemini", () => {
    const r = sanitizeReply("ChatGPT by OpenAI and Google Gemini from Google DeepMind");
    expect(r).not.toMatch(/chatgpt|openai|gemini|deepmind/i);
  });
  it("rewrites Hindi spellings", () => {
    expect(sanitizeReply("मैं जेमिनी हूँ")).toBe("मैं TAKNA AI हूँ");
    expect(sanitizeReply("यह एंथ्रोपिक ने बनाया")).toContain("TAKNA AI");
  });
  it("rewrites the exact configured model id", () => {
    expect(sanitizeReply("I run on gemini-flash-latest today", ["gemini-flash-latest"])).not.toMatch(/gemini/i);
  });
  it("does not damage ordinary content", () => {
    for (const t of [
      "Claude Shannon founded information theory.",
      "Claude Monet painted water lilies.",
      "Gemini is the third sign of the zodiac.",
      "Gmail was developed by Google in 2004.",
      "I got an email from Google today.",
      "Use Google Maps to find the route.",
    ]) expect(sanitizeReply(t)).toBe(t);
  });
  it("leaves already-clean replies alone", () => {
    expect(sanitizeReply("Hello! I'm TAKNA AI, built by TAKNA TECHNOLOGY.")).toBe("Hello! I'm TAKNA AI, built by TAKNA TECHNOLOGY.");
  });
  it("does not stack replacements", () => {
    expect(sanitizeReply("I am Google Gemini")).toBe("I am TAKNA AI");
  });
});
