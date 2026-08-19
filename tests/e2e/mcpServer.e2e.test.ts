import { startTestMcpServer } from "../helpers/mcpTestServer.js";
import { connectMockMcpClient, parseToolJson } from "../helpers/mockMcpClient.js";
import { skipIfGoogleApiNotEnabled } from "../helpers/googleApiEnabled.js";

const EXPECTED_TOOLS = [
  "search_nearby",
  "get_place_details",
  "maps_geocode",
  "maps_reverse_geocode",
  "maps_distance_matrix",
  "maps_directions",
  "maps_elevation",
];

describe("MCP server E2E", () => {
  let baseUrl: string;
  let stop: () => Promise<void>;

  beforeAll(async () => {
    const server = await startTestMcpServer();
    baseUrl = server.baseUrl;
    stop = server.stop;
  });

  afterAll(async () => {
    await stop();
  });

  it("connects, lists tools, and calls every registered tool", async () => {
    const mcp = await connectMockMcpClient(baseUrl);
    try {
      const listed = await mcp.listTools();
      const names = listed.tools.map((tool) => tool.name);
      for (const expected of EXPECTED_TOOLS) {
        expect(names).toContain(expected);
      }

      const nearby = parseToolJson(
        await mcp.callTool("search_nearby", {
          center: { value: "25.7617,-80.1918", isCoordinates: true },
          keyword: "restaurant",
        })
      );
      expect(nearby.ok).toBe(true);
      expect(nearby.data.center).toBeDefined();
      expect(Array.isArray(nearby.data.results)).toBe(true);

      const details = parseToolJson(
        await mcp.callTool("get_place_details", { placeId: "ChIJj61dQgK6j4AR4GeTYWZsKWw" })
      );
      expect(details.ok).toBe(true);
      expect(details.data.photos.length).toBeGreaterThan(0);

      const geocode = parseToolJson(await mcp.callTool("maps_geocode", { address: "Miami, FL", region: "us" }));
      expect(geocode.ok).toBe(true);
      expect(geocode.data.location.lat).toBeDefined();

      const reverse = parseToolJson(
        await mcp.callTool("maps_reverse_geocode", { latitude: 25.7617, longitude: -80.1918 })
      );
      expect(reverse.ok).toBe(true);
      expect(reverse.data.address_components).toBeDefined();

      const matrix = parseToolJson(
        await mcp.callTool("maps_distance_matrix", {
          origins: ["Miami, FL"],
          destinations: ["Fort Lauderdale, FL"],
          mode: "driving",
        })
      );
      if (!skipIfGoogleApiNotEnabled(matrix, "Routes API (computeRouteMatrix)")) {
        expect(matrix.ok).toBe(true);
        expect(matrix.data.elements[0][0].status).toBe("OK");
      }

      const directions = parseToolJson(
        await mcp.callTool("maps_directions", { origin: "Miami, FL", destination: "Fort Lauderdale, FL" })
      );
      if (!skipIfGoogleApiNotEnabled(directions, "Routes API (computeRoutes)")) {
        expect(directions.ok).toBe(true);
        expect(directions.data.routes.length).toBeGreaterThan(0);
        expect(directions.data.copyrights).toBeDefined();
      }

      const elevation = parseToolJson(
        await mcp.callTool("maps_elevation", {
          locations: [
            { latitude: 25.7617, longitude: -80.1918 },
            { latitude: 25.79, longitude: -80.2 },
            { latitude: 25.81, longitude: -80.21 },
          ],
        })
      );
      if (!skipIfGoogleApiNotEnabled(elevation, "Elevation API")) {
        expect(elevation.ok).toBe(true);
        expect(elevation.data[0].resolution).toBeDefined();
      }
    } finally {
      await mcp.close();
    }
  });

  it("isolates concurrent sessions", async () => {
    const a = await connectMockMcpClient(baseUrl);
    const b = await connectMockMcpClient(baseUrl);
    try {
      const geoA = parseToolJson(await a.callTool("maps_geocode", { address: "Miami, FL" }));
      const geoB = parseToolJson(await b.callTool("maps_geocode", { address: "Fort Lauderdale, FL" }));
      expect(geoA.ok).toBe(true);
      expect(geoB.ok).toBe(true);
      expect(geoA.data.formatted_address).not.toEqual(geoB.data.formatted_address);
    } finally {
      await a.close();
      await b.close();
    }
  });
});
