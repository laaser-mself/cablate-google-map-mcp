import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import express, { Request, Response } from "express";
import { Server } from "http";
import { randomUUID } from "node:crypto";
import { Logger } from "../index.js";

const VERSION = "0.0.1";

const DEFAULT_SESSION_IDLE_MS = 30 * 1000;
const DEFAULT_MAX_SESSIONS = 5000;
const DEFAULT_SESSION_SWEEP_MS = 60 * 1000;

// Define a structure for tool configurations
export interface ToolConfig {
  name: string;
  description: string;
  schema: any; // Adjust type as per actual SDK (e.g., ZodSchema)
  action: (params: any) => Promise<any>; // Adjust type for params and return
}

interface Session {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  createdAt: number;
  lastActivity: number;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export class BaseMcpServer {
  private readonly tools: ToolConfig[];
  private readonly sessions = new Map<string, Session>();
  private httpServer: Server | null = null;
  private sessionSweepTimer: ReturnType<typeof setInterval> | null = null;
  private readonly serverName: string;
  private readonly sessionIdleMs: number;
  private readonly maxSessions: number;
  private readonly sessionSweepMs: number;

  constructor(name: string, tools: ToolConfig[]) {
    this.serverName = name;
    this.tools = tools;
    this.sessionIdleMs = parsePositiveInt(process.env.MCP_SESSION_IDLE_MS, DEFAULT_SESSION_IDLE_MS);
    this.maxSessions = parsePositiveInt(process.env.MCP_MAX_SESSIONS, DEFAULT_MAX_SESSIONS);
    this.sessionSweepMs = parsePositiveInt(process.env.MCP_SESSION_SWEEP_MS, DEFAULT_SESSION_SWEEP_MS);
  }

  private createSessionServer(): McpServer {
    const server = new McpServer(
      {
        name: this.serverName,
        version: VERSION,
      },
      {
        capabilities: {
          logging: {},
          tools: {},
        },
      }
    );

    for (const tool of this.tools) {
      server.tool(tool.name, tool.description, tool.schema, async (params: any) => tool.action(params));
    }

    return server;
  }

  private touchSession(session: Session): void {
    session.lastActivity = Date.now();
  }

  private async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    this.sessions.delete(sessionId);

    try {
      await session.server.close();
    } catch (error) {
      Logger.error(`[${this.serverName}] Error closing MCP server for session ${sessionId}:`, error);
    }

    try {
      await session.transport.close();
    } catch (error) {
      Logger.error(`[${this.serverName}] Error closing transport for session ${sessionId}:`, error);
    }
  }

  private async closeAllSessions(): Promise<void> {
    const sessionIds = [...this.sessions.keys()];
    await Promise.all(sessionIds.map((sessionId) => this.closeSession(sessionId)));
  }

