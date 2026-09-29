import { CovenantAuthSDK } from "./verification-sdk";

export const PHONE_MCP_TOOLS = [
  {
    name: "send_phone_otp",
    description:
      "POST /api/v1/auth/phone/otp — dispatch a 6-digit OTP via WhatsApp → TextBee → email-to-SMS fallback. Sandbox only; no live WhatsApp, TextBee, or Supabase HTTP.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "Internal user UUID" },
        phone: { type: "string", description: "Target E.164 phone number" },
        carrierDomain: {
          type: "string",
          description: "Optional carrier domain for email-to-SMS",
        },
      },
      required: ["userId", "phone"] as const,
    },
  },
  {
    name: "verify_phone_otp",
    description:
      "POST /api/v1/auth/phone/verify — validate a submitted 6-digit OTP against the sandbox challenge record.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "Internal user UUID" },
        phone: { type: "string", description: "User E.164 phone number" },
        code: { type: "string", description: "6-digit OTP code submitted by user" },
      },
      required: ["userId", "phone", "code"] as const,
    },
  },
] as const;

export type PhoneMcpToolName = (typeof PHONE_MCP_TOOLS)[number]["name"];

export type PhoneMcpToolResult = {
  isError: boolean;
  payload: unknown;
};

const PHONE_NAMES = new Set(PHONE_MCP_TOOLS.map((tool) => tool.name));

export function isPhoneMcpTool(name: string): name is PhoneMcpToolName {
  return PHONE_NAMES.has(name as PhoneMcpToolName);
}

export class CovenantPhoneMcpToolHost {
  constructor(private readonly sdk: CovenantAuthSDK) {}

  public listTools(): typeof PHONE_MCP_TOOLS {
    return PHONE_MCP_TOOLS;
  }

  public async callTool(
    name: string,
    args: Record<string, unknown> | undefined,
  ): Promise<PhoneMcpToolResult> {
    const body = args ?? {};
    if (name === "send_phone_otp") {
      const result = await this.sdk.sendOtp(body);
      return { isError: !result.ok, payload: result };
    }
    if (name === "verify_phone_otp") {
      const result = await this.sdk.verifyOtp(body);
      return { isError: !result.ok, payload: result };
    }
    return {
      isError: true,
      payload: {
        ok: false,
        code: "unknown_tool",
        message: `Unknown tool: ${name}`,
      },
    };
  }
}
