import { NextResponse } from "next/server";

/**
 * The typed JSON error envelope every failure path of the API returns:
 * `{ error, code }` — a human-readable message plus a stable machine code
 * the SDK transport (PR 22) maps to typed results.
 */
export type ApiErrorEnvelope = { error: string; code: string };

export function jsonError(
  status: number,
  code: string,
  error: string,
): NextResponse<ApiErrorEnvelope> {
  return NextResponse.json({ error, code }, { status });
}
