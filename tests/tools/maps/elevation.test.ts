import { Elevation } from "../../../src/tools/maps/elevation.js";
import { afterEachResetSearcher, mockSearcher, parseAction } from "../../helpers/mockPlacesSearcher.js";

afterEach(afterEachResetSearcher);

describe("maps_elevation ACTION", () => {
  it("includes resolution", async () => {
    mockSearcher({
      getElevation: jest.fn().mockResolvedValue({
        ok: true,
        tool: "maps_elevation",
        status: "OK",
        data: [{ elevation: 10, location: { lat: 1, lng: 2 }, resolution: 4.7 }],
      }),
    });
    const result = await Elevation.ACTION({ locations: [{ latitude: 1, longitude: 2 }] });
    expect(parseAction(result).data[0].resolution).toBe(4.7);
  });

  it("sets isError on failure", async () => {
    mockSearcher({
      getElevation: jest.fn().mockResolvedValue({
        ok: false,
        tool: "maps_elevation",
        status: "ERROR",
        error_message: "failed",
        data: null,
      }),
    });
    expect((await Elevation.ACTION({ locations: [{ latitude: 1, longitude: 2 }] })).isError).toBe(true);
  });
});
