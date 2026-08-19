import { Geocode } from "../../../src/tools/maps/geocode.js";
import { afterEachResetSearcher, mockSearcher, parseAction } from "../../helpers/mockPlacesSearcher.js";

afterEach(afterEachResetSearcher);

describe("maps_geocode ACTION", () => {
  it("returns alternates", async () => {
    mockSearcher({
      geocode: jest.fn().mockResolvedValue({
        ok: true,
        tool: "maps_geocode",
        status: "OK",
        data: { location: { lat: 1, lng: 2 }, formatted_address: "A", place_id: "p", alternates: [{ formatted_address: "B", place_id: "q", location: { lat: 3, lng: 4 } }] },
      }),
    });
    const result = await Geocode.ACTION({ address: "Springfield" });
    expect(parseAction(result).data.alternates.length).toBe(1);
  });

  it("sets isError on failure", async () => {
    mockSearcher({
      geocode: jest.fn().mockResolvedValue({
        ok: false,
        tool: "maps_geocode",
        status: "ERROR",
        error_message: "failed",
        data: null,
      }),
    });
    expect((await Geocode.ACTION({ address: "x" })).isError).toBe(true);
  });
});
