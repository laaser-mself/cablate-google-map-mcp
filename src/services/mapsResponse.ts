import { McpToolResult } from "./mapsTypes.js";

export function buildToolResult<T>(
  tool: string,
  envelope: {
    status?: string;
    error_message?: string;
    html_attributions?: string[];
    next_page_token?: string;
  },
  data: T,
  ok?: boolean
): McpToolResult<T> {
  const status = envelope.status ?? "OK";
  const result: McpToolResult<T> = {
    ok: ok ?? (status === "OK" || status === "ZERO_RESULTS"),
    tool,
    status,
    data,
  };
  if (envelope.error_message) {
    result.error_message = envelope.error_message;
  }
  if (envelope.html_attributions && envelope.html_attributions.length > 0) {
    result.html_attributions = envelope.html_attributions;
  }
  if (envelope.next_page_token) {
    result.next_page_token = envelope.next_page_token;
  }
  return result;
}

export function failToolResult(tool: string, error_message: string, status = "ERROR"): McpToolResult<null> {
  return {
    ok: false,
    tool,
    status,
    error_message,
    data: null,
  };
}

export function toMcpContent<T>(result: McpToolResult<T>, compact = false): { content: Array<{ type: "text"; text: string }>; isError: boolean } {
  return {
    content: [
      {
        type: "text",
        text: compact ? JSON.stringify(result) : JSON.stringify(result, null, 2),
      },
    ],
    isError: !result.ok,
  };
}

export function caughtErrorToMcp(tool: string, error: unknown): { content: Array<{ type: "text"; text: string }>; isError: boolean } {
  const parsed = gmapsCaughtToEnvelope(error);
  return toMcpContent(failToolResult(tool, parsed.error_message, parsed.status));
}

/** Map Axios / GMaps HTTP errors (often 403 API-not-enabled) into envelope status + message. Never dump Axios config (contains `key`). */
export function gmapsCaughtToEnvelope(error: unknown): { status: string; error_message: string } {
  const err = error as { message?: string; response?: { status?: number; data?: unknown } };
  const data = err?.response?.data;

  if (data && typeof data === "object") {
    const maps = data as { status?: string; error_message?: string };
    if (typeof maps.status === "string" && maps.status !== "OK") {
      return { status: maps.status, error_message: maps.error_message || maps.status };
    }
    const cloud = data as { error?: { message?: string; status?: string } };
    if (cloud.error?.message) {
      return {
        status: cloud.error.status || "PERMISSION_DENIED",
        error_message: cloud.error.message,
      };
    }
  }

  const message = error instanceof Error ? error.message : String(error);
  const http403 = err?.response?.status === 403 || /status code 403/.test(message);
  return {
    status: http403 ? "PERMISSION_DENIED" : "ERROR",
    error_message: message,
  };
}
