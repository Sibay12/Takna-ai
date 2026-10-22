import { describe, expect, it } from "vitest";
import { chatSystem, codeSystem } from "../services/aiTasks";

describe("system prompts", () => {
  it("text mode has no spoken-style rules", () => {
    expect(chatSystem("en")).not.toMatch(/read aloud/);
  });
  it("voice mode asks for short plain spoken answers", () => {
    const s = chatSystem("hi", "voice");
    expect(s).toMatch(/read aloud/);
    expect(s).toMatch(/Hindi/);
  });
  it("code prompts never claim device control", () => {
    expect(codeSystem("debug", "auto")).toMatch(/cannot control the user's device/);
  });
});
