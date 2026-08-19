import { readFileSync } from "node:fs";
import { GoogleMapsTools } from "../../src/services/toolclass.js";
import { createMockGoogleMapsClient, createMockRoutesClient } from "../helpers/mockGoogleMapsClient.js";

process.env.GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "test-key";

function fixture(name: string) {
  return JSON.parse(readFileSync(new URL(`../fixtures/gmaps/${name}`, import.meta.url), "utf8"));
}

describe("GoogleMapsTools", () => {
  it("searchNearbyPlaces returns envelope and filters minRating", async () => {
    const client = createMockGoogleMapsClient();
    client.placesNearby.mockResolvedValue({ data: fixture("placesNearby.json") });
    const tools = new GoogleMapsTools(client as any);
    const result = await tools.searchNearbyPlaces({
      location: { lat: 25, lng: -80 },
      minRating: 4,
    });
    expect(result.status).toBe("OK");
    expect(result.next_page_token).toBe("token-123");
    expect(result.data[0].name).toBe("Test Cafe");
    expect(client.placesNearby.mock.calls[0][0].params.radius).toBe(1000);
  });

  it("searchNearbyPlaces omits radius when rankBy=distance", async () => {
    const client = createMockGoogleMapsClient();
    client.placesNearby.mockResolvedValue({ data: fixture("placesNearby.json") });
    const tools = new GoogleMapsTools(client as any);
    await tools.searchNearbyPlaces({
      location: { lat: 25, lng: -80 },
      rankBy: "distance",
      keyword: "cafe",
    });
    expect(client.placesNearby.mock.calls[0][0].params.rankby).toBe("distance");
    expect(client.placesNearby.mock.calls[0][0].params.radius).toBeUndefined();
  });

  it("getPlaceDetails requests photos in default fields", async () => {
    const client = createMockGoogleMapsClient();
    client.placeDetails.mockResolvedValue({ data: fixture("placeDetails.json") });
    const tools = new GoogleMapsTools(client as any);
    const result = await tools.getPlaceDetails("ChIJj61dQgK6j4AR4GeTYWZsKWw");
    expect(result.data.photos.length).toBeGreaterThan(0);
    expect(client.placeDetails.mock.calls[0][0].params.fields).toContain("photos");
    expect(client.placeDetails.mock.calls[0][0].params.fields).toContain("place_id");
  });

  it("geocodeRaw returns full results array", async () => {
    const client = createMockGoogleMapsClient();
    client.geocode.mockResolvedValue({ data: fixture("geocode.json") });
    const tools = new GoogleMapsTools(client as any);
    const result = await tools.geocodeRaw({ address: "Springfield" });
    expect(result.data).toHaveLength(2);
    expect(client.geocode.mock.calls[0][0].params).not.toHaveProperty("bounds");
    expect(client.geocode.mock.calls[0][0].params).not.toHaveProperty("place_id");
    expect(client.geocode.mock.calls[0][0].params).not.toHaveProperty("components");
  });

  it("maps Routes API 403 API-disabled body into envelope instead of throwing", async () => {
    const client = createMockGoogleMapsClient();
    const routes = createMockRoutesClient();
    const denied = Object.assign(new Error("Routes API has not been used in project 1 before or it is disabled."), {
      response: {
        status: 403,
        data: {
          error: {
            code: 403,
            message: "Routes API has not been used in project 1 before or it is disabled.",
            status: "PERMISSION_DENIED",
          },
        },
      },
    });
    routes.computeRouteMatrix.mockRejectedValue(denied);
    const tools = new GoogleMapsTools(client as any, routes);
    const result = await tools.calculateDistanceMatrix(["A"], ["B"]);
    expect(result.status).toBe("PERMISSION_DENIED");
    expect(result.error_message).toMatch(/Routes API has not been used/);
    expect(result.data.elements).toEqual([]);
  });

  it("getLocation parses coordinates without API call", async () => {
    const client = createMockGoogleMapsClient();
    const tools = new GoogleMapsTools(client as any);
    const result = await tools.getLocation({ value: "26.1,-80.2", isCoordinates: true });
    expect(result).toEqual({ lat: 26.1, lng: -80.2 });
    expect(client.geocode).not.toHaveBeenCalled();
  });

  it("reverseGeocodeRaw returns all results", async () => {
    const client = createMockGoogleMapsClient();
    client.reverseGeocode.mockResolvedValue({ data: fixture("geocode.json") });
    const tools = new GoogleMapsTools(client as any);
    const result = await tools.reverseGeocodeRaw({ latitude: 39.78, longitude: -89.65 });
    expect(result.data.length).toBe(2);
  });

  it("calculateDistanceMatrix maps Routes matrix elements", async () => {
    const client = createMockGoogleMapsClient();
    const routes = createMockRoutesClient();
    routes.computeRouteMatrix.mockResolvedValue([
      {
        originIndex: 0,
        destinationIndex: 0,
        condition: "ROUTE_EXISTS",
        distanceMeters: 1000,
        duration: "150s",
        staticDuration: "120s",
      },
    ]);
    const tools = new GoogleMapsTools(client as any, routes);
    const result = await tools.calculateDistanceMatrix(["A"], ["B"]);
    expect(result.data.elements[0][0].status).toBe("OK");
    expect(result.data.elements[0][0].duration?.value).toBe(120);
    expect(result.data.origin_addresses).toEqual(["A"]);
    expect(routes.computeRouteMatrix.mock.calls[0][0].routingPreference).toBe("TRAFFIC_UNAWARE");
    expect(routes.computeRouteMatrix.mock.calls[0][0].departureTime).toBeUndefined();
  });

  it("getDirections does not send departureTime when omitted", async () => {
    const client = createMockGoogleMapsClient();
    const routes = createMockRoutesClient();
    routes.computeRoutes.mockResolvedValue({
      routes: [{ description: "I-95", distanceMeters: 300, duration: "30s", legs: [] }],
    });
    const tools = new GoogleMapsTools(client as any, routes);
    await tools.getDirections("A", "B");
    expect(routes.computeRoutes.mock.calls[0][0].departureTime).toBeUndefined();
    expect(routes.computeRoutes.mock.calls[0][0].routingPreference).toBe("TRAFFIC_UNAWARE");
  });

  it("getElevation maps resolution", async () => {
    const client = createMockGoogleMapsClient();
    client.elevation.mockResolvedValue({ data: fixture("elevation.json") });
    const tools = new GoogleMapsTools(client as any);
    const result = await tools.getElevation({ locations: [{ latitude: 25.76, longitude: -80.19 }] });
    expect(result.data[0].resolution).toBe(4.7);
  });
});
