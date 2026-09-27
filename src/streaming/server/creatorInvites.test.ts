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

  it("reads invite tokens from ingest bodies and rejects blank ones", async () => {
    const { readInviteToken } = await import("../server/creatorInvites");
    expect(readInviteToken({ inviteToken: " abc " })).toBe("abc");
    expect(readInviteToken({ inviteToken: "" })).toBeNull();
    expect(readInviteToken({})).toBeNull();
  });

  it("rejects unknown invites when Postgres answers empty", async () => {
    query.mockResolvedValue({ rows: [] });
    const { assertCreatorInviteToken } = await import("../server/creatorInvites");
    await expect(assertCreatorInviteToken("missing")).resolves.toEqual({
      ok: false,
      error: "Invalid or expired invite token",
    });
  });

  it("rejects tokens when Postgres is unreachable instead of opening upload", async () => {
    query.mockRejectedValue(
      Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
    );
    const { assertCreatorInviteToken } = await import("../server/creatorInvites");
    await expect(assertCreatorInviteToken("any-token")).resolves.toEqual({
      ok: false,
      error: "Invalid or expired invite token",
    });
  });
});
