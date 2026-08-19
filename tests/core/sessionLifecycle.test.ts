import { BaseMcpServer, ToolConfig } from "../../src/core/BaseMcpServer.js";

const NOOP_TOOL: ToolConfig = {
  name: "noop",
  description: "test tool",
  schema: {},
  action: async () => ({ content: [{ type: "text", text: "ok" }] }),
};

const INITIALIZE_BODY = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "session-test", version: "1.0.0" },
  },
};

const CALL_BODY = {
  jsonrpc: "2.0",
  id: 2,
  method: "tools/call",
  params: { name: "noop", arguments: {} },
};

const HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
};

async function startServer(env: Record<string, string>) {
  const previous = { ...process.env };
  Object.assign(process.env, env);
  const server = new BaseMcpServer("session-test", [NOOP_TOOL]);
  process.env = previous;
  const port = await server.startHttpServer(0);
  return {
    url: `http://127.0.0.1:${port}/mcp`,
    stop: () => server.stopHttpServer(),
  };
}

async function initialize(url: string): Promise<string> {
  const response = await fetch(url, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(INITIALIZE_BODY),
  });
  const sessionId = response.headers.get("mcp-session-id");
  if (!sessionId) {
    throw new Error(`No session id returned (status ${response.status})`);
  }
  return sessionId;
}

describe("MCP session lifecycle", () => {
  it("returns 404 for a session ID the server no longer holds", async () => {
    const server = await startServer({ MCP_SESSION_IDLE_MS: "3600000" });
    try {
      const response = await fetch(server.url, {
        method: "POST",
        headers: { ...HEADERS, "Mcp-Session-Id": "bd79df38-0240-432b-8e13-90667ebefa32" },
        body: JSON.stringify(CALL_BODY),
      });
      expect(response.status).toBe(404);
    } finally {
      await server.stop();
    }
  });

  it("returns 404 after the idle sweeper reaps a live session", async () => {
    const server = await startServer({ MCP_SESSION_IDLE_MS: "1", MCP_SESSION_SWEEP_MS: "10" });
    try {
      const sessionId = await initialize(server.url);
      await new Promise((resolve) => setTimeout(resolve, 80));

      const response = await fetch(server.url, {
        method: "POST",
        headers: { ...HEADERS, "Mcp-Session-Id": sessionId },
        body: JSON.stringify(CALL_BODY),
      });
      expect(response.status).toBe(404);
    } finally {
      await server.stop();
    }
  });

  it("keeps a session alive across a gap shorter than the idle window", async () => {
    const server = await startServer({ MCP_SESSION_IDLE_MS: "3600000", MCP_SESSION_SWEEP_MS: "10" });
    try {
      const sessionId = await initialize(server.url);
      await new Promise((resolve) => setTimeout(resolve, 80));

      const response = await fetch(server.url, {
        method: "POST",
        headers: { ...HEADERS, "Mcp-Session-Id": sessionId },
        body: JSON.stringify(CALL_BODY),
      });
      expect(response.status).toBe(200);
    } finally {
      await server.stop();
    }
  });

  it("still returns 400 when a non-initialize request omits the session header", async () => {
    const server = await startServer({});
    try {
      const response = await fetch(server.url, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify(CALL_BODY),
      });
      expect(response.status).toBe(400);
    } finally {
      await server.stop();
    }
  });
});
