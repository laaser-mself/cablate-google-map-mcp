import { buildToolResult, failToolResult, gmapsCaughtToEnvelope, toMcpContent } from "../../src/services/mapsResponse.js";

describe("mapsResponse", () => {
  it("sets ok true for OK and ZERO_RESULTS", () => {
    expect(buildToolResult("maps_geocode", { status: "OK" }, { n: 1 }).ok).toBe(true);
    expect(buildToolResult("maps_geocode", { status: "ZERO_RESULTS" }, null).ok).toBe(true);
  });

  it("copies envelope fields", () => {
    const result = buildToolResult(
      "search_nearby",
      { status: "OK", html_attributions: ["a"], next_page_token: "t1", error_message: undefined },
      { results: [] }
    );
    expect(result.tool).toBe("search_nearby");
    expect(result.html_attributions).toEqual(["a"]);
    expect(result.next_page_token).toBe("t1");
  });

  it("failToolResult marks ok false", () => {
    const result = failToolResult("maps_geocode", "boom", "ERROR");
    expect(result.ok).toBe(false);
    expect(result.data).toBeNull();
    expect(result.error_message).toBe("boom");
  });

  it("toMcpContent serializes JSON and sets isError", () => {
    const mcp = toMcpContent(failToolResult("x", "nope"));
    expect(mcp.isError).toBe(true);
    const parsed = JSON.parse(mcp.content[0].text);
    expect(parsed.ok).toBe(false);
  });

  it("gmapsCaughtToEnvelope reads Cloud 403 JSON", () => {
    const error = Object.assign(new Error("Request failed with status code 403"), {
      response: {
        status: 403,
        data: { error: { message: "Directions API has not been used in project 1", status: "PERMISSION_DENIED" } },
      },
    });
    const parsed = gmapsCaughtToEnvelope(error);
    expect(parsed.status).toBe("PERMISSION_DENIED");
    expect(parsed.error_message).toMatch(/Directions API/);
  });
});
