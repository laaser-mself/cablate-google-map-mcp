import { PlaceDetails } from "../../../src/tools/maps/placeDetails.js";
import { afterEachResetSearcher, mockSearcher, parseAction } from "../../helpers/mockPlacesSearcher.js";

afterEach(afterEachResetSearcher);

describe("get_place_details ACTION", () => {
  it("includes photos in parsed JSON", async () => {
    mockSearcher({
      getPlaceDetails: jest.fn().mockResolvedValue({
        ok: true,
        tool: "get_place_details",
        status: "OK",
        data: { place_id: "abc", photos: [{ photo_reference: "p1" }] },
      }),
    });
    const result = await PlaceDetails.ACTION({ placeId: "abc" });
    const body = parseAction(result);
    expect(body.data.photos.length).toBeGreaterThan(0);
  });

  it("sets isError on failure", async () => {
    mockSearcher({
      getPlaceDetails: jest.fn().mockResolvedValue({
        ok: false,
        tool: "get_place_details",
        status: "ERROR",
        error_message: "nope",
        data: null,
      }),
    });
    const result = await PlaceDetails.ACTION({ placeId: "abc" });
    expect(result.isError).toBe(true);
  });
});
