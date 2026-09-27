import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as createChannel } from "./route";
import { provisionCustomChannel } from "@/streaming/admin/channelProvisioning";

vi.mock("@/streaming/admin/channelProvisioning", () => ({
  provisionCustomChannel: vi.fn(),
}));

const mockedProvision = vi.mocked(provisionCustomChannel);

describe("POST /api/v1/admin/channels/create", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    mockedProvision.mockReset();
  });

  it("denies requests without a configured admin secret", async () => {
    vi.stubEnv("WORFI_ADMIN_SECRET", "");
    const response = await createChannel(
      new Request("http://localhost/api/v1/admin/channels/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channelNumber: 4,
          channelName: "ATX LOCAL NEWS",
          category: "LOCAL_NEWS",
        }),
      }) as never,
    );
    expect(response.status).toBe(403);
    expect(mockedProvision).not.toHaveBeenCalled();
  });

  it("provisions a channel when the admin key matches", async () => {
    vi.stubEnv("WORFI_ADMIN_SECRET", "network-key");
    mockedProvision.mockResolvedValueOnce({
      channelId: "ch-11-route-test-tv",
      channelNumber: 11,
      channelName: "Route Test TV",
      category: "CUSTOM",
    });
    const response = await createChannel(
      new Request("http://localhost/api/v1/admin/channels/create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-worfi-admin-key": "network-key",
        },
        body: JSON.stringify({
          channelNumber: 11,
          channelName: "Route Test TV",
          category: "CUSTOM",
        }),
      }) as never,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      success: boolean;
      channelId: string;
    };
    expect(body.success).toBe(true);
    expect(body.channelId).toBe("ch-11-route-test-tv");
  });
});
