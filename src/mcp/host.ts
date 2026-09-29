import { CovenantMasterEngineFacade } from "@/covenant-sdk/facade";
import {
  COVENANT_MCP_TOOLS,
  CovenantMcpToolHost,
} from "@/covenant-sdk/mcp-tools";
import { CovenantMcpRegistry } from "@/covenant-sdk/mcp-registry";
import { CovenantAuthSDK } from "@/covenant-sdk/phone/verification-sdk";
import {
  CovenantPhoneMcpToolHost,
  isPhoneMcpTool,
  PHONE_MCP_TOOLS,
} from "@/covenant-sdk/phone/mcp-tools";
import { getCovenantRegistry } from "@/lib/server/covenantRegistry";
import { getCovenantAuthSdk } from "@/lib/server/covenantPhone";
import { getStore } from "@/lib/server/store";
import type { Store } from "@/lib/server/store";
import { DON_MCP_TOOLS, DonMcpToolHost, isDonMcpTool } from "./don-tools";
import { type McpToolDescriptor, type McpToolResult } from "./types";

export class EmeraldValMcpToolHost {
  private readonly don: DonMcpToolHost;
  private readonly covenant: CovenantMcpToolHost;
  private readonly phone: CovenantPhoneMcpToolHost;

  constructor(
    options: {
      store?: Store;
      registry?: CovenantMcpRegistry;
      engine?: CovenantMasterEngineFacade;
      phone?: CovenantAuthSDK;
    } = {},
  ) {
    this.don = new DonMcpToolHost(options.store ?? getStore());
    this.covenant = new CovenantMcpToolHost(
      options.registry ?? getCovenantRegistry(),
      options.engine ?? new CovenantMasterEngineFacade(),
    );
    this.phone = new CovenantPhoneMcpToolHost(
      options.phone ?? getCovenantAuthSdk(),
    );
  }

  public listTools(): McpToolDescriptor[] {
    return [
      ...DON_MCP_TOOLS,
      ...COVENANT_MCP_TOOLS,
      ...PHONE_MCP_TOOLS,
    ] as McpToolDescriptor[];
  }

  public async callTool(
    name: string,
    args: Record<string, unknown> | undefined,
  ): Promise<McpToolResult> {
    if (isDonMcpTool(name)) {
      return this.don.callTool(name, args);
    }
    if (isPhoneMcpTool(name)) {
      return this.phone.callTool(name, args);
    }
    return this.covenant.callTool(name, args);
  }
}
