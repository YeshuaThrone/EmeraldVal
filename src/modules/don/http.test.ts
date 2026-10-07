import { describe, expect, it } from "vitest";
import { clientIdentity } from "./http";
import type { NextRequest } from "next/server";

function requestWith(
  headers: Record<string, string>,
): NextRequest {
  return new Request("http://localhost:3000/api/v1/vaults", {
    headers,
  }) as NextRequest;
}

describe("clientIdentity", () => {
  it("prefers the first x-forwarded-for hop", () => {
    expect(
      clientIdentity(requestWith({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" })),
    ).toBe("1.1.1.1");
  });

  it("falls back to x-real-ip then unknown", () => {
    expect(clientIdentity(requestWith({ "x-real-ip": "9.9.9.9" }))).toBe(
      "9.9.9.9",
    );
    expect(clientIdentity(requestWith({}))).toBe("unknown");
  });
});
