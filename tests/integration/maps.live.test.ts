import { GoogleMapsTools } from "../../src/services/toolclass.js";
import { skipIfGoogleApiNotEnabled } from "../helpers/googleApiEnabled.js";

const GOOGLEPLEX = "ChIJj61dQgK6j4AR4GeTYWZsKWw";

describe("GoogleMapsTools live API", () => {
  const tools = new GoogleMapsTools();

  it("searchNearbyPlaces", async () => {
    const result = await tools.searchNearbyPlaces({
      location: { lat: 25.7617, lng: -80.1918 },
      keyword: "restaurant",
      radius: 1000,
    });
    expect(result.status).toBe("OK");
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("getPlaceDetails", async () => {
    const result = await tools.getPlaceDetails(GOOGLEPLEX);
    expect(result.status).toBe("OK");
    expect(result.data?.photos?.length).toBeGreaterThan(0);
  });

  it("geocodeRaw", async () => {
    const result = await tools.geocodeRaw({ address: "Miami, FL", region: "us" });
    expect(result.data[0].geometry.location.lat).toBeDefined();
  });

  it("reverseGeocodeRaw", async () => {
    const result = await tools.reverseGeocodeRaw({ latitude: 25.7617, longitude: -80.1918 });
    expect(result.data[0].formatted_address).toBeTruthy();
  });

  it("calculateDistanceMatrix", async () => {
    const result = await tools.calculateDistanceMatrix(["Miami, FL"], ["Fort Lauderdale, FL"], "driving");
    if (skipIfGoogleApiNotEnabled(result, "Routes API (computeRouteMatrix)")) return;
    expect(result.status).toBe("OK");
    expect(result.data.elements[0][0].status).toBe("OK");
  });

  it("getDirections without departure_time", async () => {
    const result = await tools.getDirections("Miami, FL", "Fort Lauderdale, FL", "driving");
    if (skipIfGoogleApiNotEnabled(result, "Routes API (computeRoutes)")) return;
    expect(result.status).toBe("OK");
    expect(result.data.routes.length).toBeGreaterThan(0);
  });

  it("getElevation", async () => {
    const result = await tools.getElevation({
      locations: [
        { latitude: 25.7617, longitude: -80.1918 },
        { latitude: 25.79, longitude: -80.2 },
        { latitude: 25.81, longitude: -80.21 },
      ],
    });
    if (skipIfGoogleApiNotEnabled(result, "Elevation API")) return;
    expect(result.status).toBe("OK");
    expect(result.data[0].resolution).toBeDefined();
  });
});
