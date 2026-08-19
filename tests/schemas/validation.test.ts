import { SearchNearbySchema } from "../../src/tools/maps/searchNearby.js";
import { PlaceDetailsSchema } from "../../src/tools/maps/placeDetails.js";
import { GeocodeSchema } from "../../src/tools/maps/geocode.js";
import { ReverseGeocodeSchema } from "../../src/tools/maps/reverseGeocode.js";
import { DistanceMatrixSchema } from "../../src/tools/maps/distanceMatrix.js";
import { DirectionsSchema } from "../../src/tools/maps/directions.js";
import { ElevationSchema } from "../../src/tools/maps/elevation.js";

describe("Zod adversarial validation", () => {
  it("rejects rankBy=distance without keyword or type", () => {
    const result = SearchNearbySchema.safeParse({
      center: { value: "1,2", isCoordinates: true },
      rankBy: "distance",
    });
    expect(result.success).toBe(false);
  });

  it("rejects rankBy=distance with radius", () => {
    const result = SearchNearbySchema.safeParse({
      center: { value: "1,2", isCoordinates: true },
      rankBy: "distance",
      keyword: "cafe",
      radius: 500,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty fields[] on place details", () => {
    expect(PlaceDetailsSchema.safeParse({ placeId: "x", fields: [] }).success).toBe(false);
  });

  it("rejects geocode with no address/placeId/components", () => {
    expect(GeocodeSchema.safeParse({}).success).toBe(false);
  });

  it("rejects reverse geocode without latlng or placeId", () => {
    expect(ReverseGeocodeSchema.safeParse({}).success).toBe(false);
  });

  it("rejects both departureTime and arrivalTime", () => {
    expect(
      DistanceMatrixSchema.safeParse({
        origins: ["A"],
        destinations: ["B"],
        departureTime: "2026-01-01T00:00:00Z",
        arrivalTime: "2026-01-01T01:00:00Z",
      }).success
    ).toBe(false);
    expect(
      DirectionsSchema.safeParse({
        origin: "A",
        destination: "B",
        departureTime: "2026-01-01T00:00:00Z",
        arrivalTime: "2026-01-01T01:00:00Z",
      }).success
    ).toBe(false);
  });

  it("rejects elevation without exclusive mode", () => {
    expect(ElevationSchema.safeParse({}).success).toBe(false);
    expect(
      ElevationSchema.safeParse({
        locations: [{ latitude: 1, longitude: 2 }],
        path: [{ latitude: 1, longitude: 2 }],
        samples: 3,
      }).success
    ).toBe(false);
  });
});