  private sweepIdleSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastActivity >= this.sessionIdleMs) {
        Logger.log(`[${this.serverName}] Closing idle session: ${sessionId}`);
        void this.closeSession(sessionId);
      }
    }
  }

  private startSessionSweeper(): void {
    if (this.sessionSweepTimer) {
      return;
    }

    this.sessionSweepTimer = setInterval(() => {
      this.sweepIdleSessions();
    }, this.sessionSweepMs);
  }

  private stopSessionSweeper(): void {
    if (!this.sessionSweepTimer) {
      return;
    }

    clearInterval(this.sessionSweepTimer);
    this.sessionSweepTimer = null;
  }

  private async createAndConnectSession(
    transport: StreamableHTTPServerTransport,
    session: Session
  ): Promise<void> {
    transport.onclose = () => {
      const sessionId = transport.sessionId;
      if (!sessionId) {
        return;
      }

      if (this.sessions.delete(sessionId)) {
        Logger.log(`[${this.serverName}] Session closed: ${sessionId}`);
        void session.server.close().catch((error) => {
          Logger.error(`[${this.serverName}] Error closing MCP server for session ${sessionId}:`, error);
        });
      }
    };

    await session.server.connect(transport);
  }

  private sendJsonRpcError(res: Response, status: number, message: string): void {
    res.status(status).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message,
      },
      id: null,
    });
  }

  async connect(transport: Transport): Promise<void> {
    const server = this.createSessionServer();
    await server.connect(transport);

    // Ensure stdout is only used for JSON messages (stdio transport)
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: any, encoding?: any, callback?: any) => {
      if (typeof chunk === "string" && !chunk.startsWith("{")) {
        return true;
      }
      return originalStdoutWrite(chunk, encoding, callback);
    };

    Logger.log(`${this.serverName} connected and ready to process requests`);
  }

  async startHttpServer(port: number): Promise<number> {
    const app = express();
    app.use(express.json());

    app.get("/", (req: Request, res: Response) => {
      res.status(200).send("The flim is okee dokee");
    });

    app.post("/mcp", async (req: Request, res: Response) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      try {
        if (sessionId) {
          const session = this.sessions.get(sessionId);
          if (!session) {
            this.sendJsonRpcError(res, 400, "Bad Request: No valid session ID provided");
            return;
          }

          this.touchSession(session);
          await session.transport.handleRequest(req, res, req.body);
          Logger.debug(
            `[${this.serverName}] POST /mcp session=${sessionId} method=${req.body?.method ?? "unknown"} status=${res.statusCode}`
          );
          return;
        }

        if (!isInitializeRequest(req.body)) {
          this.sendJsonRpcError(res, 400, "Bad Request: No valid session ID provided");
          return;
        }

        if (this.sessions.size >= this.maxSessions) {
          this.sendJsonRpcError(res, 503, "Service Unavailable: Maximum session limit reached");
          return;
        }

        const server = this.createSessionServer();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (initializedSessionId) => {
            this.sessions.set(initializedSessionId, session);
            Logger.log(`[${this.serverName}] New session initialized: ${initializedSessionId} (active: ${this.sessions.size})`);
          },
        });

        const session: Session = {
          server,
          transport,
          createdAt: Date.now(),
          lastActivity: Date.now(),
        };
        await this.createAndConnectSession(transport, session);
        await transport.handleRequest(req, res, req.body);
        Logger.debug(`[${this.serverName}] POST /mcp initialize status=${res.statusCode}`);
      } catch (error) {
        Logger.error(`[${this.serverName}] Error handling MCP POST request:`, error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: "Internal server error",
            },
            id: null,
          });
        }
      }
    });

    const handleSessionRequest = async (req: Request, res: Response) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (!sessionId) {
        res.status(400).send("Invalid or missing session ID");
        return;
      }

      const session = this.sessions.get(sessionId);
      if (!session) {
        res.status(400).send("Invalid or missing session ID");
        return;
      }

      try {
        this.touchSession(session);
        await session.transport.handleRequest(req, res);
        Logger.debug(`[${this.serverName}] ${req.method} /mcp session=${sessionId} status=${res.statusCode}`);
      } catch (error) {
        Logger.error(`[${this.serverName}] Error handling MCP ${req.method} request:`, error);
        if (!res.headersSent) {
          res.status(500).send("Internal server error");
        }
      }
    };

    app.get("/mcp", handleSessionRequest);
    app.delete("/mcp", handleSessionRequest);

    this.startSessionSweeper();

    return new Promise((resolve, reject) => {
      this.httpServer = app.listen(port, "0.0.0.0", () => {
        const address = this.httpServer!.address();
        const boundPort = typeof address === "object" && address ? address.port : port;
        Logger.log(`[${this.serverName}] HTTP server listening on port ${boundPort}`);
        Logger.log(`[${this.serverName}] MCP endpoint available at http://[IP]:${boundPort}/mcp`);
        Logger.log(
          `[${this.serverName}] Session limits: max=${this.maxSessions}, idleMs=${this.sessionIdleMs}, sweepMs=${this.sessionSweepMs}`
        );
        resolve(boundPort);
      });
      this.httpServer.on("error", reject);
    });
  }

  async stopHttpServer(): Promise<void> {
    if (!this.httpServer) {
      Logger.error(`[${this.serverName}] HTTP server is not running or already stopped.`);
      return;
    }

    this.stopSessionSweeper();

    return new Promise((resolve, reject) => {
      this.httpServer!.close((err: Error | undefined) => {
        if (err) {
          Logger.error(`[${this.serverName}] Error stopping HTTP server:`, err);
          reject(err);
          return;
        }

        Logger.log(`[${this.serverName}] HTTP server stopped.`);
        this.httpServer = null;

        this.closeAllSessions()
          .then(() => {
            Logger.log(`[${this.serverName}] All sessions closed.`);
            resolve();
          })
          .catch((sessionCloseErr) => {
            Logger.error(`[${this.serverName}] Error during session cleanup:`, sessionCloseErr);
            reject(sessionCloseErr);
          });
      });
    });
  }
}
