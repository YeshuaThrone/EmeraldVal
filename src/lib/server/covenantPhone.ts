import { CovenantAuthSDK } from "@/covenant-sdk/phone/verification-sdk";

let sdk: CovenantAuthSDK | null = null;

/**
 * Process-local CovenantAuthSDK shared by HTTP routes and the MCP server.
 * Never dials live WhatsApp, TextBee, or Supabase.
 */
export function getCovenantAuthSdk(): CovenantAuthSDK {
  if (sdk === null) {
    sdk = new CovenantAuthSDK({
      supabaseUrl: process.env.SUPABASE_URL ?? "",
      supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      whatsappApiToken: process.env.WHATSAPP_API_TOKEN,
      whatsappPhoneId: process.env.WHATSAPP_PHONE_ID,
      textbeeApiKey: process.env.TEXTBEE_API_KEY,
      textbeeDeviceId: process.env.TEXTBEE_DEVICE_ID,
    });
  }
  return sdk;
}

export function setCovenantAuthSdk(next: CovenantAuthSDK): void {
  sdk = next;
}

export function resetCovenantAuthSdk(): void {
  sdk = new CovenantAuthSDK();
}
