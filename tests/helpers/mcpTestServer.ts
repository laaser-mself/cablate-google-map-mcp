import { BaseMcpServer } from "../../src/core/BaseMcpServer.js";
import serverConfigs from "../../src/config.js";

export async function startTestMcpServer(): Promise<{ port: number; baseUrl: string; stop: () => Promise<void> }> {
  const config = serverConfigs[0];
  const server = new BaseMcpServer(config.name, config.tools);
  const port = await server.startHttpServer(0);
  return {
    port,
    baseUrl: `http://127.0.0.1:${port}/mcp`,
    stop: () => server.stopHttpServer(),
  };
}
