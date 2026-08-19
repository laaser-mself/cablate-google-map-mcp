import { SearchNearby } from "../../../src/tools/maps/searchNearby.js";
import { afterEachResetSearcher, mockSearcher, parseAction } from "../../helpers/mockPlacesSearcher.js";

afterEach(afterEachResetSearcher);

describe("search_nearby ACTION", () => {
  it("returns envelope JSON with center and results", async () => {
    mockSearcher({
      searchNearby: jest.fn().mockResolvedValue({
        ok: true,
        tool: "search_nearby",
        status: "OK",
        data: { center: { lat: 1, lng: 2 }, results: [{ name: "Cafe", types: ["cafe"] }] },
      }),
    });
    const result = await SearchNearby.ACTION({
      center: { value: "1,2", isCoordinates: true },
      keyword: "cafe",
      openNow: false,
    });
    expect(result.isError).toBe(false);
    const body = parseAction(result);
    expect(body.data.results[0].types).toContain("cafe");
  });

  it("sets isError when ok is false", async () => {
    mockSearcher({
      searchNearby: jest.fn().mockResolvedValue({
        ok: false,
        tool: "search_nearby",
        status: "ERROR",
        error_message: "failed",
        data: null,
      }),
    });
    const result = await SearchNearby.ACTION({
      center: { value: "1,2", isCoordinates: true },
      openNow: false,
    });
    expect(result.isError).toBe(true);
  });
});
