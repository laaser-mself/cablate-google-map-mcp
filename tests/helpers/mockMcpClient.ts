import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export async function connectMockMcpClient(baseUrl: string) {
  const client = new Client({ name: "mcp-test-client", version: "0.2.0" });
  const transport = new StreamableHTTPClientTransport(new URL(baseUrl));
  await client.connect(transport);
  return {
    client,
    async listTools() {
      return client.listTools();
    },
    async callTool(name: string, args: Record<string, unknown>) {
      return client.callTool({ name, arguments: args });
    },
    async close() {
      await client.close();
    },
  };
}

export function parseToolJson(result: any): any {
  const text = result.content?.[0]?.text;
  return JSON.parse(text);
}
