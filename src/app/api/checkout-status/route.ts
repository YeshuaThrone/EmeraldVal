import { NextResponse } from "next/server";
import { isCheckoutConfigured } from "@/lib/server/checkout";

/**
 * GET /api/checkout-status — the lightweight flag the fan map fetches on
 * mount. `{ enabled: true }` only when STRIPE_SECRET_KEY is configured;
 * native pins then render the real Buy button. Without the key the map
 * keeps the exact PR #20 data-only treatment. Public by design: it leaks
 * nothing but a boolean.
 */
export async function GET() {
  return NextResponse.json({ enabled: isCheckoutConfigured() });
}
