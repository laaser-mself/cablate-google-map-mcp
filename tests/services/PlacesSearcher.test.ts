import { readFileSync } from "node:fs";
import { PlacesSearcher } from "../../src/services/PlacesSearcher.js";
import { GoogleMapsTools } from "../../src/services/toolclass.js";

function fixture(name: string) {
  return JSON.parse(readFileSync(new URL(`../fixtures/gmaps/${name}`, import.meta.url), "utf8"));
}

describe("PlacesSearcher", () => {
  it("searchNearby returns center+results and types", async () => {
    const tools = {
      getLocation: jest.fn().mockResolvedValue({ lat: 25.76, lng: -80.19 }),
      searchNearbyPlaces: jest.fn().mockResolvedValue({
        status: "OK",
        next_page_token: "token-123",
        data: fixture("placesNearby.json").results,
      }),
    };
    const searcher = new PlacesSearcher(tools as unknown as GoogleMapsTools);
    const result = await searcher.searchNearby({
      center: { value: "25.76,-80.19", isCoordinates: true },
      keyword: "cafe",
    });
    expect(result.ok).toBe(true);
    expect(result.data?.center.lat).toBe(25.76);
    expect(result.data?.results[0].types).toContain("cafe");
    expect(result.next_page_token).toBe("token-123");
  });

  it("getPlaceDetails includes photos and place_id", async () => {
    const tools = {
      getPlaceDetails: jest.fn().mockResolvedValue({
        status: "OK",
        html_attributions: ["Photo owner"],
        data: fixture("placeDetails.json").result,
      }),
    };
    const searcher = new PlacesSearcher(tools as unknown as GoogleMapsTools);
    const result = await searcher.getPlaceDetails("ChIJj61dQgK6j4AR4GeTYWZsKWw");
    expect(result.ok).toBe(true);
    expect(result.data?.place_id).toBe("ChIJj61dQgK6j4AR4GeTYWZsKWw");
    expect(result.data?.photos?.length).toBeGreaterThan(0);
    expect(result.data?.reviews?.[0].author_url).toBeDefined();
    expect(result.html_attributions).toEqual(["Photo owner"]);
  });

  it("geocode returns alternates", async () => {
    const tools = {
      geocodeRaw: jest.fn().mockResolvedValue({ status: "OK", data: fixture("geocode.json").results }),
    };
    const searcher = new PlacesSearcher(tools as unknown as GoogleMapsTools);
    const result = await searcher.geocode({ address: "Springfield" });
    expect(result.data?.alternates.length).toBe(1);
    expect(result.data?.address_components).toBeDefined();
  });

  it("reverseGeocode includes geometry", async () => {
    const tools = {
      reverseGeocodeRaw: jest.fn().mockResolvedValue({ status: "OK", data: fixture("geocode.json").results }),
    };
    const searcher = new PlacesSearcher(tools as unknown as GoogleMapsTools);
    const result = await searcher.reverseGeocode({ latitude: 39.78, longitude: -89.65 });
    expect(result.data?.geometry).toBeDefined();
    expect(result.data?.alternates.length).toBe(1);
  });

  it("calculateDistanceMatrix returns element status", async () => {
    const tools = {
      calculateDistanceMatrix: jest.fn().mockResolvedValue({
        status: "OK",
        data: {
          origin_addresses: ["A"],
          destination_addresses: ["B"],
          elements: [[{ status: "OK", distance: { value: 1, text: "1 m" } }]],
          distances: [[{ value: 1, text: "1 m" }]],
          durations: [[{ value: 1, text: "1 s" }]],
        },
      }),
    };
    const searcher = new PlacesSearcher(tools as unknown as GoogleMapsTools);
    const result = await searcher.calculateDistanceMatrix(["A"], ["B"]);
    expect(result.data?.elements[0][0].status).toBe("OK");
  });

  it("getDirections sums all legs and does not invent departure time", async () => {
    const tools = {
      getDirections: jest.fn().mockResolvedValue({ status: "OK", data: fixture("directions.json") }),
    };
    const searcher = new PlacesSearcher(tools as unknown as GoogleMapsTools);
    const result = await searcher.getDirections("A", "B", "driving", {});
    expect(result.data?.total_distance.value).toBe(300);
    expect(result.data?.total_duration.value).toBe(30);
    expect(result.data?.copyrights).toContain("Google");
    expect(tools.getDirections.mock.calls[0][3]).toBeUndefined();
  });

  it("getElevation returns resolution", async () => {
    const tools = {
      getElevation: jest.fn().mockResolvedValue({
        status: "OK",
        data: [{ elevation: 10.5, location: { lat: 1, lng: 2 }, resolution: 4.7 }],
      }),
    };
    const searcher = new PlacesSearcher(tools as unknown as GoogleMapsTools);
    const result = await searcher.getElevation({ locations: [{ latitude: 1, longitude: 2 }] });
    expect(result.data?.[0].resolution).toBe(4.7);
  });

  it("returns ok false on thrown errors", async () => {
    const tools = {
      getPlaceDetails: jest.fn().mockRejectedValue(new Error("network")),
    };
    const searcher = new PlacesSearcher(tools as unknown as GoogleMapsTools);
    const result = await searcher.getPlaceDetails("x");
    expect(result.ok).toBe(false);
    expect(result.error_message).toBe("network");
  });
});
