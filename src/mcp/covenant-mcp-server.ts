import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { CovenantMasterEngineFacade } from "@/covenant-sdk/covenant-master-production-sdk";
import { CovenantMcpRegistry } from "@/covenant-sdk/mcp-registry";
import { CovenantMcpToolHost } from "@/covenant-sdk/mcp-tools";

const registry = new CovenantMcpRegistry();
const masterEngine = new CovenantMasterEngineFacade();
const tools = new CovenantMcpToolHost(registry, masterEngine);

const server = new Server(
  {
    name: "covenant-royalty-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [...tools.listTools()],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = request.params.arguments;
  const parsedArgs =
    typeof args === "object" && args !== null && !Array.isArray(args)
      ? (args as Record<string, unknown>)
      : undefined;

  const result = await tools.callTool(name, parsedArgs);
  return {
    isError: result.isError,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(result.payload, null, 2),
      },
    ],
  };
});

export async function startCovenantMcpServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function isDirectRun(): boolean {
  const invoked = process.argv[1];
  return typeof invoked === "string" && invoked.includes("covenant-mcp-server");
}

if (isDirectRun()) {
  startCovenantMcpServer().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : "unknown_error";
    console.error(message);
    process.exitCode = 1;
  });
}
