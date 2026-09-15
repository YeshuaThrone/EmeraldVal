import { describe, expect, it } from "vitest";
import { buildChatBroadcast } from "./chatTypes";

describe("buildChatBroadcast", () => {
  it("drops empty messages", () => {
    expect(
      buildChatBroadcast({ channelId: "ch-atx-01", sender: "A", text: "" }),
    ).toBeNull();
  });

  it("trims text to 300 characters and defaults the sender", () => {
    const msg = buildChatBroadcast({
      channelId: "ch-atx-01",
      sender: "",
      text: `  ${"x".repeat(400)}  `,
    });
    expect(msg?.sender).toBe("Anonymous Viewer");
    expect(msg?.text).toHaveLength(300);
    expect(msg?.id).toMatch(/^msg-/);
  });
});
