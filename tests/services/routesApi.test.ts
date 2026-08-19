import {
  buildRoutesBody,
  distanceFromMeters,
  mapComputeRoutes,
  mapRouteMatrix,
  parseDurationSeconds,
  toTravelMode,
  toWaypoint,
} from "../../src/services/routesApi.js";

describe("routesApi mapping", () => {
  it("maps driving to DRIVE and address waypoints", () => {
    expect(toTravelMode("driving")).toBe("DRIVE");
    expect(toWaypoint("Miami, FL")).toEqual({ address: "Miami, FL" });
    expect(toWaypoint("25.76,-80.19")).toEqual({
      location: { latLng: { latitude: 25.76, longitude: -80.19 } },
    });
  });

  it("omits departureTime and uses TRAFFIC_UNAWARE by default", () => {
    const body = buildRoutesBody({ origin: "A", destination: "B", mode: "driving" });
    expect(body.departureTime).toBeUndefined();
    expect(body.routingPreference).toBe("TRAFFIC_UNAWARE");
    expect(body.travelMode).toBe("DRIVE");
  });

  it("parses protobuf durations and meters", () => {
    expect(parseDurationSeconds("150s")).toBe(150);
    expect(distanceFromMeters(1000).text).toBe("1.0 km");
  });

  it("mapRouteMatrix fills a 2d grid from sparse Route Matrix elements", () => {
    const data = mapRouteMatrix(["A"], ["B", "C"], [
      { originIndex: 0, destinationIndex: 1, condition: "ROUTE_EXISTS", distanceMeters: 500, duration: "40s" },
    ]);
    expect(data.elements[0][0].status).toBe("ZERO_RESULTS");
    expect(data.elements[0][1].status).toBe("OK");
    expect(data.elements[0][1].distance?.value).toBe(500);
    expect(data.destination_addresses).toEqual(["B", "C"]);
  });

  it("mapComputeRoutes synthesizes compatibility legs and copyrights", () => {
    const mapped = mapComputeRoutes({
      routes: [
        {
          description: "I-95",
          distanceMeters: 300,
          duration: "30s",
          warnings: ["Check conditions"],
          legs: [
            { distanceMeters: 100, duration: "10s", startLocation: { latLng: { latitude: 1, longitude: 2 } } },
            { distanceMeters: 200, duration: "20s" },
          ],
        },
      ],
    });
    expect(mapped.status).toBe("OK");
    expect(mapped.routes[0].summary).toBe("I-95");
    expect(mapped.routes[0].copyrights).toMatch(/Powered by Google/);
    expect(mapped.routes[0].legs[0].distance.value).toBe(100);
    expect(mapped.routes[0].legs[1].duration.value).toBe(20);
  });
});
