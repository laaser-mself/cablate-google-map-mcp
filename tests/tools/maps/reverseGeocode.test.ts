import { ReverseGeocode } from "../../../src/tools/maps/reverseGeocode.js";
import { afterEachResetSearcher, mockSearcher, parseAction } from "../../helpers/mockPlacesSearcher.js";

afterEach(afterEachResetSearcher);

describe("maps_reverse_geocode ACTION", () => {
  it("includes address_components", async () => {
    mockSearcher({
      reverseGeocode: jest.fn().mockResolvedValue({
        ok: true,
        tool: "maps_reverse_geocode",
        status: "OK",
        data: { formatted_address: "A", place_id: "p", address_components: [{ long_name: "Miami" }], alternates: [] },
      }),
    });
    const result = await ReverseGeocode.ACTION({ latitude: 25.7, longitude: -80.2 });
    expect(parseAction(result).data.address_components[0].long_name).toBe("Miami");
  });

  it("sets isError on failure", async () => {
    mockSearcher({
      reverseGeocode: jest.fn().mockResolvedValue({
        ok: false,
        tool: "maps_reverse_geocode",
        status: "ERROR",
        error_message: "failed",
        data: null,
      }),
    });
    expect((await ReverseGeocode.ACTION({ latitude: 1, longitude: 2 })).isError).toBe(true);
  });
});
