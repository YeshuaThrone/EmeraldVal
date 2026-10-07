import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getStore, SqliteStore } from "@/lib/server/store";
import type { Store } from "@/lib/server/store";
import { resetRateLimits } from "@/lib/server/rateLimit";
import { GET, POST } from "./route";

vi.mock("@/lib/server/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/store")>();
  return { ...actual, getStore: vi.fn() };
});

const mockedGetStore = vi.mocked(getStore);

beforeEach(() => {
  mockedGetStore.mockReset();
  mockedGetStore.mockReturnValue(new SqliteStore(":memory:"));
  resetRateLimits();
});

function postRequest(body: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/v1/compliance/withholding", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

describe("POST /api/v1/compliance/withholding", () => {
  it("escrows 24% for an unverified creator", async () => {
    const response = await POST(
      postRequest(
        JSON.stringify({ creator_id: "c1", gross_cents: 10_000, tax_year: 2026 }),
      ),
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.withheld_cents).toBe(2400);
    expect(body.net_cents).toBe(7600);
    expect(body.requires_1099).toBe(false);
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await POST(postRequest("not-json"));
    expect(response.status).toBe(400);
  });

  it("returns 500 when the store fails", async () => {
    mockedGetStore.mockReturnValue({
      getCreatorTaxProfile: () => {
        throw new Error("db down");
      },
    } as unknown as Store);
    const response = await POST(
      postRequest(JSON.stringify({ creator_id: "c1", gross_cents: 100 })),
    );
    expect(response.status).toBe(500);
  });
});

describe("GET /api/v1/compliance/withholding", () => {
  it("returns YTD after a posting", async () => {
    await POST(
      postRequest(
        JSON.stringify({ creator_id: "c1", gross_cents: 60_000, tax_year: 2026 }),
      ),
    );
    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/v1/compliance/withholding?creator_id=c1&tax_year=2026",
      ),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.requires_1099).toBe(true);
    expect(body.ytd_gross_cents).toBe(60_000);
  });

  it("requires creator_id", async () => {
    const response = await GET(
      new NextRequest("http://localhost:3000/api/v1/compliance/withholding"),
    );
    expect(response.status).toBe(422);
  });

  it("rejects a non-numeric tax_year", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/v1/compliance/withholding?creator_id=c1&tax_year=nope",
      ),
    );
    expect(response.status).toBe(422);
  });
});
