import { afterEach, describe, expect, it, vi } from "vitest";
import { isAdminAuthorized } from "../server/adminAuth";

const query = vi.fn();
const connect = vi.fn();

vi.mock("pg", () => ({
  Pool: class {
    query = query;
    connect = connect;
  },
}));

describe("initializeDatabase", () => {
  afterEach(() => {
    query.mockReset();
    connect.mockReset();
    vi.resetModules();
  });

  it("creates channels, segments, invites, and analytics tables in a transaction", async () => {
    const clientQuery = vi.fn().mockResolvedValue({ rows: [] });
    const release = vi.fn();
    connect.mockResolvedValue({ query: clientQuery, release });

    const { initializeDatabase } = await import("./dbInit");
    await initializeDatabase();

    expect(clientQuery).toHaveBeenCalledWith("BEGIN");
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes("creator_invites"))).toBe(
      true,
    );
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes("viewer_analytics"))).toBe(
      true,
    );
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes("ad_campaigns"))).toBe(
      true,
    );
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes("ad_impressions"))).toBe(
      true,
    );
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes("is_active"))).toBe(
      true,
    );
    expect(clientQuery).toHaveBeenCalledWith("COMMIT");
    expect(release).toHaveBeenCalled();
  });

  it("rolls back when a statement fails", async () => {
    const clientQuery = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("cannot create extension"));
    const release = vi.fn();
    connect.mockResolvedValue({ query: clientQuery, release });

    const { initializeDatabase } = await import("./dbInit");
    await expect(initializeDatabase()).rejects.toThrow("cannot create extension");
    expect(clientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(release).toHaveBeenCalled();
  });
});

describe("isAdminAuthorized", () => {
  it("accepts the configured bearer secret", () => {
    expect(isAdminAuthorized("Bearer network-admin-secret-key")).toBe(true);
    expect(isAdminAuthorized("Bearer nope")).toBe(false);
    expect(isAdminAuthorized(undefined)).toBe(false);
  });
});
