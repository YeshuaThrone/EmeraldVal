import { afterEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();

vi.mock("pg", () => ({
  Pool: class {
    query = query;
    connect = vi.fn();
  },
}));

describe("creatorInvites", () => {
  afterEach(() => {
    query.mockReset();
    vi.resetModules();
  });

  it("inserts an invite and returns a streaming onboard URL", async () => {
    query.mockResolvedValue({ rows: [] });
    const { createCreatorInvite } = await import("../server/creatorInvites");
    const invite = await createCreatorInvite({
      creatorName: "Maya",
      creatorEmail: "maya@example.com",
      validDays: 3,
    });
    expect(invite.token).toHaveLength(64);
    expect(invite.inviteUrl).toContain("/streaming/onboard?token=");
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO creator_invites"),
      expect.arrayContaining(["Maya", "maya@example.com"]),
    );
  });

  it("returns null when the token is missing or expired", async () => {
    query.mockResolvedValue({ rows: [] });
    const { findValidInvite } = await import("../server/creatorInvites");
    await expect(findValidInvite("missing")).resolves.toBeNull();
  });
});
